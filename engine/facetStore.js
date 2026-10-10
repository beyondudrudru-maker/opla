/**
 * engine/facetStore.js — MODULAR "FACET" DATA (Phase 1: heroes + troops)
 *
 * Every hero/troop is split into small, pre-digested facets:
 *   hero : summary · talent · synergy · boss · arena · troops
 *   troop: summary · ability · heroes · boss · arena
 * A question loads ONLY the facet(s) it needs (~300-600 tokens) instead of the whole data block.
 * Facets are computed from the real data files on first use (no build step to forget) and cached
 * in memory; game rules (max 2 heroes / 1 Mythical, Harkon+Xana boss-disabled, Pyrotechnician
 * low boss impact) are baked in here, so the AI never has to remember them.
 *
 * Buttons: customId = "fct|<lang h/e>|<h/t>|<entityKey>|<facet>"   (stateless: survives restarts)
 */
'use strict';

function _req(p) { try { return require(p); } catch (_) { return null; } }
const _heroesMod = _req('../data/heroes.js');
const _troopsMod = _req('../data/troops.js');
const _synMod    = _req('../data/synergies.js');
const _stratMod  = _req('../data/strategies.js');

const _arr = m => !m ? [] : Array.isArray(m) ? m : (m.heroes || m.troops || Object.values(m));
const HEROES = _arr(_heroesMod);
const TROOPS = _arr(_troopsMod);
const SYN    = (_synMod && (_synMod.synergies || _synMod)) || {};
const STRAT  = (_stratMod && (_stratMod.strategies || _stratMod)) || {};

const FACET_VERSION = 1;
const MYTHICAL = new Set(['XANA', 'HARKON', 'BRUTALLUS', 'CALYRA', 'ATREYA', 'REMUS']);

const HERO_FACETS  = [
  { id: 'synergy', label: 'Synergy', emoji: '🤝' },
  { id: 'boss',    label: 'Boss',    emoji: '🐉' },
  { id: 'arena',   label: 'Arena',   emoji: '⚔️' },
  { id: 'troops',  label: 'Troops',  emoji: '🪖' },
];
const TROOP_FACETS = [
  { id: 'ability', label: 'Ability', emoji: '✨' },
  { id: 'heroes',  label: 'Heroes',  emoji: '🦸' },
  { id: 'boss',    label: 'Boss',    emoji: '🐉' },
  { id: 'arena',   label: 'Arena',   emoji: '⚔️' },
];

const clip = (s, n = 220) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const idKey = x => String(x.id || x.name);

// ── lookup ──────────────────────────────────────────────────────────────────
function findEntity(name) {
  const n = norm(name);
  if (!n) return null;
  const hit = (list, type) => {
    let f = list.find(x => norm(x.name) === n) || list.find(x => norm(x.id) === n || norm(x.id).replace(/ \d+$/, '') === n);
    if (!f) f = list.find(x => norm(x.name).startsWith(n + ' ') || norm(x.name).split(' ')[0] === n);
    return f ? { type, raw: f, key: idKey(f) } : null;
  };
  return hit(HEROES, 'hero') || hit(TROOPS, 'troop');
}
function byKey(type, key) {
  const list = type === 'hero' ? HEROES : TROOPS;
  const f = list.find(x => idKey(x) === key);
  return f ? { type, raw: f, key } : null;
}

// ── reach: does hero's talent/ability target this troop? ───────────────────
function _tags(t) { return new Set([...(t.categories || []), ...(t.synergyCategories || []), ...(t.tags || [])].map(x => String(x).toLowerCase())); }
function reaches(hero, troop) {
  const tg = _tags(troop);
  const hit = arr => Array.isArray(arr) && arr.some(x => {
    const k = String(x).toLowerCase().trim();
    return k === 'all allies' || k === 'all' || tg.has(k) || tg.has(k + 's') || tg.has(k.replace(/s$/, ''));
  });
  return { talent: hit(hero.talent && hero.talent.targets), ability: hit(hero.ability && hero.ability.targets) };
}
const family = t => t.type || (t.categories && t.categories[0]) || 'Other';

