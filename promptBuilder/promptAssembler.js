/**
 * promptBuilder/promptAssembler.js
 *
 * PURPOSE
 *   Final lightweight prompt composer.
 *   Acts purely as a "dumb" assembler snapping pre-rendered blocks together.
 *   🚀 UPGRADE: Advanced XML escaping, Game Data injection, stricter behavioral
 *   mapping, and a `leanMode` path for the Game Fast-Lane (drops memory/history/
 *   emotional/target blocks entirely so game queries get a minimal, high-signal
 *   prompt with zero persona bleed).
 *   🗜️ UPGRADE: GameData compression — 10-level stat arrays / {min,max} range
 *   objects on heroes & troops are collapsed to Level-10/max-only values before
 *   injection, and the block is minified (no pretty-print) to fix 413 Request
 *   Entity Too Large errors from Groq/Gemini once full stat curves were added.
 */

// 🛡️ SECURITY & STABILITY: Escapes XML tags while preserving newlines and spacing.
// This prevents prompt injection while ensuring code snippets or text formatting aren't destroyed!
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderRelationshipFraming(relationship = {}) {
  const tierMap = {
    creator: 'Creator',
    vip: 'VIP',
    admin: 'Admin',
    moderator: 'Moderator',
    troublemaker: 'Reserved',
    regular: 'Regular',
    unknown: 'Polite',
  };

  const tier = tierMap[relationship.tier] || 'Member';
  const familiarity = relationship.familiarity > 50 ? 'High' : 'Low';

  return `<UserContext tier="${tier}" familiarity="${familiarity}" />`;
}

function renderMemoryBlock(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  const content = memories
    .slice(0, 10)
    .map(m => sanitize(m?.content))
    .filter(Boolean)
    .join(' | ');

  return content ? `<LongTermMemory>\n${content}\n</LongTermMemory>` : '';
}

function renderWorkingMemory(workingMemory) {
  if (!Array.isArray(workingMemory) || workingMemory.length === 0) return '';

  const lines = workingMemory
    .slice(-10)
    .map(t => {
      const role = t.role === 'melody' ? 'Melody' : 'User';
      return `[${role}]: ${sanitize(t.content)}`;
    })
    .join('\n');

  return lines ? `<ChatHistory>\n${lines}\n</ChatHistory>` : '';
}

function renderTargetBlock(targetInfo) {
  if (!targetInfo) return '';

  if (targetInfo.addressingEveryone) {
    return '<AudienceTarget>Group (Everyone)</AudienceTarget>';
  }

  if (targetInfo.hasThirdPartyTarget) {
    const targets = (targetInfo.targets || [])
      .slice(0, 5)
      .map(t => sanitize(t.name))
      .filter(Boolean)
      .join(', ');

    return targets ? `<AudienceTarget>${targets}</AudienceTarget>` : '';
  }

  return '';
}

