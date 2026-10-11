/**
 * engine/facetCompiler.js
 *
 * Compiles one verified CARD per hero/troop from the raw data files, then lays the curated
 * data/facetOverrides.js on top. The facet store (and the reply guard) read ONLY cards, so:
 *   - every unit that appears in an answer arrives with a plain, true "job" line (no model guessing),
 *   - capability flags (heals / crowd-control kinds / summons) are derived from the ability text itself,
 *   - a human override always wins.
 * Pure functions, no I/O. Cards are memoised.
 */
'use strict';

const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const cn = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const CC_KINDS = [
  ['stun', /\bstun/i], ['sleep', /\bsleep|\bslumber/i], ['freeze', /\bfreez|\bfrozen/i], ['fear', /\bfear|\bflee|\bterrif/i],
  ['pull', /\bpull|\bdrag/i], ['knock', /\bknock|\blaunch|\bthrow|\bhurl|toss/i], ['taunt', /\btaunt/i],
  ['silence', /(can'?t|cannot|unable to|prevent\w*)\s+(use|cast)\s+(their\s+)?abilit|\bsilence|\bdisable/i],
  ['slow', /\bslow/i], ['control', /take control|mind control/i],
];
const HEAL_RE = /\bheal(s|ing|er)?\b|\bregenerat|\brestor(e|es|ing)\s+(hp|health)/i;
const SUMMON_RE = /\bsummon/i;

function partText(p) { return p ? [p.name, p.description, Object.keys(p.effects || {}).join(' ')].join(' ') : ''; }

function capsOf(entity, parts) {
  const txt = parts.map(partText).join(' ');
  const tags = [].concat(entity.tags || [], entity.categories || [], (entity.analysis && entity.analysis.secondaryRoles) || [], entity.analysis && entity.analysis.primaryRole || []).map(x => String(x).toLowerCase());
  const cc = CC_KINDS.filter(([, re]) => re.test(txt)).map(([k]) => k);
  if (!cc.length && tags.includes('crowd-control')) cc.push('control');
  return {
    heals: HEAL_RE.test(txt) || tags.includes('healer') || tags.includes('healing'),
    cc,
    summons: SUMMON_RE.test(txt) || tags.includes('summoner'),
    aoe: tags.includes('aoe') || /\baoe\b/i.test(txt),
  };
}

function buildCompiler({ HEROES = [], TROOPS = [], SYN = {}, STRAT = {}, OV = {} }) {
  const ovH = OV.heroes || {}, ovT = OV.troops || {};
  const _h = new Map(), _t = new Map();

  function troopCard(t) {
    if (_t.has(t.id)) return _t.get(t.id);
    const o = ovT[t.id] || {};
    const a = t.ability;
    const caps = capsOf(t, [a]);
    const does = a && a.name ? `${a.name}: ${clip(a.description, 110)}` : 'plain attacker/defender, no special ability';
    const derivedJob = (caps.cc.length ? 'Crowd control — ' : '') + does;
    const supportClass = (t.categories || []).includes('Support') || t.type === 'Support';
    const card = {
      kind: 'troop', id: t.id, name: t.name, caps,
      does, job: o.job || derivedJob,
      // Support is only a class tag in this game: say so unless the unit really heals
      notAHealer: supportClass && !caps.heals,
      neverClaim: Array.from(new Set([].concat(o.neverClaim || [], caps.heals ? [] : ['heal']))),
      boss: o.boss, arena: o.arena, placement: o.placement, beginner: !!o.beginner, notes: o.notes || [],
    };
    _t.set(t.id, card); return card;
  }

  function heroCard(h) {
    if (_h.has(h.id)) return _h.get(h.id);
    const o = ovH[h.id] || {};
    const caps = capsOf(h, [h.talent, h.ability]);
    const card = {
      kind: 'hero', id: h.id, name: h.name, caps,
      job: o.job, neverClaim: o.neverClaim || [], boss: o.boss, arena: o.arena, notes: o.notes || [],
    };
    _h.set(h.id, card); return card;
  }

  // ── reply guard: catches "<unit> heals / stuns / summons…" when the card says it cannot ──
  const CLAIMS = {
    heal: HEAL_RE, summon: /\bsummon/i, stun: /\bstun/i, sleep: /\bsleep/i, fear: /\bfear|\bflee/i,
    pull: /\bpull/i, taunt: /\btaunt/i, silence: /\bsilence/i, tank: /\btank(s|ing)?\b/i, aoe: /\baoe\b|area damage/i,
  };
  const _names = [];
  function _index() {
    if (_names.length) return _names;
    TROOPS.forEach(t => { const c = troopCard(t); const base = String(t.name); [base, base.replace(/s$/i, ''), base.replace(/(\w)(breaker)/i, '$1 $2')].forEach(n => _names.push({ re: new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + 's?\\b', 'i'), card: c })); });
    HEROES.forEach(h => { const c = heroCard(h); const first = String(h.name).split(/[ ,]/).filter(w => w.length > 3 && !/^(the|of)$/i.test(w)); const nm = h.name.split(',')[0]; [nm].concat(first.slice(-1), first.slice(0, 1)).forEach(n => _names.push({ re: new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b', 'i'), card: c })); });
    return _names;
  }
  function cannotOf(card) {
    const bad = new Set(card.neverClaim || []);
    if (card.kind === 'troop') {
      ['stun', 'sleep', 'fear', 'pull', 'taunt', 'silence'].forEach(k => { if (!card.caps.cc.includes(k) && !card.caps.cc.includes('control')) bad.add(k); });
      if (!card.caps.summons) bad.add('summon');
    }
    return bad;
  }
  /** returns [{unit, claim, text}] for every sentence that attributes an impossible skill to a unit */
  function verifyReply(text) {
    const out = [];
    const idx = _index();
    String(text || '').split(/\n+/).forEach(line => {
      // sentences/clauses; an entity owns the words until the next entity name or clause end
      line.replace(/\*\*|__|`/g, '').split(/(?<=[.;!?])\s+/).forEach(clause => {
        const hits = [];
        idx.forEach(({ re, card }) => { const m = re.exec(clause); if (m) hits.push({ at: m.index, end: m.index + m[0].length, card }); });
        hits.sort((a, b) => a.at - b.at);
        hits.forEach((h, i) => {
          const seg = clause.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : undefined);
          if (!seg.trim()) return;
          cannotOf(h.card).forEach(k => {
            if (CLAIMS[k] && CLAIMS[k].test(seg) && !/\b(not|no|never|doesn'?t|does not|without|cannot|can'?t|neither|nobody|nothing|none|nor)\b/i.test(seg)) {
              out.push({ unit: h.card.name, claim: k, text: clip(clause, 140) });
            }
          });
        });
      });
    });
    return out;
  }
  /** drop every line that still carries a violation (last-resort scrub) */
  function scrubReply(text) {
    const bad = verifyReply(text);
    if (!bad.length) return text;
    return String(text).split(/\n/).filter(l => !verifyReply(l).length).join('\n');
  }

  /** consistency report used by scripts/validateFacetData.js */
  function audit() {
    const issues = [];
    TROOPS.forEach(t => {
      const c = troopCard(t);
      if (!t.ability && !(ovT[t.id] || {}).job) issues.push(`troop ${t.name}: no ability and no curated job — add a "job" in facetOverrides.js`);
      if (c.notAHealer && /heal/i.test(c.job) && !/(not|never|no)\s+heal/i.test(c.job)) issues.push(`troop ${t.name}: class Support, job mentions healing but ability text does not`);
    });
    Object.keys(ovT).forEach(k => { if (!TROOPS.some(t => t.id === k)) issues.push(`override troop id not found: ${k}`); });
    Object.keys(ovH).forEach(k => { if (!HEROES.some(h => h.id === k)) issues.push(`override hero id not found: ${k}`); });
    HEROES.forEach(h => { if (!h.talent && !h.ability) issues.push(`hero ${h.name}: no talent/ability data`); });
    return issues;
  }

  return { troopCard, heroCard, verifyReply, scrubReply, audit, cn };
}

module.exports = { buildCompiler, capsOf };
