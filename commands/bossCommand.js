/**
 * commands/bossCommand.js
 *
 * !mboss (default; see commandConfig.js) -> breakdown of the CURRENT active boss
 * !mboss <name>        -> strict lookup (exact / alias / all-tokens match; NEVER fuzzy-guesses)
 * !mboss list          -> list known bosses
 * !mboss set <name>    -> (Creator/Admin) set current boss manually
 *
 * Bypasses decisionPipeline / emotions / relationship / working memory entirely.
 * One LLM call via melody.generateBossBreakdown (fast lane), cached per boss.
 *
 * ── Supabase (optional, for persistent current-boss state across Render restarts) ──
 *   create table if not exists bot_state (
 *     key text primary key,
 *     value jsonb,
 *     updated_at timestamptz default now()
 *   );
 */
'use strict';

const { ramClient } = require('../database/supabaseClient');
const { replyChunked } = require('../utils/replyChunked');
const { bossLabel } = require('./commandConfig');

const CREATOR_ID = '1369404203880939650';
const ADMIN_ROLE_ID = '1372987132855058504';
const STATE_KEY = 'current_boss';
const BREAKDOWN_TTL_MS = 6 * 60 * 60 * 1000;
const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// 🔌 DATA ADAPTER — the ONLY place that knows your boss data shape.
// Tries these modules/export names; adjust once I see the real file.
// ─────────────────────────────────────────────────────────────
const DATA_MODULES = ['../data/bosses', '../data/gameData'];
const BOSS_EXPORTS = ['bosses', 'rawBossData', 'BOSSES', 'bossData', 'default'];
const SCHEDULE_EXPORTS = ['bossSchedule', 'BOSS_SCHEDULE'];   // optional: [{ id|name, start, end }]
const TROOP_META_EXPORTS = ['bossTroopMeta', 'BOSS_TROOP_META']; // optional

function pickExport(mod, names) {
    if (!mod) return undefined;
    for (const n of names) if (mod[n] !== undefined) return mod[n];
    return undefined;
}

function loadFromData(names) {
    for (const path of DATA_MODULES) {
        try {
            const v = pickExport(require(path), names);
            if (v !== undefined) return v;
        } catch (_) { /* module missing — try next */ }
    }
    return undefined;
}

function normalizeText(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadRawBosses() {
    for (const path of DATA_MODULES) {
        try {
            const mod = require(path);
            if (Array.isArray(mod)) return mod; // data/bosses.js: module.exports = bosses
            const v = pickExport(mod, BOSS_EXPORTS);
            if (v !== undefined) return v;
        } catch (_) { /* try next */ }
    }
    return undefined;
}

function loadBossList() {
    const raw = loadRawBosses();
    if (!raw) return [];
    const entries = Array.isArray(raw) ? raw.map((v, i) => [v?.id ?? v?.slug ?? String(i), v]) : Object.entries(raw);
    return entries
        .filter(([, v]) => v && typeof v === 'object')
        .map(([key, v]) => {
            const name = String(v.name || v.title || v.bossName || key);
            const tier = v.tier ? String(v.tier) : '';
            const aliases = [].concat(v.aliases || v.alias || v.aka || []).map(String);
            if (tier) aliases.push(tier, `${name} ${tier}`, `${tier} ${name}`); // "fire dragon", "dagon kraken"
            return {
                id: String(v.id ?? v.slug ?? name.toLowerCase()),
                name,
                tier,
                aliases,
                record: v
            };
        });
}

const NOISE_KEYS = /^(id|slug|key|image|img|icon|url|thumbnail|emoji|color|colour|embed)$/i;
function compactRecord(obj) {
    if (Array.isArray(obj)) {
        const arr = obj.map(compactRecord).filter(v => v !== undefined);
        return arr.length ? arr : undefined;
    }
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (NOISE_KEYS.test(k)) continue;
            const c = compactRecord(v);
            if (c !== undefined) out[k] = c;
        }
        return Object.keys(out).length ? out : undefined;
    }
    if (obj === null || obj === undefined || obj === '') return undefined;
    return obj;
}

// ─────────────────────────────────────────────────────────────
// 🎯 STRICT RESOLVER — never returns a boss that doesn't truly match
// ─────────────────────────────────────────────────────────────
const STOP = new Set(['boss', 'the', 'a', 'of', 'for', 'vs', 'against', 'about', 'guide', 'strategy', 'please']);

function tokens(s) {
    return normalizeText(s).split(' ').filter(t => t && !STOP.has(t));
}

function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1, dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[a.length][b.length];
}

