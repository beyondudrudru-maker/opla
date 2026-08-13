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

// Pulls direct synergy links for a matched hero/troop out of gameData.synergies,
// matched loosely by id (troopHeroSynergy is keyed by troopId/heroId) so this
// stays resilient to minor shape drift instead of hard-failing on a mismatch.
function findSynergyLinks(entity, synergies) {
  if (!entity || !synergies || !Array.isArray(synergies.troopHeroSynergy)) return [];

  const links = [];
  const entityId = entity.id;

  for (const record of synergies.troopHeroSynergy) {
    // Entity is the troop side of this record.
    if (entityId && record.troopId === entityId && Array.isArray(record.heroSynergies)) {
      record.heroSynergies.forEach(h => links.push({ heroId: h.heroId, reason: h.reason }));
      continue;
    }
    // Entity is one of the hero side matches for some other troop.
    if (Array.isArray(record.heroSynergies)) {
      const match = record.heroSynergies.find(h => h.heroId === entityId);
      if (match) links.push({ troopId: record.troopId, reason: match.reason });
    }
  }

  return links.slice(0, 8); // keep the bundle lean
}

/**
 * extractTargetedContext(userMessage, gameData)
 *
 * Scans userMessage for troop/hero/boss name mentions inside a full-size
 * gameData dump and returns a minimal Context Bundle:
 *   {
 *     matchedHeroes:  [ ...compressed entity records... ],
 *     matchedTroops:  [ ... ],
 *     matchedBosses:  [ ... ],
 *     synergyLinks:   [ { heroId|troopId, reason } ... ],
 *     bossModifiers:  GENERIC_BOSS_MODIFIERS | null
 *   }
 *
 * Returns null if gameData isn't a full-database shape (nothing to trim) or
 * if no entities were matched (caller should fall back to whatever curated
 * context it already has rather than injecting an empty bundle).
 */
function extractTargetedContext(userMessage, gameData) {
  if (!gameData || typeof gameData !== 'object' || !isFullDatabaseShape(gameData)) {
    return null;
  }

  const matchedHeroes = findMentionedEntities(userMessage, gameData.heroes).map(compressEntityStats);
  const matchedTroops = findMentionedEntities(userMessage, gameData.troops).map(compressEntityStats);
  const matchedBosses = findMentionedEntities(userMessage, gameData.bosses);

  const synergyLinks = [...matchedHeroes, ...matchedTroops]
    .flatMap(entity => findSynergyLinks(entity, gameData.synergies));

  const mentionsBossGenerically = /\bboss(es)?\b/i.test(String(userMessage || ''));
  const bossModifiers = matchedBosses.length > 0
    ? null // real boss record already carries its own specific rules/resistance
    : (mentionsBossGenerically ? GENERIC_BOSS_MODIFIERS : null);

  const bundle = {
    matchedHeroes,
    matchedTroops,
    matchedBosses,
    synergyLinks,
    bossModifiers
  };

  const isEmpty =
    matchedHeroes.length === 0 &&
    matchedTroops.length === 0 &&
    matchedBosses.length === 0 &&
    !bossModifiers;

  return isEmpty ? null : bundle;
}

function renderGameContext(gameData, userMessage) {
  if (!gameData) return '';

  if (typeof gameData === 'string') {
    return `<GameData>\n${gameData}\n</GameData>`;
  }

  // 🎯 Backstop: if this looks like a raw/full database dump, narrow it down
  // to just what the current message actually references before compressing
  // further. Curated context objects (the normal case, built upstream by
  // gameDomainRouter/strategyContextBuilder) are left to the existing
  // compression path since they're already targeted.
  const targeted = extractTargetedContext(userMessage, gameData);
  const compressed = compressGameData(targeted || gameData);

  // 🗜️ Minified — no `null, 2` pretty-print — to keep GameData block as
  // token-lean as possible on top of the stat compression above.
  const content = JSON.stringify(compressed);
  return `<GameData>\n${content}\n</GameData>`;
}

/**
 * 🚀 GAME FAST-LANE: minimal assembly path.
 * Only relationship framing (cheap, no memory lookups) + the deterministic
 * game data + the current message. No LongTermMemory, no ChatHistory, no
 * EmotionalState, no AudienceTarget, no BehaviorDirectives — those are the
 * blocks that dilute model attention and cause troop/hero name mixups.
 */
function assembleLean({ relationship, gameData, userMessage, speakerName }) {
  const blocks = [
    renderRelationshipFraming(relationship || {}),
    renderGameContext(gameData, userMessage),
    `\n<CurrentMessage speaker="${sanitize(speakerName || 'User')}">\n${sanitize(userMessage)}\n</CurrentMessage>`,
  ];

  return blocks.filter(Boolean).join('\n');
}

function assemble({
  leanMode,
  emotionalBrief,
  relationship,
  behaviorDirective,
  rankedMemories,
  workingMemory,
  gameData,
  userMessage,
  targetInfo,
  speakerName
}) {
  if (leanMode) {
    return assembleLean({ relationship, gameData, userMessage, speakerName });
  }

  // Assemble the blocks using clean XML structures that modern LLMs parse perfectly
  const promptBlocks = [
    emotionalBrief ? `<EmotionalState>${sanitize(emotionalBrief)}</EmotionalState>` : '',
    renderRelationshipFraming(relationship),
    renderTargetBlock(targetInfo),
    renderTaskDirective(behaviorDirective),
    renderGameContext(gameData, userMessage),
    renderMemoryBlock(rankedMemories),
    renderWorkingMemory(workingMemory),
    `\n<CurrentMessage speaker="${sanitize(speakerName || 'User')}">\n${sanitize(userMessage)}\n</CurrentMessage>`
  ];

  // Instantly removes any empty blocks to save tokens, and joins with newlines
  return promptBlocks.filter(Boolean).join('\n');
}

module.exports = {
  assemble,
  compressGameData,       // exported for unit testing / reuse in gameDomainRouter.js if needed
  extractTargetedContext, // exported for unit testing / reuse elsewhere in the pipeline
};