// ── boss/hero rules ────────────────────────────────────────────────────────
function _heroTokens(h) {
  const idName = String(h.id || '').replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase();
  const nm = String(h.name || '').split(',')[0].toLowerCase();
  const first = nm.split(' ')[0];
  return [...new Set([idName, nm.split(' ').length <= 2 ? nm : '', first.length >= 5 ? first : ''].filter(Boolean))];
}
function bossStatusOfHero(h) {
  const hf = STRAT.bossHeroFit || {};
  const toks = _heroTokens(h);
  const asList = v => Array.isArray(v) ? v : (v ? [v] : []);
  const mentions = list => asList(list).filter(l => { const L = String(l).toLowerCase(); return toks.some(t => new RegExp('\\b' + t.replace(/ /g, '\\s+') + '\\b').test(L)); });
  const excl = ((STRAT.bossTroopMeta && STRAT.bossTroopMeta.hardExclusions && STRAT.bossTroopMeta.hardExclusions.heroes) || ['Harkon', 'Fire Fury Xana'])
    .some(e => String(h.name || '').toLowerCase().includes(String(e).toLowerCase().replace('fire fury ', '')));
  if (excl || /does not work in boss/i.test(JSON.stringify(h.talent || ''))) {
    return { status: 'disabled', note: 'Talent/ability do not work in boss battles — never use for bosses.' };
  }
  const d = mentions(hf.damage), s = mentions(hf.sustain), l = mentions(hf.lowBossValue);
  const seg = line => {
    if (/^faction stackers/i.test(line)) {
      const tg = [].concat((h.talent && h.talent.targets) || [], (h.ability && h.ability.targets) || []).filter(Boolean);
      return `Faction stacker — its buff only helps ${tg.length ? tg.join('/') : 'its faction'} troops; good only when most of the army is that family.`;
    }
    const parts = String(line).split(/;\s*/);
    return parts.find(p => toks.some(t => new RegExp('\\b' + t.replace(/ /g, '\\s+') + '\\b', 'i').test(p))) || line;
  };
  if (d.length) return { status: 'damage', note: seg(d[0]) };
  if (s.length) return { status: 'sustain', note: seg(s[0]) };
  if (l.length) return { status: 'low', note: 'Kit is crowd-control / summon / debuff / evasion — little value for a damage-score boss; only stat buffs are usable.' };
  return { status: 'neutral', note: 'No boss-specific rule in data; judge by what its buffs reach.' };
}
function isMythical(h) { return String(h.rarity || '').toLowerCase() === 'mythical'; }

function _formationsWith(heroId, wantBoss) {
  const out = [];
  for (const f of (STRAT.optimalFormations || [])) {
    if (!(f.heroes || []).includes(heroId)) continue;
    const isBoss = /boss/i.test(f.id + ' ' + f.name);
    if (wantBoss === true && !isBoss) continue;
    if (wantBoss === false && isBoss) continue;
    const pool = f.isHeroPool || (f.heroes || []).length > 2;
    out.push({
      name: f.name, rating: f.synergyRating, troops: f.troopArchetype,
      withHeroes: (f.heroes || []).filter(x => x !== heroId).map(x => (HEROES.find(h => h.id === x) || {}).name || x),
      ...(pool ? { note: 'hero list is a pool — a real battle uses max 2 heroes, max 1 Mythical' } : {}),
    });
  }
  return out.slice(0, 3);
}