function resolveBoss(query, list) {
    const qNorm = tokens(query).join(' ');
    if (!qNorm) return { status: 'none', suggestions: [] };

    // 1) exact name / id / alias
    const exact = list.filter(b =>
        [b.name, b.id, ...b.aliases].some(n => tokens(n).join(' ') === qNorm)
    );
    if (exact.length === 1) return { status: 'ok', boss: exact[0] };

    // 2) every query token must appear as a whole token in the boss name/aliases
    const qTok = tokens(query);
    const subset = list.filter(b =>
        [b.name, ...b.aliases].some(n => {
            const nt = tokens(n);
            return qTok.every(q => nt.includes(q));
        })
    );
    if (subset.length === 1) return { status: 'ok', boss: subset[0] };
    if (subset.length > 1) return { status: 'ambiguous', matches: subset.slice(0, 5) };

    // 3) typo tolerance ONLY for a single-token query vs a single name token (distance <= 1)
    if (qTok.length === 1 && qTok[0].length >= 5) {
        const typo = list.filter(b => tokens(b.name).some(t => editDistance(t, qTok[0]) <= 1));
        if (typo.length === 1) return { status: 'ok', boss: typo[0] };
    }

    // No match -> suggestions only (shown to the user, never auto-picked)
    const suggestions = list
        .map(b => {
            const nt = [b.name, ...b.aliases].flatMap(tokens);
            const score = qTok.reduce((n, q) => n + (nt.some(t => t.startsWith(q.slice(0, 3)) || editDistance(t, q) <= 2) ? 1 : 0), 0);
            return { b, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(x => x.b);
    return { status: 'none', suggestions };
}

// ─────────────────────────────────────────────────────────────
// 🗓️ CURRENT BOSS STATE (+ cron hook)
// ─────────────────────────────────────────────────────────────
let state = { id: process.env.CURRENT_BOSS_ID || null, source: process.env.CURRENT_BOSS_ID ? 'env' : 'none', updatedAt: 0 };
const breakdownCache = new Map(); // bossId -> { text, at }

async function loadStateFromDb() {
    try {
        const { data, error } = await ramClient.from('bot_state').select('value').eq('key', STATE_KEY).maybeSingle();
        if (error || !data?.value?.id) return null;
        return data.value;
    } catch (_) { return null; }
}

async function saveStateToDb(value) {
    try {
        await ramClient.from('bot_state').upsert({ key: STATE_KEY, value, updated_at: new Date().toISOString() });
    } catch (err) {
        console.warn('⚠️ [BOSS] Could not persist current boss (bot_state table missing?):', err.message);
    }
}

// Optional schedule from data: [{ id|name, start: ISO, end: ISO }]
function scheduledBossId(list, now = Date.now()) {
    const sched = loadFromData(SCHEDULE_EXPORTS);
    if (!Array.isArray(sched)) return null;
    const hit = sched.find(s => now >= Date.parse(s.start) && now < Date.parse(s.end));
    if (!hit) return null;
    const ref = hit.id ?? hit.name;
    const r = resolveBoss(String(ref), list);
    return r.status === 'ok' ? r.boss.id : null;
}

async function refreshCurrentBoss() {
    const list = loadBossList();
    if (list.length === 0) return console.warn('⚠️ [BOSS CRON] No boss data found by adapter.');

    const sId = scheduledBossId(list);
    if (sId) {
        if (state.id !== sId) {
            state = { id: sId, source: 'schedule', updatedAt: Date.now() };
            await saveStateToDb({ id: sId, source: 'schedule' });
            console.log(`🐉 [BOSS CRON] Current boss -> ${sId} (schedule)`);
        }
        return;
    }
    const saved = await loadStateFromDb();
    if (saved && saved.id !== state.id && list.some(b => b.id === saved.id)) {
        state = { id: saved.id, source: saved.source || 'db', updatedAt: Date.now() };
        console.log(`🐉 [BOSS CRON] Current boss -> ${saved.id} (db)`);
    }
}

function startCron() {
    refreshCurrentBoss().catch(e => console.warn('⚠️ [BOSS CRON]', e.message));
    setInterval(() => refreshCurrentBoss().catch(e => console.warn('⚠️ [BOSS CRON]', e.message)), CRON_INTERVAL_MS);
    console.log('🐉 Boss state cron started (6h).');
}

async function setCurrentBoss(id, source = 'manual') {
    state = { id, source, updatedAt: Date.now() };
    await saveStateToDb({ id, source });
}

// ─────────────────────────────────────────────────────────────
// ⏱️ TIMINGS — printed straight from data, never passed through the AI
// ─────────────────────────────────────────────────────────────
const TIMINGS_BLOCK_RE = /\n\n\[[^\]]*TIMINGS\]:[\s\S]*?(?=\n\n\[UNIVERSAL BOSS ROSTER|$)/;

function renderTimings(timings) {
    if (!timings || !Array.isArray(timings.items) || timings.items.length === 0) return '';
    const byMin = new Map();
    for (const i of timings.items) {
        const m = String(i.t).split(':')[0];
        if (!byMin.has(m)) byMin.set(m, []);
        byMin.get(m).push(i.action ? `${i.t} ${i.action}` : i.t);
    }
    const lines = [...byMin.entries()]
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([m, arr]) => `• **Min ${m}:** ${arr.join(' · ')}`);
    const notes = (timings.notes || []).map(n => `• ⚠️ ${n}`);
    return `⏱️ **Max Score Timings**\n${[...notes, ...lines].join('\n')}`;
}

function buildPayload(boss) {
    const rec = { ...boss.record };
    delete rec.timings;
    if (typeof rec.strategy === 'string') rec.strategy = rec.strategy.replace(TIMINGS_BLOCK_RE, '');
    return compactRecord(rec) || { name: boss.name };
}

// ─────────────────────────────────────────────────────────────
// 🧾 BREAKDOWN (cached → 0 tokens on repeat calls)
// ─────────────────────────────────────────────────────────────
async function getBreakdown(boss, { melody, requestQueue }) {
    const cached = breakdownCache.get(boss.id);
    if (cached && Date.now() - cached.at < BREAKDOWN_TTL_MS) return cached.text;

    const extra = loadFromData(TROOP_META_EXPORTS) ?? null;
    const result = await requestQueue.enqueue(() =>
        melody.generateBossBreakdown({ boss: buildPayload(boss), extraContext: extra })
    );
    const text = result?.text?.trim();
    if (!text) return null;
    breakdownCache.set(boss.id, { text, at: Date.now() });
    return text;
}

// ─────────────────────────────────────────────────────────────
// 🎮 COMMAND HANDLER
// ─────────────────────────────────────────────────────────────
async function handle({ message, argText = '', melody, requestQueue }) {
    const arg = argText.trim();
    const lower = arg.toLowerCase();
    const list = loadBossList();

    if (list.length === 0) {
        return message.reply('⚠️ Boss data is not loaded on my side yet. Tell my Creator to check `data/bosses`.').catch(() => {});
    }

    if (lower === 'list') {
        const names = list.map(b => `• ${b.name}${b.tier ? ` — ${b.tier}` : ''}`).join('\n');
        return replyChunked(message, `🐉 **Known bosses (${list.length}):**\n${names}`);
    }

    if (lower.startsWith('set ')) {
        const isPrivileged = message.author.id === CREATOR_ID || message.member?.roles.cache.has(ADMIN_ROLE_ID);
        if (!isPrivileged) return message.reply('❌ Only my Creator or a Clan Admin can set the current boss.').catch(() => {});
        const r = resolveBoss(arg.slice(4), list);
        if (r.status !== 'ok') return message.reply(formatNoMatch(arg.slice(4), r)).catch(() => {});
        await setCurrentBoss(r.boss.id, 'manual');
        return message.reply(`✅ Current boss set to **${r.boss.name}**.`).catch(() => {});
    }

    let boss;
    let isCurrent = false;

    if (!arg) {
        if (!state.id) await refreshCurrentBoss().catch(() => {});
        boss = list.find(b => b.id === state.id);
        if (!boss) {
            return message.reply(`🐉 No active boss is set yet. Use \`${bossLabel} <name>\` or ask an admin to run \`${bossLabel} set <name>\`.`).catch(() => {});
        }
        isCurrent = true;
    } else {
        const r = resolveBoss(arg, list);
        if (r.status !== 'ok') return message.reply(formatNoMatch(arg, r)).catch(() => {});
        boss = r.boss;
    }

    await message.channel.sendTyping().catch(() => {});
    const text = await getBreakdown(boss, { melody, requestQueue });
    if (!text) {
        return message.reply('⚠️ Could not generate the boss breakdown right now. Try again in a bit.').catch(() => {});
    }

    const title = boss.name.charAt(0) + boss.name.slice(1).toLowerCase();
    const header = `🐉 **${title}**${boss.tier ? ` — ${boss.tier}` : ''}${isCurrent ? ' *(current boss)*' : ''}`;
    const timings = renderTimings(boss.record.timings);
    return replyChunked(message, `${header}\n\n${text}${timings ? `\n\n${timings}` : ''}`);
}

function formatNoMatch(query, r) {
    const q = query.trim();
    if (r.status === 'ambiguous') {
        return `🤔 "${q}" matches several bosses:\n${r.matches.map(b => `• ${b.name}${b.tier ? ` — ${b.tier}` : ''}`).join('\n')}\nBe more specific.`;
    }
    const sug = r.suggestions?.length ? `\nDid you mean:\n${r.suggestions.map(b => `• ${b.name}`).join('\n')}` : '';
    return `❌ I have no boss named **"${q}"** in my data.${sug}\nUse \`${bossLabel} list\` to see all of them.`;
}

module.exports = { handle, startCron, refreshCurrentBoss, setCurrentBoss, resolveBoss, loadBossList };
  
