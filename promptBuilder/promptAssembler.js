/**
 * promptBuilder/promptAssembler.js
 *
 * PURPOSE
 *   Final lightweight prompt composer.
 *   Acts purely as a "dumb" assembler snapping pre-rendered blocks together.
 *   🚀 UPGRADE: Advanced XML escaping, Game Data injection, stricter behavioral mapping.
 *   🚀 UPGRADE: Explicitly injects Discord <@ID> mentionTags into the Audience block.
 *   🚀 UPGRADE: Strict Prompt Budgeting using safeTruncate to prevent 413/400 errors.
 *   🚀 UPGRADE: Intent-Based Context Isolation to stop game hallucinations in normal chats.
 *   🚀 UPGRADE: Dynamic Persona Muting for factual/technical intents.
 *   🛡️ UPGRADE: Hard Character Ceiling (Max 16,000 chars) to comfortably fit complex tasks.
 *   🧠 UPGRADE: Hard ceiling is now configurable via `maxPromptChars`, driven by
 *   context/contextBudgetManager. The 16,000 constant below is only the
 *   fallback default for any caller that doesn't pass a budget profile.
 */

// 🛡️ SECURITY & STABILITY: Escapes XML tags and quotes while preserving newlines.
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 🗜️ STRICT BUDGETING UTILITY: Prevents payload explosion from huge chat logs
function safeTruncate(content, maxLength, keepEnd = false) {
  if (!content) return '';
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  
  if (str.length <= maxLength) return str;
  
  if (keepEnd) {
      return '... [TRUNCATED] ...\n' + str.substring(str.length - maxLength);
  }
  return str.substring(0, maxLength) + '... [TRUNCATED]';
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
      const roleName = t.role === 'melody' ? 'Melody' : (t.playerName || t.name || 'User');
      return `[${roleName}]: ${sanitize(t.content)}`;
    })
    .join('\n');

  return lines ? `<ChatHistory>\n${lines}\n</ChatHistory>` : '';
}