function renderTaskDirective(behavior = {}) {
  const directives = [];

  if (behavior.targetLength) directives.push(`Target Length: ${behavior.targetLength}`);
  if (behavior.mode) directives.push(`Operational Mode: ${behavior.mode}`);
  if (Array.isArray(behavior.tone) && behavior.tone.length) directives.push(`Required Tone: ${behavior.tone.join(', ')}`);
  if (behavior.emojiBudget !== undefined) directives.push(`Max Emojis: ${behavior.emojiBudget}`);
  if (behavior.preferReact) directives.push(`Action: Acknowledge politely`);
  if (behavior.askFollowUp) directives.push(`Action: End with an engaging follow-up question`);
  if (Array.isArray(behavior.forbidTraits) && behavior.forbidTraits.length) directives.push(`STRICTLY AVOID: ${behavior.forbidTraits.join(', ')}`);

  return directives.length ? `<BehaviorDirectives>\n${directives.join('\n')}\n</BehaviorDirectives>` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// 🗜️ GameData Compression
// ─────────────────────────────────────────────────────────────────────────────
// Strategy routing only needs the Level-10 ceiling for hp/defense/attack, not
// the full leveling curve. This collapses both known stat shapes:
//   - Array of per-level values: [lvl1, lvl2, ..., lvl10]  -> "Max: <lvl10>"
//   - Range object: { min, max }                            -> "Max: <max>"
// down to a single string, cutting payload size substantially once full stat
// arrays were added to heroes.js/troops.js. Non-stat fields (synergies, gear,
// boss records, talents, etc.) pass through untouched.
const STAT_KEYS = ['hp', 'defense', 'attack'];

function compressStatValue(stat) {
  if (Array.isArray(stat)) {
    if (stat.length === 0) return stat;
    const max = stat[stat.length - 1];
    return `Max: ${typeof max === 'number' ? max.toLocaleString() : max}`;
  }

  if (stat && typeof stat === 'object' && 'max' in stat) {
    const max = stat.max;
    return `Max: ${typeof max === 'number' ? max.toLocaleString() : max}`;
  }

  // Already a scalar (single number/string) — leave as-is.
  return stat;
}

function compressEntityStats(entity) {
  if (!entity || typeof entity !== 'object') return entity;

  const compressed = { ...entity };

  for (const key of STAT_KEYS) {
    if (key in compressed) {
      compressed[key] = compressStatValue(compressed[key]);
    }
  }

  // Some records nest per-level stats under statLevels/stats rather than
  // flat top-level fields — handle that shape too.
  for (const nestKey of ['statLevels', 'stats']) {
    if (compressed[nestKey] && typeof compressed[nestKey] === 'object') {
      const nested = { ...compressed[nestKey] };
      for (const key of STAT_KEYS) {
        if (key in nested) {
          nested[key] = compressStatValue(nested[key]);
        }
      }
      compressed[nestKey] = nested;
    }
  }

  return compressed;
}

function compressCollection(list) {
  if (!Array.isArray(list)) return list;
  return list.map(compressEntityStats);
}

/**
 * compressGameData(data)
 * Deep-clones the incoming game data (never mutates the original in-memory
 * database) and replaces bulky per-level stat data on heroes/troops with a
 * single max-value string. Handles both a top-level array of entities and an
 * object wrapping known list keys (heroes, troops, mentionedHeroes,
 * mentionedTroops, bossRecords) or a single entity object. Anything without a
 * recognizable stat shape passes through unchanged.
 */
function compressGameData(data) {
  if (!data || typeof data !== 'object') return data;

  const cloned = JSON.parse(JSON.stringify(data));

  if (Array.isArray(cloned)) {
    return compressCollection(cloned);
  }

  const KNOWN_ENTITY_LISTS = ['heroes', 'troops', 'mentionedHeroes', 'mentionedTroops', 'bossRecords'];

  for (const key of KNOWN_ENTITY_LISTS) {
    if (Array.isArray(cloned[key])) {
      cloned[key] = compressCollection(cloned[key]);
    }
  }

  // Single-entity keys — strategyContextBuilder.js embeds full hero/troop
  // records directly under these names rather than in a list.
  const KNOWN_ENTITY_SINGLES = ['recognizedHero', 'recognizedTroop', 'hero1', 'hero2', 'troop1', 'troop2', 'troop', 'entityA', 'entityB'];
  for (const key of KNOWN_ENTITY_SINGLES) {
    if (cloned[key] && typeof cloned[key] === 'object' && !Array.isArray(cloned[key])) {
      cloned[key] = compressEntityStats(cloned[key]);
    }
  }

  // Array-of-candidates keys (e.g. findBestHeroesForTroop's compatibleHeroes).
  const KNOWN_CANDIDATE_LISTS = ['compatibleHeroes'];
  for (const key of KNOWN_CANDIDATE_LISTS) {
    if (Array.isArray(cloned[key])) {
      cloned[key] = compressCollection(cloned[key]);
    }
  }

  // Single hero/troop object passed directly (not wrapped in a list key).
  if (STAT_KEYS.some(k => k in cloned) || cloned.statLevels || cloned.stats) {
    return compressEntityStats(cloned);
  }

  return cloned;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 Targeted Context Extraction (413-prevention, pass 2)
// ─────────────────────────────────────────────────────────────────────────────
// gameDomainRouter.js already does the heavy lifting of resolving entities per
// message. This second pass exists as a backstop for callers that hand
// promptAssembler a raw/full-size data dump (e.g. `heroes`/`troops`/`bosses`
// arrays straight from the database) instead of an already-curated context
// object. When that shape is detected, we scan the raw userMessage for name
// mentions and rebuild a minimal bundle: matched entity + its direct synergy
// links + generic boss modifiers if relevant. Anything already curated
// (no full top-level `heroes`/`troops` arrays) passes straight through to the
// existing compression path untouched.

const FULL_DB_LIST_KEYS = ['heroes', 'troops', 'bosses'];
const MIN_FULL_DB_LENGTH = 5; // below this, treat as an already-small/curated list, not a full dump

// 🛡️ Defensive require — gearData.js lives in a sibling data/ directory.
// Guarded so a missing file or path mismatch just skips gear recommendations
// instead of crashing prompt assembly entirely.
let gearData = null;
try {
  gearData = require('../data/gearData.js');
} catch (e) {
  gearData = null;
}

// Collapses a gear piece's 20+ entry per-level scaling arrays down to just
// the highest observed level + value, same 413-prevention pattern as
// compressStatValue/compressEntityStats above.
function compressGearEntry(gear) {
  if (!gear || typeof gear !== 'object') return gear;

  const compressed = { ...gear };
  if (compressed.passive && typeof compressed.passive === 'object' && compressed.passive.scaling) {
    const scaling = compressed.passive.scaling;
    const levels = Array.isArray(scaling.level) ? scaling.level : [];
    const maxLevel = levels.length ? levels[levels.length - 1] : null;

    const compressedScaling = { maxLevel };
    for (const key of Object.keys(scaling)) {
      if (key === 'level') continue;
      const arr = scaling[key];
      if (Array.isArray(arr) && arr.length) {
        compressedScaling[key] = arr[arr.length - 1];
      }
    }

    compressed.passive = { ...compressed.passive, scaling: compressedScaling };
  }
  return compressed;
}

// Cross-references matched heroes/troops against gearData.js and returns one
// entry per entity: either its matched gear (compressed) or the exact
// SMART_GEAR_FALLBACK advice, so the AI never has to guess when no dedicated
// gear exists for a role yet.
function buildGearRecommendations(matchedHeroes, matchedTroops) {
  if (!gearData) return [];

  const recs = [];

  matchedTroops.forEach(troop => {
    const { matchedGear, fallbackNote } = gearData.recommendGearForTroop(troop) || {};
    recs.push({
      entity: troop.name,
      entityType: 'troop',
      matchedGear: (matchedGear || []).map(compressGearEntry),
      fallbackNote: fallbackNote || null
    });
  });

  matchedHeroes.forEach(hero => {
    const { matchedGear, fallbackNote } = gearData.recommendGearForHero(hero) || {};
    recs.push({
      entity: hero.name,
      entityType: 'hero',
      matchedGear: (matchedGear || []).map(compressGearEntry),
      fallbackNote: fallbackNote || null
    });
  });

  return recs;
}

const GENERIC_BOSS_MODIFIERS = {
  note: 'Generic boss-fight modifiers (no specific boss entity matched, but the message referenced a boss).',
  rules: [
    'Every boss resists either Melee or Ranged damage (~30% protection); the active type rotates each season and must be confirmed in-game before committing to a comp.',
    'Prioritize high single-target DPS and sustain (healing/shields); bosses punish squishy backlines.',
    'Front-load tank/defense units and stagger cooldown-based burst rather than spending it all at once.'
  ]
};

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFullDatabaseShape(gameData) {
  return FULL_DB_LIST_KEYS.some(
    key => Array.isArray(gameData[key]) && gameData[key].length > MIN_FULL_DB_LENGTH
  );
}

// Finds entities in `list` whose `name` appears as a whole word in userMessage.
function findMentionedEntities(userMessage, list) {
  if (!Array.isArray(list) || !userMessage) return [];
  const text = String(userMessage).toLowerCase();

  return list.filter(entity => {
    const name = entity && typeof entity.name === 'string' ? entity.name.trim() : '';
    if (!name) return false;
    const re = new RegExp(`\\b${escapeForRegex(name.toLowerCase())}\\b`);
    return re.test(text);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 Indexed Synergy Lookups (O(1) instead of O(n) per call)
// ─────────────────────────────────────────────────────────────────────────────
// The previous findSynergyLinks() re-scanned the entire troopHeroSynergy
// array on every single call — for a busy bot resolving many messages, that's
// a full-array walk per matched entity per message. Since the caller passes
// a `synergies` object in on every request (rather than this module always
// seeing the exact same one from a top-level require), a plain
// module-load-time index would silently go stale if a different/updated
// synergies object were ever passed in. A WeakMap keyed by the synergies
// object itself gets the best of both: the index is built ONCE per distinct
// synergies object (first call pays the O(n) cost, every subsequent call
// against that same object is O(1)), and if a different synergies object is
// ever passed (e.g. hot-reloaded data), it transparently gets its own fresh
// index instead of returning stale results.
const _synergyIndexCache = new WeakMap();

function _buildSynergyIndex(synergies) {
  const byTroopId = new Map(); // troopId -> [{ heroId, reason }]
  const byHeroId = new Map();  // heroId  -> [{ troopId, reason }]

  if (Array.isArray(synergies.troopHeroSynergy)) {
    for (const record of synergies.troopHeroSynergy) {
      if (!record || !Array.isArray(record.heroSynergies)) continue;

      const heroLinks = record.heroSynergies.map(h => ({ heroId: h.heroId, reason: h.reason }));
      if (record.troopId) {
        const existing = byTroopId.get(record.troopId) || [];
        byTroopId.set(record.troopId, existing.concat(heroLinks));
      }

      for (const h of record.heroSynergies) {
        if (!h || !h.heroId) continue;
        const existing = byHeroId.get(h.heroId) || [];
        existing.push({ troopId: record.troopId, reason: h.reason });
        byHeroId.set(h.heroId, existing);
      }
    }
  }

  return { byTroopId, byHeroId };
}

function _getSynergyIndex(synergies) {
  let index = _synergyIndexCache.get(synergies);
  if (!index) {
    index = _buildSynergyIndex(synergies);
    _synergyIndexCache.set(synergies, index);
  }
  return index;
}

// Pulls direct synergy links for a matched hero/troop out of gameData.synergies
// via the cached reverse index above — O(1) lookup after the first call for a
// given synergies object, instead of an O(n) scan of troopHeroSynergy every
// time. Output shape/order is unchanged from the original scan-based version.
function findSynergyLinks(entity, synergies) {
  if (!entity || !synergies || !Array.isArray(synergies.troopHeroSynergy)) return [];

  const entityId = entity.id;
  if (!entityId) return [];

  const { byTroopId, byHeroId } = _getSynergyIndex(synergies);

  const asTroop = byTroopId.get(entityId) || [];
  const asHero = byHeroId.get(entityId) || [];

  return [...asTroop, ...asHero].slice(0, 8); // keep the bundle lean
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔗 Tag-Overlap Synergy Fallback
// ─────────────────────────────────────────────────────────────────────────────
// findSynergyLinks() above only returns curated troopHeroSynergy entries. Not
// every troop/hero in the roster has a curated entry (synergies.js only lists
// entries that were manually written), so an uncurated entity currently gets
// an empty synergyLinks array even though synergies.js's own indexes already
// contain enough tag/category data to derive a reasonable generic link.
// This fallback is driven entirely by shared tags/category — never by an
// entity's specific name — so it works identically for any troop or hero.
//
// Mapping used: indexes.heroesBySupportFocusPrimary is keyed by phrases like
// "Mage Troops" / "Undead Troops" / "Human Troops" — each of those embeds a
// troop faction/category name. A troop whose own tags/category/type include
// that faction name is a tag-overlap match for every hero listed under that
// key. This mirrors the exact reasoning pattern already used by hand-written
// troopHeroSynergy entries (e.g. "Hero buffs allied Undead troops; troop
// belongs to Undead"), just derived generically instead of authored by hand.
// Strips one trailing "s" for a lightweight, conservative singular/plural
// normalization — mirrors the same deliberately-simple approach already used
// by gameIntentClassifier.js's _stripTrailingS, so "Mages" (troop tag) and
// "Mage" (inside the "Mage Troops" index key) compare equal without pulling
// in a stemming library.
function _singularize(str) {
  return String(str).toLowerCase().replace(/s$/, '');
}

function _entityCategoryTags(entity) {
  if (!entity || typeof entity !== 'object') return [];
  const raw = [
    entity.type,
    entity.category,
    entity.faction,
    entity.combatLine,
    ...(Array.isArray(entity.tags) ? entity.tags : []),
    ...(Array.isArray(entity.synergyCategories) ? entity.synergyCategories : [])
  ].filter(Boolean);
  return raw.map(t => String(t).toLowerCase());
}

function findTagOverlapSynergyLinks(entity, synergies) {
  if (!entity || !synergies || !synergies.indexes) return [];

  const entityTags = _entityCategoryTags(entity);
  const links = [];

  // Troop side: find heroes whose supportFocus phrase embeds one of this
  // troop's own category tags (e.g. troop tag "Undead"/"Mages" -> key
  // "Undead Troops"/"Mage Troops"). Compared on singularized forms so plural
  // tags ("Mages") still match a singular phrase word ("Mage"). Skipped
  // entirely (not an early-return from the whole function) when the entity
  // has no category tags of its own — the independent hero-side block below
  // must still get a chance to run for hero entities.
  if (entityTags.length > 0) {
    const supportFocusIndex = synergies.indexes.heroesBySupportFocusPrimary || {};
    const focusLowerSingularCache = new Map();
    for (const [focusPhrase, heroIds] of Object.entries(supportFocusIndex)) {
      if (!focusLowerSingularCache.has(focusPhrase)) {
        focusLowerSingularCache.set(
          focusPhrase,
          focusPhrase.toLowerCase().split(/\s+/).map(_singularize)
        );
      }
      const focusWordsSingular = focusLowerSingularCache.get(focusPhrase);
      const matchedTag = entityTags.find(tag => {
        if (tag.length <= 2) return false;
        const tagSingular = _singularize(tag);
        return focusWordsSingular.includes(tagSingular);
      });
      if (matchedTag && Array.isArray(heroIds)) {
        heroIds.forEach(heroId => links.push({
          heroId,
          reason: `Derived from shared tag "${matchedTag}": hero's supportFocus is "${focusPhrase}", which this entity's own category/tags match.`,
          derived: true
        }));
      }
    }
  }

  // Hero side: if this entity IS a hero (has a supportFocus of its own),
  // find troops tagged with the category embedded in that supportFocus phrase.
  const heroFocusPhrase = entity.supportFocus || (entity.analysis && entity.analysis.supportFocus);
  if (heroFocusPhrase && synergies.indexes.troopsByTag) {
    const focusWordsSingular = String(heroFocusPhrase).toLowerCase().split(/\s+/).map(_singularize);
    for (const [tag, troopIds] of Object.entries(synergies.indexes.troopsByTag)) {
      const tagSingular = _singularize(tag);
      if (tag.length > 2 && focusWordsSingular.includes(tagSingular) && Array.isArray(troopIds)) {
        troopIds.forEach(troopId => links.push({
          troopId,
          reason: `Derived from shared tag "${tag}": this hero's supportFocus is "${heroFocusPhrase}", which matches the troop's own category tag.`,
          derive