// ── HERO facets ────────────────────────────────────────────────────────────
const _eff = o => o && typeof o === 'object' ? o : undefined;
function heroFacet(h, facet) {
  const A = h.analysis || {};
  switch (facet) {
    case 'summary':
      return {
        name: h.name, faction: h.faction, rarity: h.rarity, type: h.type,
        role: A.primaryRole, alsoGoodAt: A.secondaryRoles, strengths: A.strengths, weaknesses: A.weaknesses,
        about: clip(h.description, 200),
      };
    case 'talent':
      return {
        name: h.name,
        talent: h.talent && { name: h.talent.name, what: clip(h.talent.description, 260), effectsLv1toLv10: _eff(h.talent.effects), buffs: h.talent.targets },
        ability: h.ability && { name: h.ability.name, what: clip(h.ability.description, 260), effectsLv1toLv10: _eff(h.ability.effects), buffs: h.ability.targets },
      };
    case 'synergy': {
      const reached = TROOPS.filter(t => { const r = reaches(h, t); return r.talent || r.ability; });
      const fam = {};
      reached.forEach(t => { (fam[family(t)] = fam[family(t)] || []).push(t.name); });
      const buckets = Object.entries(SYN.heroSynergyIndex || {}).filter(([, ids]) => Array.isArray(ids) && ids.includes(h.id)).map(([k]) => k.replace(/^buffs/, 'buffs ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
      return {
        name: h.name, buffTypes: buckets, troopsItBuffsByFamily: fam,
        bestFormations: _formationsWith(h.id, false).concat(_formationsWith(h.id, true)).slice(0, 4),
        rule: 'A battle holds max 2 heroes and max 1 Mythical' + (isMythical(h) ? ` — ${h.name} IS Mythical, so the second hero must be non-Mythical.` : '.'),
      };
    }
    case 'boss': {
      const b = bossStatusOfHero(h);
      const hf = STRAT.bossHeroFit || {};
      return {
        name: h.name, bossUse: b.status, why: b.note, goal: hf.goal,
        bossFormations: _formationsWith(h.id, true),
        rule: 'Max 2 heroes, max 1 Mythical. Boss CC (stun/sleep/pull) is not confirmed to work.',
      };
    }
    case 'arena': {
      const disabledInBoss = bossStatusOfHero(h).status === 'disabled';
      return {
        name: h.name, role: A.primaryRole, type: h.type,
        talentBuffs: h.talent && h.talent.targets, abilityBuffs: h.ability && h.ability.targets,
        pvpNote: disabledInBoss ? 'Works in PvP/Arena (its boss-battle effect is disabled).' : undefined,
        arenaFormations: _formationsWith(h.id, false),
        rule: 'Max 2 heroes, max 1 Mythical.',
      };
    }
    case 'troops':
      return {
        name: h.name, recommendedTroops: h.recommendedTroops,
        gearFamily: h.realGear && h.realGear.roleFamily,
        troopsItBuffsByFamily: (() => { const f = {}; TROOPS.filter(t => { const r = reaches(h, t); return r.talent || r.ability; }).forEach(t => { (f[family(t)] = f[family(t)] || []).push(t.name); }); return f; })(),
      };
    default: return null;
  }
}

// ── TROOP facets ───────────────────────────────────────────────────────────
function _lv10(t) {
  const L = t.levels || {}, i = (L.level || []).length - 1;
  return i < 0 ? undefined : { units: (L.units || [])[i], hp: (L.hp || [])[i], damage: (L.damage || [])[i], defense: (L.defense || [])[i] };
}
function troopFacet(t, facet) {
  const A = t.analysis || {};
  switch (facet) {
    case 'summary':
      return {
        name: t.name, rarity: t.rarity, faction: t.faction, type: t.type, line: t.combatLine, categories: t.categories,
        role: A.primaryRole, strengths: A.strengths, weaknesses: A.weaknesses, about: clip(t.description, 200),
        atMaxLevel: _lv10(t),
      };
    case 'ability': {
      const a = t.ability;
      const ls = a && a.levelStats ? Object.fromEntries(Object.entries(a.levelStats).map(([k, v]) => [k, Array.isArray(v) ? `${v[0]} → ${v[v.length - 1]}` : v])) : undefined;
      return { name: t.name, ability: a ? { name: a.name, what: clip(a.description, 280), lv1toLv10: ls } : null, note: a ? undefined : 'No special ability — plain attacker/defender.' };
    }
    case 'heroes': {
      const row = (SYN.troopHeroSynergy || []).find(r => r.troopId === t.id);
      const syn = row ? row.heroSynergies.map(x => ({ hero: (HEROES.find(h => h.id === x.heroId) || {}).name || x.heroId, why: clip(x.reason, 110) })) : [];
      const bossOK = syn.filter(x => !/harkon|fire fury xana/i.test(x.hero));
      return { name: t.name, heroesThatBuffIt: bossOK.slice(0, 8), recommendedHeroes: t.recommendedHeroes, rule: 'Max 2 heroes per battle, max 1 Mythical. Harkon/Xana do nothing in boss battles.' };
    }
    case 'boss': {
      const m = STRAT.bossTroopMeta || {};
      const low = (m.lowImpactTroops || []).some(x => norm(x) === norm(t.name));
      const nm = norm(t.name);
      const tier = ['legendary', 'epic', 'rare'].find(k => { const v = m[k]; const list = Array.isArray(v) ? v : (v && v.tier) || []; return list.some(x => norm(x) === nm || nm.startsWith(norm(x)) || norm(x).startsWith(nm)); });
      const tags = _tags(t);
      return {
        name: t.name, rarity: t.rarity, bossTier: tier || 'not in boss meta list',
        impact: low ? 'LOW boss impact — do not pick for bosses' : tier ? 'listed in boss meta' : 'neutral',
        damageType: tags.has('ranged') ? 'Ranged' : tags.has('melee') ? 'Melee' : 'unknown',
        resistanceRule: 'Each boss resists either Melee or Ranged by 30% and it rotates per season — field the OPPOSITE type as main damage.',
        priority: 'Legendary > Epic > Rare > Common',
      };
    }
    case 'arena':
      return { name: t.name, line: t.combatLine, type: t.type, role: A.primaryRole, strengths: A.strengths, weaknesses: A.weaknesses, scaling: A.scaling, tags: t.tags };
    default: return null;
  }
}

// ── public API ─────────────────────────────────────────────────────────────
const _cache = new Map();
function getFacet(type, key, facet) {
  const ck = `${type}|${key}|${facet}`;
  if (_cache.has(ck)) return _cache.get(ck);
  const e = byKey(type, key);
  if (!e) return null;
  const v = type === 'hero' ? heroFacet(e.raw, facet) : troopFacet(e.raw, facet);
  if (v) _cache.set(ck, v);
  return v;
}

const facetsFor = type => (type === 'hero' ? HERO_FACETS : TROOP_FACETS);
const isFacet = (type, f) => facetsFor(type).some(x => x.id === f);

function makeId(lang, type, key, facet) { return `fct|${lang}|${type === 'hero' ? 'h' : 't'}|${key}|${facet}`.slice(0, 100); }
function parseId(id) {
  const p = String(id || '').split('|');
  if (p[0] !== 'fct' || p.length < 5) return null;
  return { lang: p[1], type: p[2] === 'h' ? 'hero' : 'troop', key: p[3], facet: p[4] };
}

/** Button rows (max 5 per row) for an entity, skipping facets already shown. */
function buttonSpecs(type, key, lang, shown = []) {
  return facetsFor(type).filter(f => !shown.includes(f.id)).map(f => ({ customId: makeId(lang, type, key, f.id), label: f.label, emoji: f.emoji }));
}

const BOSS_NAMES = /\b(kalidor|balthazar|ashira|dagon)\b/i;
const FACET_WORDS = [
  [/\b(synerg\w*|combo|partner\w*|pair\w*|jodi|saath)\b/i, 'synergy', 'hero'],
  [/\b(boss)\b/i, 'boss', 'both'],
  [/\b(arena|pvp|clash)\b/i, 'arena', 'both'],
  [/\b(troops?|army)\b/i, 'troops', 'hero'],
  [/\b(heroes|hero)\b/i, 'heroes', 'troop'],
];
const OPEN_WORDS = /\b(vs|versus|compare|best|top|list|all|counter|formation|lineup|team|gear|weapon|armou?r|level|lv|stats?)\b/i;
const HINGLISH = /\b(kya|hai|hain|ka|ki|ke|ko|karo|karna|batao|bata|kaise|kaisa|kaisi|mein|me|nahi|aur|kon|konsa|uski|uska|iski|iska)\b/i;
const langOf = text => (HINGLISH.test(text || '') ? 'h' : 'e');

/**
 * Decide if this routed message is a plain single-entity question we can answer from facets.
 * Returns { type, key, facets:[...], context, lang, shown } or null (→ keep the old full-context path).
 */
function planFirstTurn(gameResult, text) {
  try {
    const en = gameResult && gameResult.entities;
    const q = gameResult && gameResult.queryFlags;
    if (!en || !q) return null;
    const heroes = en.heroNames || [], troops = en.troopNames || [];
    if (heroes.length + troops.length !== 1) return null;
    if (q.isComparisonQuery || q.isMultiEntity || q.isListQuery || q.needsGear) return null;
    if (BOSS_NAMES.test(text) || OPEN_WORDS.test(text)) return null;
    const ent = findEntity(heroes[0] || troops[0]);
    if (!ent) return null;
    const lang = langOf(text);
    let wanted = null;
    for (const [re, id, scope] of FACET_WORDS) {
      if (!re.test(text)) continue;
      if (scope !== 'both' && scope !== ent.type) continue;
      if (!isFacet(ent.type, id)) continue;
      wanted = id; break;
    }
    const first = ent.type === 'hero' ? ['summary', 'talent'] : ['summary', 'ability'];
    const facets = wanted ? [wanted] : first;
    const context = { facetMode: true, entity: ent.raw.name, lang: lang === 'h' ? 'Roman Hinglish' : 'English' };
    for (const f of facets) context[f] = getFacet(ent.type, ent.key, f);
    context.formatInstruction = wanted
      ? `Explain ONLY the "${wanted}" facet of ${ent.raw.name} from the data given.`
      : `Give a short intro of ${ent.raw.name}: role, talent, ability, one-line verdict.`;
    return { type: ent.type, key: ent.key, facets, context, lang, shown: wanted ? [wanted] : [], name: ent.raw.name };
  } catch (_) { return null; }
}

/** Context for a button click. */
function buttonContext(type, key, facet, lang) {
  const e = byKey(type, key);
  if (!e) return null;
  const data = getFacet(type, key, facet);
  if (!data) return null;
  return {
    name: e.raw.name,
    context: {
      facetMode: true, entity: e.raw.name, lang: lang === 'h' ? 'Roman Hinglish' : 'English',
      [facet]: data,
      formatInstruction: `Explain ONLY the "${facet}" facet of ${e.raw.name} from the data given.`,
    },
  };
}

module.exports = {
  FACET_VERSION, findEntity, getFacet, facetsFor, makeId, parseId, buttonSpecs, planFirstTurn, buttonContext, langOf,
};