function renderTargetBlock(targetInfo) {
  if (!targetInfo) return '';

  if (targetInfo.addressingEveryone) {
    return '<AudienceTarget>Group (Everyone) - MUST USE: @everyone</AudienceTarget>';
  }

  if (targetInfo.hasThirdPartyTarget) {
    const targets = (targetInfo.targets || [])
      .slice(0, 5)
      .map(t => `${sanitize(t.name)} -> MUST USE TAG: ${t.mentionTag}`)
      .filter(Boolean)
      .join('\n');

    return targets ? `<AudienceTarget>\n${targets}\n</AudienceTarget>` : '';
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
// 🗜️ GameData Compression & Context Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STAT_KEYS = ['hp', 'defense', 'attack'];
const SYNERGY_LINK_CAP = 4;
const GEAR_ITEM_CAP = 3;

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

  const KNOWN_ENTITY_SINGLES = ['recognizedHero', 'recognizedTroop', 'hero1', 'hero2', 'troop1', 'troop2', 'troop', 'entityA', 'entityB'];
  for (const key of KNOWN_ENTITY_SINGLES) {
    if (cloned[key] && typeof cloned[key] === 'object' && !Array.isArray(cloned[key])) {
      cloned[key] = compressEntityStats(cloned[key]);
    }
  }

  const KNOWN_CANDIDATE_LISTS = ['compatibleHeroes'];
  for (const key of KNOWN_CANDIDATE_LISTS) {
    if (Array.isArray(cloned[key])) {
      cloned[key] = compressCollection(cloned[key]);
    }
  }

  if (STAT_KEYS.some(k => k in cloned) || cloned.statLevels || cloned.stats) {
    return compressEntityStats(cloned);
  }

  return cloned;
}

const FULL_DB_LIST_KEYS = ['heroes', 'troops', 'bosses'];
const MIN_FULL_DB_LENGTH = 5; 
const MIN_FULL_DB_LENGTH_BY_KEY = { bosses: 2 };

let gearData = null;
try {
  gearData = require('../data/gearData.js');
} catch (e) {
  gearData = null;
}

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

function buildGearRecommendations(matchedHeroes, matchedTroops) {
  if (!gearData) return [];

  const recs = [];

  matchedTroops.forEach(troop => {
    const { matchedGear, fallbackNote } = gearData.recommendGearForTroop(troop) || {};
    recs.push({
      entity: troop.name,
      entityType: 'troop',
      matchedGear: (matchedGear || []).slice(0, GEAR_ITEM_CAP).map(compressGearEntry),
      fallbackNote: fallbackNote || null
    });
  });

  matchedHeroes.forEach(hero => {
    const { matchedGear, fallbackNote } = gearData.recommendGearForHero(hero) || {};
    recs.push({
      entity: hero.name,
      entityType: 'hero',
      matchedGear: (matchedGear || []).slice(0, GEAR_ITEM_CAP).map(compressGearEntry),
      fallbackNote: fallbackNote || null
    });
  });

  return recs;
}

const GENERIC_BOSS_MODIFIERS = {
  note: 'Generic boss-fight modifiers.',
  rules: [
    'Every boss resists either Melee or Ranged damage (~30% protection).',
    'Prioritize high single-target DPS and sustain.',
    'Front-load tank/defense units.'
  ]
};

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFullDatabaseShape(gameData) {
  return FULL_DB_LIST_KEYS.some(key => {
    const threshold = MIN_FULL_DB_LENGTH_BY_KEY[key] ?? MIN_FULL_DB_LENGTH;
    return Array.isArray(gameData[key]) && gameData[key].length > threshold;
  });
}

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

function _buildSynergyIndex(synergies) {
  const byTroopId = new Map(); 
  const byHeroId = new Map();  

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

const _synergyIndexCache = new WeakMap();
function _getSynergyIndex(synergies) {
  let index = _synergyIndexCache.get(synergies);
  if (!index) {
    index = _buildSynergyIndex(synergies);
    _synergyIndexCache.set(synergies, index);
  }
  return index;
}

function findSynergyLinks(entity, synergies) {
  if (!entity || !synergies || !Array.isArray(synergies.troopHeroSynergy)) return [];

  const entityId = entity.id;
  if (!entityId) return [];

  const { byTroopId, byHeroId } = _getSynergyIndex(synergies);

  const asTroop = byTroopId.get(entityId) || [];
  const asHero = byHeroId.get(entityId) || [];

  return [...asTroop, ...asHero].slice(0, SYNERGY_LINK_CAP);
}

function resolveSynergyLinks(entity, synergies) {
  const curated = findSynergyLinks(entity, synergies);
  if (curated.length > 0) return curated;
  return [];
}

function extractTargetedContext(userMessage, gameData) {
  if (!gameData || typeof gameData !== 'object' || !isFullDatabaseShape(gameData)) {
    return null;
  }

  const matchedHeroes = findMentionedEntities(userMessage, gameData.heroes).map(compressEntityStats);
  const matchedTroops = findMentionedEntities(userMessage, gameData.troops).map(compressEntityStats);
  const matchedBosses = findMentionedEntities(userMessage, gameData.bosses || []);

  const synergyLinks = [...matchedHeroes, ...matchedTroops]
    .flatMap(entity => resolveSynergyLinks(entity, gameData.synergies));

  const gearRecommendations = buildGearRecommendations(
    findMentionedEntities(userMessage, gameData.heroes),
    findMentionedEntities(userMessage, gameData.troops)
  );

  const mentionsBossGenerically = /\bboss(es)?\b/i.test(String(userMessage || ''));
  const bossModifiers = matchedBosses.length > 0
    ? null 
    : (mentionsBossGenerically ? GENERIC_BOSS_MODIFIERS : null);

  const bundle = {
    matchedHeroes,
    matchedTroops,
    matchedBosses,
    synergyLinks,
    gearRecommendations,
    bossModifiers
  };

  const isEmpty =
    matchedHeroes.length === 0 &&
    matchedTroops.length === 0 &&
    matchedBosses.length === 0 &&
    !bossModifiers;

  return isEmpty ? null : bundle;
}

const UI_ONLY_KEYS = new Set([
  'icon', 'iconUrl', 'iconURL', 'imageUrl', 'imageURL', 'thumbnail', 'thumbnailUrl',
  'avatarUrl', 'portraitUrl', 'artUrl', 'artworkUrl', 'bannerUrl', 'color', 'colour'
]);

function _isEmptyContainer(v) {
  if (Array.isArray(v)) return v.length === 0;
  if (v && typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function deepCompress(value) {
  if (Array.isArray(value)) {
    return value
      .map(deepCompress)
      .filter(v => v !== null && v !== undefined && !_isEmptyContainer(v));
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (UI_ONLY_KEYS.has(key)) continue;
      const compressedVal = deepCompress(val);
      if (compressedVal === null || compressedVal === undefined) continue;
      if (_isEmptyContainer(compressedVal)) continue;
      out[key] = compressedVal;
    }
    return out;
  }

  return value;
}

const GAME_CONTEXT_SOFT_CAP_CHARS = 4000;

function renderGameContext(gameData, userMessage) {
  if (!gameData) return '';
  if (typeof gameData === 'string') {
    return `<GameData>\n${gameData}\n</GameData>`;
  }

  const targeted = extractTargetedContext(userMessage, gameData);
  const compressed = deepCompress(compressGameData(targeted || gameData));
  let content = JSON.stringify(compressed);

  if (content.length > GAME_CONTEXT_SOFT_CAP_CHARS) {
    content = content.substring(0, GAME_CONTEXT_SOFT_CAP_CHARS) + '...[truncated]';
  }

  return `<GameData>\n${content}\n</GameData>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 MAIN ASSEMBLER LOGIC WITH CONFIGURABLE CHARACTER CEILING
// ─────────────────────────────────────────────────────────────────────────────
// Fallback default only — real callers (decisionPipeline.js) pass
// maxPromptChars from contextBudgetManager's per-tier profile instead.
const MAX_PROMPT_CHARS = 16000;

function assembleLean({ intent, relationship, gameData, userMessage, targetInfo, speakerName, recentChatLog, maxPromptChars = MAX_PROMPT_CHARS }) {
  const currentIntent = String(intent || '').toLowerCase();
  const factualIntents = ['question', 'heavy-task', 'heavy_task'];

  const blocks = [
    renderRelationshipFraming(relationship || {}),
    renderTargetBlock(targetInfo), 
    factualIntents.includes(currentIntent) ? '<SystemOverride>Provide a strictly factual, objective response.</SystemOverride>' : '',
    renderGameContext(gameData, userMessage),
    recentChatLog ? `<RecentChatLog>\n${sanitize(safeTruncate(recentChatLog, 800, true))}\n</RecentChatLog>` : '', 
    `\n<CurrentMessage speaker="${sanitize(speakerName || 'User')}">\n${sanitize(userMessage)}\n</CurrentMessage>`,
  ];

  const rawLean = blocks.filter(Boolean).join('\n');
  return rawLean.length > maxPromptChars ? rawLean.substring(rawLean.length - maxPromptChars) : rawLean;
}

function assemble({
  intent,
  leanMode,
  emotionalBrief,
  relationship,
  behaviorDirective,
  rankedMemories,
  workingMemory,
  chatSummary, 
  gameData,
  userMessage,
  targetInfo,
  speakerName,
  recentChatLog,
  maxPromptChars = MAX_PROMPT_CHARS
}) {
  if (leanMode) {
    return assembleLean({ intent, relationship, gameData, userMessage, targetInfo, speakerName, recentChatLog, maxPromptChars });
  }

  const currentIntent = String(intent || '').toLowerCase();
  const factualIntents = ['question', 'heavy-task', 'heavy_task'];
  const gameIntents = ['game-query', 'strategy', 'game', 'calc', 'fact'];

  const promptBlocks = [
    factualIntents.includes(currentIntent) ? '<SystemOverride>Provide a strictly factual, objective response.</SystemOverride>' : '',
    emotionalBrief ? `<EmotionalState>${sanitize(emotionalBrief)}</EmotionalState>` : '',
    renderRelationshipFraming(relationship),
    renderTargetBlock(targetInfo),
    renderTaskDirective(behaviorDirective),
    (gameData && gameIntents.includes(currentIntent)) ? renderGameContext(gameData, userMessage) : '',
    rankedMemories ? renderMemoryBlock(rankedMemories) : '',
    workingMemory ? renderWorkingMemory(workingMemory) : '',
    chatSummary ? `<PreviousChatSummary>\n${sanitize(safeTruncate(chatSummary, 800))}\n</PreviousChatSummary>` : '',
    recentChatLog ? `<RecentChatLog>\n${sanitize(safeTruncate(recentChatLog, 800, true))}\n</RecentChatLog>` : '', 
    `\n<CurrentMessage speaker="${sanitize(speakerName || 'User')}">\n${sanitize(userMessage)}\n</CurrentMessage>`
  ];

  const finalPrompt = promptBlocks.filter(Boolean).join('\n');

  // 🛡️ HARD CEILING GUARD: Trims oldest blocks if total prompt exceeds the
  // budget-provided ceiling (falls back to 16,000 chars if none was passed).
  if (finalPrompt.length > maxPromptChars) {
      console.warn(`⚠️ [PROMPT ASSEMBLER] Prompt exceeded ${maxPromptChars} chars (${finalPrompt.length}). Hard trimming from top...`);
      return finalPrompt.substring(finalPrompt.length - maxPromptChars);
  }

  return finalPrompt;
}

module.exports = {
  assemble,
  compressGameData,         
  extractTargetedContext, 
  resolveSynergyLinks,    
  deepCompress,           
};
