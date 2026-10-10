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

const FACET_VERSION = 3;
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
const cn = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const _tg = [].concat((h.talent && h.talent.targets) || [], (h.ability && h.ability.targets) || []).map(x => String(x).toLowerCase());
  if (_tg.some(x => /skeleton/.test(x)) && !_tg.some(x => /^all( allies)?$/.test(x))) {
    return { status: 'low', note: 'Her buff reaches ONLY summoned skeletons (from Cursed Catapult, Necromancer or her own Tombstone), not Undead troops in general. Skeletons and their summoners have low HP and die early, so on a damage-score boss the buff is wasted — do not recommend.' };
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
  if (d.length && /^faction stackers/i.test(String(d[0]))) {
    const k = _buffKinds(h.talent);
    return { status: k.includes('damage') ? 'damage' : 'sustain', note: seg(d[0]) + (k.includes('damage') ? '' : ' It gives HP/defense, not damage.') };
  }
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
    const others = (f.heroes || []).filter(x => x !== heroId).map(x => (HEROES.find(h => h.id === x) || {}).name || x);
    out.push({
      name: f.name, rating: f.synergyRating, troops: f.troopArchetype,
      ...(pool ? { partnerPool: others, note: 'partnerPool = candidates; a battle holds only 2 heroes in total, so pick exactly ONE partner from it (never two Mythicals)' } : { withHeroes: others }),
    });
  }
  return out.slice(0, 3);
}


// ── boss-score helpers: hero value = what its buffs do for the troops that deal the damage ──
function _metaTroops() {
  const m = STRAT.bossTroopMeta || {};
  const names = [].concat(m.legendary || [], (m.epic && m.epic.tier) || [], (m.rare && m.rare.tier) || [], m.common || []);
  const low = new Set([].concat(m.lowImpactTroops || [], m.aoeLowBoss || []).map(norm));
  return TROOPS.filter(t => names.some(n => cn(n) === cn(t.name) || cn(t.name).startsWith(cn(n)) || cn(n).startsWith(cn(t.name))) && !low.has(cn(t.name)));
}
function _buffKinds(part) {
  if (!part) return [];
  if (!Array.isArray(part.targets) || !part.targets.length) return [];   // no ally targets = self/enemy effect, not a buff
  const txt = (Object.keys(part.effects || {}).join(' ') + ' ' + (part.description || '')).toLowerCase();
  const k = [];
  if (/damage|attack/.test(txt)) k.push('damage');
  if (/defense|reduction|\bhp\b|health|shield/.test(txt)) k.push('defense');
  if (/heal|regenerat/.test(txt)) k.push('healing');
  return k;
}
function _bossSync(h) {
  const meta = _metaTroops();
  const part = (p) => {
    if (!p) return null;
    const all = (p.targets || []).some(x => /^all( allies)?$/i.test(String(x).trim()));
    const hit = all ? null : meta.filter(t => (p === h.talent ? reaches(h, t).talent : reaches(h, t).ability)).map(t => t.name);
    return { buffs: _buffKinds(p), reaches: all ? 'ALL fielded troops' : (hit.length ? hit : 'none of the boss-meta troops') };
  };
  return { talent: part(h.talent), ability: part(h.ability) };
}
const _scoring = () => (STRAT.bossDamageScoring || {});
function _squad(t) {
  const L = t.levels || {}, i = (L.damage || []).length - 1;
  const u = (L.units || [])[i], d = (L.damage || [])[i];
  return { unitsLv10: u, damagePerUnitLv10: d, squadDamageRaw: (typeof u === 'number' && typeof d === 'number') ? u * d : undefined };
}
function _hpInfo(t) {
  const L = t.levels || {}, i = (L.hp || []).length - 1;
  const hp = (L.hp || [])[i];
  if (typeof hp !== 'number') return undefined;
  const arr = TROOPS.map(x => ({ n: x.name, v: ((x.levels || {}).hp || []).slice(-1)[0] })).filter(x => typeof x.v === 'number').sort((a, b) => b.v - a.v);
  const k = arr.findIndex(x => x.n === t.name);
  return { hpPerUnitLv10: hp, hpRank: `#${k + 1} of ${arr.length} troops` + (k >= arr.length - 3 ? ' (one of the lowest — dies early)' : '') };
}
function _squadRank(t) {
  const arr = TROOPS.map(x => ({ n: x.name, v: _squad(x).squadDamageRaw })).filter(x => typeof x.v === 'number').sort((a, b) => b.v - a.v);
  const i = arr.findIndex(x => x.n === t.name);
  return i < 0 ? undefined : `#${i + 1} of ${arr.length} troops by (units x damage per unit) at Lv10`;
}

// ── crowd-control / disable detection (Arena value) ─────────────────────────
const CC_KINDS = [
  ['stun', /\bstun/i], ['sleep', /\bsleep|\bslumber/i], ['freeze', /\bfreez|\bfrozen|\bfrost/i], ['fear', /\bfear|\bterrif/i],
  ['pull', /\bpull|\bdrag/i], ['knock-up/back', /\bknock|\blaunch|\bthrow|\bhurl/i], ['taunt', /\btaunt/i],
  ['silence/ability-disable', /(can'?t|cannot|unable to|prevent\w*)\s+(use|cast)\s+(their\s+)?abilit|\bsilence|disable/i],
  ['slow', /\bslow/i], ['unable to attack', /unable to attack|can'?t attack|cannot attack/i],
];
function _ccInfo(part) {
  if (!part) return null;
  const txt = (part.name || '') + ' ' + (part.description || '') + ' ' + Object.keys(part.effects || {}).join(' ');
  const kinds = CC_KINDS.filter(([, re]) => re.test(txt)).map(([k]) => k);
  if (!kinds.length) return null;
  const detail = {};
  Object.entries(part.effects || {}).forEach(([k, v]) => { if (/stun|sleep|freez|fear|duration|time|enemies|radius|taunt|slow/i.test(k)) detail[k] = v; });
  return { skill: part.name, kinds, detail };
}
function _arenaInfo(h) {
  const cc = [_ccInfo(h.talent), _ccInfo(h.ability)].filter(Boolean);
  const buffs = [['talent', h.talent], ['ability', h.ability]].map(([w, p]) => (p && Array.isArray(p.targets) && p.targets.length) ? { from: w, skill: p.name, buffs: _buffKinds(p), reaches: p.targets } : null).filter(Boolean);
  return { crowdControl: cc.length ? cc : 'none', allyBuffs: buffs.length ? buffs : 'none (self / enemy effect only)' };
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
        talent: h.talent && { name: h.talent.name, what: clip(h.talent.description, 260), effectsLv1toLv10: _eff(h.talent.effects), valuesPerLevel: _eff(h.talent.levelStats), buffs: h.talent.targets },
        ability: h.ability && { name: h.ability.name, what: clip(h.ability.description, 260), effectsLv1toLv10: _eff(h.ability.effects), valuesPerLevel: _eff((h.ability.levelStats || h.ability.byLevel)), buffs: h.ability.targets },
      };
    case 'synergy': {
      const reached = TROOPS.filter(t => { const r = reaches(h, t); return r.talent || r.ability; });
      const fam = {};
      reached.forEach(t => { (fam[family(t)] = fam[family(t)] || []).push(t.name); });
      const buckets = Object.entries(SYN.heroSynergyIndex || {}).filter(([k]) => !/^boss(Disabled|LowValue)$/.test(k)).filter(([, ids]) => Array.isArray(ids) && ids.includes(h.id)).map(([k]) => k.replace(/^buffs/, 'buffs ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
      return {
        name: h.name, buffTypes: buckets, troopsItBuffsByFamily: fam,
        bestFormations: _formationsWith(h.id, false).concat(_formationsWith(h.id, true)).slice(0, 4),
        rule: 'A battle holds 2 heroes in total (a Mythical counts as one of the two) and at most 1 Mythical' + (isMythical(h) ? ` — ${h.name} IS Mythical, so the one other hero must be non-Mythical.` : ' — this hero plus at most one partner.'),
      };
    }
    case 'boss': {
      const b = bossStatusOfHero(h);
      const hf = STRAT.bossHeroFit || {};
      return {
        name: h.name, bossUse: b.status, why: b.note, goal: hf.goal,
        scoringPrinciple: _scoring().principle, syncRule: _scoring().syncRule,
        buffsReachingBossTroops: b.status === 'disabled' ? undefined : _bossSync(h),
        levelValues: b.status === 'disabled' ? undefined : { talent: _eff(h.talent && h.talent.levelStats), ability: _eff(h.ability && (h.ability.levelStats || h.ability.byLevel)) },
        bossFormations: _formationsWith(h.id, true),
        ccRule: _scoring().ccRule, rule: '2 heroes in total per battle, at most 1 Mythical.',
      };
    }
    case 'arena': {
      const disabledInBoss = bossStatusOfHero(h).status === 'disabled';
      return {
        name: h.name, role: A.primaryRole, type: h.type,
        ..._arenaInfo(h),
        arenaPrinciple: (STRAT.arenaScoring || {}).principle, heroRule: (STRAT.arenaScoring || {}).heroRule,
        pvpNote: disabledInBoss ? 'Works in PvP/Arena (its boss-battle effect is disabled).' : undefined,
        arenaFormations: _formationsWith(h.id, false),
        rule: '2 heroes in total per battle, at most 1 Mythical.',
      };
    }
    case 'troops':
      return {
        name: h.name, recommendedTroops: h.recommendedTroops,
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
      return { name: t.name, heroesThatBuffIt: bossOK.slice(0, 8), recommendedHeroes: t.recommendedHeroes, rule: '2 heroes in total per battle, at most 1 Mythical.' };
    }
    case 'boss': {
      const m = STRAT.bossTroopMeta || {};
      const low = (m.lowImpactTroops || []).some(x => cn(x) === cn(t.name));
      const nm = cn(t.name);
      const tier = ['legendary', 'epic', 'rare'].find(k => { const v = m[k]; const list = Array.isArray(v) ? v : (v && v.tier) || []; return list.some(x => cn(x) === nm || nm.startsWith(cn(x)) || cn(x).startsWith(nm)); });
      const tags = _tags(t);
      const aoeLow = (m.aoeLowBoss || []).some(x => cn(x) === nm);
      const trait = Object.entries(m.traits || {}).find(([k]) => cn(k) === nm || nm.startsWith(cn(k)) || cn(k).startsWith(nm));
      return {
        name: t.name, rarity: t.rarity, bossTier: tier || 'not in boss meta list',
        impact: low ? 'LOW boss impact — do not pick for bosses' + (m.lowImpactNote && /pyrotech/i.test(t.name) ? '' : ' (' + (trait ? trait[1] : 'dies early / no sustained damage') + ')') : aoeLow ? 'LOW boss value — AoE strength is wasted on a single boss target (good in Arena)' : tier ? 'listed in boss meta' : 'neutral',
        bossTrait: trait && trait[1],
        scoringPrinciple: _scoring().principle, aoeRule: _scoring().aoeRule,
        damageAtLv10: _squad(t), damageRank: _squadRank(t),
        survivability: _hpInfo(t),
        damageType: tags.has('ranged') ? 'Ranged' : tags.has('melee') ? 'Melee' : 'unknown',
        resistanceRule: 'Each boss resists either Melee or Ranged by 30% and it rotates per season — field the OPPOSITE type as main damage.',
        priority: 'Legendary > Epic > Rare > Common',
      };
    }
    case 'arena':
      return { name: t.name, line: t.combatLine, type: t.type, role: A.primaryRole, strengths: A.strengths, weaknesses: A.weaknesses, scaling: A.scaling, tags: t.tags, aoeRadius: t.baseStats && t.baseStats.aoeRadius, crowdControl: _ccInfo(t.ability) || 'none', arenaPrinciple: (STRAT.arenaScoring || {}).principle, troopRule: (STRAT.arenaScoring || {}).troopRule };
    default: return null;
  }
}


// ── identity + per-facet answer guides (stops the model guessing what the entity IS) ──
const FACET_GUIDE = {
  summary: 'Short intro: role, talent, ability, one-line verdict.',
  talent:  'Short intro: role, talent, ability, one-line verdict.',
  ability: 'Explain what the ability does, how it scales Lv1->Lv10, and one-line verdict. Do not repeat the role.',
  synergy: 'Answer ONLY synergy: which troop families it buffs, the best formations/partner heroes from data and why. Pick exactly ONE partner hero (2 heroes in total per battle); mention the Mythical limit only if the hero or partner is Mythical. Do NOT restate role/talent/ability.',
  boss:    'Answer ONLY boss-battle use. First line = verdict from bossUse (disabled / damage / sustain / low / neutral) with the reason in "why". Then which formations/troops fit and what the player should do. Remember the boss goal is damage score: judge by scoringPrinciple (troops deal the damage; the hero is valuable only through buffsReachingBossTroops + levelValues). For troops use bossTrait, damageAtLv10 and aoeRule. Do NOT restate role/talent/ability.',
  arena:   'Answer ONLY PvP/Arena/Clan Clash use (NEVER mention boss damage score here). Explain in simple words for a clan member: (1) buffs it gives troops, (2) its crowd control / ability-disable (kinds + durations from the data) and why that matters against a real lineup, (3) hero-vs-hero value, (4) best formations/partners from data. Do NOT restate role/talent/ability.',
  troops:  'Answer ONLY which troops to field with this hero (recommendedTroops + families it buffs) and why. Do NOT restate role/talent/ability.',
  heroes:  'Answer ONLY which heroes pair best with this troop and why. Respect: 2 heroes in total per battle, at most 1 Mythical.',
};
const HERO_BOSS_GUIDE = 'Answer ONLY boss-battle use of this hero. First line = verdict from bossUse (disabled / damage / sustain / low / neutral) in plain words with the reason from "why". Then: what its talent/ability buffs and which listed boss troops it reaches (buffsReachingBossTroops), the level values if given, and which formation fits. A hero\'s own damage is irrelevant (troops deal 99.8%), so judge only by what the buff does for the troops. If a part reaches "none of the boss-meta troops", say it adds nothing there. Do NOT restate role/talent/ability and do NOT discuss troop stats.';
const TROOP_ARENA_GUIDE = 'Answer ONLY Arena/PvP/Clan Clash use of this troop, in simple words for a clan member: how its strengths/weaknesses play out against a real lineup, its crowd control or ability-disable if listed (crowdControl), whether its AoE helps (enemies bunch up, unlike a boss), and what to pair it with. NEVER mention boss damage score. Do NOT restate role/ability.';
const TROOP_BOSS_GUIDE = 'Answer ONLY boss-battle use of this troop, in simple words for a clan member. First line = verdict from impact / bossTier. Then: damage per unit x units at Lv10 and its rank (damageAtLv10, damageRank), survivability (hp and rank — a troop that dies early stops dealing damage), its special trait (bossTrait), why AoE does not help on a single boss, and the Melee/Ranged resistance advice. Do NOT restate role/ability.';
const HERO_TROOPS_GUIDE = 'Answer ONLY which troops to field with this hero. recommendedTroops are the picks; troopsItBuffsByFamily lists the troops whose faction/tag matches the hero\'s buff target, grouped by troop class — the buff is the hero\'s talent target (e.g. Mage units), NOT a tank/support-specific boost, so do not invent class-specific effects. Do NOT mention partner heroes or Mythical limits here.';
function _identity(type, raw) {
  const A = raw.analysis || {};
  if (type === 'hero') {
    return {
      kind: 'HERO (a player unit, never an enemy boss)', name: raw.name, rarity: raw.rarity, faction: raw.faction, type: raw.type, role: A.primaryRole,
      talent: raw.talent && `${raw.talent.name}: ${clip(raw.talent.description, 110)}`,
      ability: raw.ability ? `${raw.ability.name}: ${clip(raw.ability.description, 110)}` : 'none',
    };
  }
  return {
    kind: 'TROOP (a player unit, never an enemy boss)', name: raw.name, rarity: raw.rarity, type: raw.type, line: raw.combatLine, role: A.primaryRole,
    ability: raw.ability ? `${raw.ability.name}: ${clip(raw.ability.description, 110)}` : 'none (plain attacker/defender)',
  };
}
function _ctx(type, raw, lang, facets, wanted) {
  const ctx = { facetMode: true, replyLanguage: lang === 'h' ? 'Roman Hinglish' : 'English', entity: raw.name };
  const intro = !wanted && (facets.includes('summary'));
  if (!intro) ctx.identity = _identity(type, raw);
  facets.forEach(f => { ctx[f === 'summary' ? 'summaryData' : f + 'Data'] = getFacet(type, keyOf(raw), f); });
  let g = intro ? FACET_GUIDE.summary : (FACET_GUIDE[wanted] || FACET_GUIDE.summary);
  if (wanted === 'boss' && type === 'hero') g = HERO_BOSS_GUIDE;
  if (wanted === 'troops' && type === 'hero') g = HERO_TROOPS_GUIDE;
  if (wanted === 'arena' && type === 'troop') g = TROOP_ARENA_GUIDE;
  if (wanted === 'boss' && type === 'troop') g = TROOP_BOSS_GUIDE;
  ctx.answerGuide = g + ' Never print raw field names (like damageAtLv10, aoeRule, bossUse); say it in plain words. Use only listed data; if something is not listed, just skip it.';
  return ctx;
}
const keyOf = raw => idKey(raw);

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
const HINGLISH = /\b(kya|hai|hain|ka|ki|ke|ko|karo|karna|karu|karun|batao|bata|btao|kaise|kaisa|kaisi|mein|nahi|nhi|aur|kon|konsa|konse|uski|uska|iski|iska|kare|karti|karta|hota|hoti|chahiye|lagta|accha|acha|bhai)\b/i;
const langOf = text => (HINGLISH.test(text || '') ? 'h' : 'e');

/**
 * Decide if this routed message is a plain single-entity question we can answer from facets.
 * Returns { type, key, facets:[...], context, lang, shown } or null (→ keep the old full-context path).
 */
// ── multi-hero decision (e.g. "Anavin or Keyra for Dagon, I use Lirael") ───────────────────────
const ARENA_WORDS = /\b(arena|pvp|clash|war|raid|duel)\b/i;
function _compareHero(h, goal) {
  const part = p => p && ({ name: p.name, what: clip(p.description, 240), ...((p.levelStats || p.byLevel) ? { perLevel: _eff(p.levelStats || p.byLevel) } : { effectsLv1toLv10: _eff(p.effects) }), reaches: p.targets && p.targets.length ? p.targets : 'nobody (self / enemy effect only)' });
  const o = { name: h.name, rarity: h.rarity, faction: h.faction, mythical: isMythical(h), talent: part(h.talent), ability: part(h.ability) };
  if (goal === 'boss') {
    const b = bossStatusOfHero(h);
    o.bossUse = b.status; o.bossWhy = b.note;
    if (b.status !== 'disabled') o.buffsReachingBossTroops = _bossSync(h);
  } else if (goal === 'arena') {
    Object.assign(o, _arenaInfo(h));
  } else {
    const b = bossStatusOfHero(h); o.bossUse = b.status; o.bossWhy = b.note; Object.assign(o, _arenaInfo(h));
  }
  return o;
}
function planCompare(gameResult, text) {
  try {
    const en = gameResult && gameResult.entities;
    if (!en) return null;
    const names = en.heroNames || [];
    if (names.length < 2 || (en.troopNames || []).length > 4) return null;
    const ents = names.map(findEntity).filter(e => e && e.type === 'hero');
    if (ents.length < 2) return null;
    const bossM = String(text).match(BOSS_NAMES);
    const goal = (bossM || /\bboss\b/i.test(text)) ? 'boss' : (ARENA_WORDS.test(text) ? 'arena' : 'general');
    const low = norm(text);
    // "with lireal" / "lireal ke saath" -> that hero is the player's fixed partner, not a candidate
    const fixed = ents.filter(e => {
      const toks = [norm(e.raw.name).split(' ')[0], norm(String(e.raw.id || '').replace(/_\d+$/, '').replace(/_/g, ' ')).split(' ')[0]].map(t => t.slice(0, 4)).filter(t => t.length >= 4);
      return toks.some(t => new RegExp('\\b(with|saath|sath|along)\\s+\\w*' + t).test(low) || new RegExp(t + '\\w*\\s+(ke\\s+)?(saath|sath)').test(low));
    }).map(e => e.raw.name);
    const lang = langOf(text);
    const ctx = {
      facetMode: true, replyLanguage: lang === 'h' ? 'Roman Hinglish' : 'English', compareMode: true, goal,
      boss: bossM ? bossM[1].toUpperCase() : undefined,
      bossMoves: bossM ? (STRAT.bossMoveGuide || {})[bossM[1].toUpperCase()] : undefined,
      heroes: ents.map(e => _compareHero(e.raw, goal)),
      playerAlreadyUses: fixed.length ? fixed : undefined,
      troopsNamed: (en.troopNames || []).length ? (en.troopNames || []).map(n => { const e = findEntity(n); return e && e.type === 'troop' ? { name: e.raw.name, bossImpact: troopFacet(e.raw, 'boss').impact } : null; }).filter(Boolean) : undefined,
      rules: goal === 'boss'
        ? { scoring: _scoring().principle, sync: _scoring().syncRule, cc: _scoring().ccRule, battle: '2 heroes in total per battle, at most 1 Mythical. Harkon and Fire Fury Xana do nothing in boss battles.' }
        : goal === 'arena'
          ? { arena: (STRAT.arenaScoring || {}).principle, hero: (STRAT.arenaScoring || {}).heroRule, battle: '2 heroes in total per battle, at most 1 Mythical.' }
          : { boss: _scoring().principle, arena: (STRAT.arenaScoring || {}).principle, battle: '2 heroes in total per battle, at most 1 Mythical.' },
    };
    ctx.answerGuide = 'The player asks which hero is better (a choice). Write for a clan member in simple words, a bit detailed. Structure: (1) first line = the pick and the one-line reason. (2) one bullet per candidate hero: what its talent/ability buffs, how big (use the level numbers given), and whether the buff reaches the troops that matter for this goal (reachesBossTroops / reaches). (3) a bullet on the other candidate\'s weakness for this goal. (4) one bullet on how it combines with the hero the player already uses (playerAlreadyUses) — that hero is NOT a candidate; just check the pair is legal (2 heroes total, max 1 Mythical). ' + (goal === 'boss' ? 'BOSS: troops deal ~99.8% of the damage, so judge a hero ONLY by buffs that reach the troops; a hero\'s own damage and crowd control are not valuable. Mention a boss move only if it changes the pick.' : goal === 'arena' ? 'ARENA: judge by buffs AND crowd control/ability-disable against a real lineup, plus hero-vs-hero value.' : 'Cover boss and arena separately in one bullet each.') + ' Never print raw field names. Use only listed data; skip what is not listed.';
    return { type: 'compare', key: 'compare', facets: ['compare'], context: ctx, lang, shown: [], name: ents.map(e => e.raw.name).join(' vs '), compare: true };
  } catch (_) { return null; }
}

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
    const context = _ctx(ent.type, ent.raw, lang, facets, wanted);
    return { type: ent.type, key: ent.key, facets, context, lang, shown: wanted ? [wanted] : [], name: ent.raw.name };
  } catch (_) { return null; }
}

/** Context for a button click. */
function buttonContext(type, key, facet, lang) {
  const e = byKey(type, key);
  if (!e || !getFacet(type, key, facet)) return null;
  return { name: e.raw.name, context: _ctx(type, e.raw, lang, [facet], facet) };
}

module.exports = {
  FACET_VERSION, bossStatusOfHero, planCompare, findEntity, getFacet, facetsFor, makeId, parseId, buttonSpecs, planFirstTurn, buttonContext, langOf,
};
