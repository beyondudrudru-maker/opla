/**
 * router/gameDomainRouter.js
 *
 * PURPOSE: Resolves user queries into visual Embed Cards AND passes strict
 * deterministic data contexts to the AI pipeline for deep, hallucination-free
 * strategic analysis.
 *
 * UPGRADES IN THIS VERSION
 * ─────────────────────────
 * 1. Scunthorpe-Proof Scraper  — all entity name matches use strict \b word
 *    boundaries; the no-space typo pass is gated at > 4 chars to prevent
 *    short names like "Imp" or "Ash" from matching inside longer words.
 *
 * 2. Category & Tag Counting   — when the user asks "how many tank troops"
 *    or "list all mages", getTroopsByCategory() / getHeroesByRole() are called
 *    and the structured result is injected into <GameData> so the AI never
 *    has to guess at roster counts.
 *
 * 3. Boss & Scenario Routing   — "dagon", "kraken", "kalidor", "balthazar",
 *    "ashira" always bind to scenarioGuides / bosses.js entries. The boss
 *    block runs unconditionally before counter/synergy gating.
 *
 * 4. Output Formatting         — all strategy responses use clean vertical
 *    bullet lists (•). Markdown tables are never emitted by this router.
 *
 * 5. Smart Embed + AI Co-existence — pure entity/fact lookups (single hero
 *    card, single troop card, 1v1 comparisons) NEVER short-circuit with
 *    `resolved: true` anymore. The only path that still returns
 *    `resolved: true` is a strict dashboard command — text starting with
 *    `!` — which is intentionally silent/mechanical and has no AI voice.
 *    Everything else falls through with `resolved: false` + `embeds`
 *    attached, so the AI pipeline always adds a conversational/analytical
 *    layer on top of the visual card instead of leaving it cold and silent.
 *
 * 6. Context Window Protection — mentionedHeroes / mentionedTroops are only
 *    passed as full raw JSON objects when 3 or fewer are mentioned in one
 *    message. Beyond that threshold, every entity (the full list, not just
 *    the overflow) is compacted into a lightweight Summary Object
 *    (name, rarity, primaryRole, talentName) so a message that pings 10
 *    heroes at once can't blow up the LLM's context window.
 *
 * 7. Deep Question Detector — messages that open with or heavily feature
 *    "why", "how", "explain", or "what makes" are forced into STRATEGY
 *    intent even when they'd otherwise look like a simple FACT lookup, so
 *    the AI's reasoning pipeline (not the flat fact-card path) handles them.
 *
 * 8. Pillar 1 — Missing Data Protocol (Heuristic Fallbacks): boss/entity
 *    queries that come back null from queryEngine no longer produce an
 *    empty context. A `heuristicFallback` block with general category-level
 *    strategic guidance is injected instead, so the AI always has *something*
 *    grounded to reason from rather than hallucinating specifics.
 *
 * 9. Pillar 2 — Confidence Scoring: when the entity scraper's only hit is a
 *    short name (<= 4 chars, e.g. "Imp", "Orc") AND the classified intent is
 *    BANTER/SOCIAL rather than STRATEGY/FACT, the router flags
 *    `needsClarification: true` instead of confidently dumping stats, so the
 *    behaviorEngine/AI can lightly confirm intent first.
 *
 * 10. Regex/dictionary consolidation — the large inline regex walls for
 *     synergy/counter/category/boss detection are now grouped into commented
 *     dictionary blocks up top (INTENT_PATTERNS, CATEGORY_KEYWORDS,
 *     BOSS_KEYWORDS) for easier long-term maintenance.
 */

const { EmbedBuilder } = require('discord.js');
const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');

const ecoModule = require('../data/economyRatios.js');
const economyRatios = ecoModule.economyRatios || ecoModule;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — Boss & Category Keyword Lists
// ─────────────────────────────────────────────────────────────────────────────

const BOSS_KEYWORDS = ['dagon', 'kraken', 'kalidor', 'balthazar', 'ashira'];

// Category/role keywords that trigger roster-count enrichment.
// Keep this list in sync with the categories and roles defined in troops.js / heroes.js.
const CATEGORY_KEYWORDS = [
  'tank', 'tanks',
  'mage', 'mages',
  'archer', 'archers',
  'ranger', 'rangers',
  'assassin', 'assassins',
  'support',
  'healer', 'healers',
  'summoner', 'summoners',
  'debuffer', 'debuffers',
  'controller', 'controllers',
  'undead',
  'human',
  'beast', 'beasts',
  'dreads',
  'elevates',
  'melee',
  'ranged'
];

// Generic tag list for scenario / category matching against hero/troop records.
const GAME_TAGS = ['tank', 'mage', 'archer', 'undead', 'human', 'beast', 'support', 'melee', 'ranged', 'ranger', 'summoner', 'assassin', 'boss', 'pvp', 'defense'];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — Heuristic Fallback Library (Pillar 1)
// ─────────────────────────────────────────────────────────────────────────────
// General, category-level strategic guidance used ONLY when a specific boss or
// entity lookup returns null from queryEngine. Keeps the AI grounded in a
// sound general principle instead of inventing specifics for missing data.
const HEURISTIC_FALLBACKS = {
  boss: {
    summary: 'Specific boss data is unavailable for this target.',
    generalRule: 'Prioritize high single-target DPS and sustain (healing/shields). Bosses typically punish squishy backlines, so front-load tank/defense units and stagger cooldown-based burst rather than committing it all at once.'
  },
  hero: {
    summary: 'This hero could not be found in the local database.',
    generalRule: 'Without verified stats, recommend the user double-check the spelling or confirm the hero exists in the current roster rather than guessing at a talent, ability, or rarity.'
  },
  troop: {
    summary: 'This troop could not be found in the local database.',
    generalRule: 'Without verified stats, recommend the user double-check the spelling/level or confirm the troop exists in the current roster rather than guessing at stats.'
  },
  category: {
    summary: 'No specific data was found for this category.',
    generalRule: 'General army-composition principle: balance frontline tanks, mid-line sustained damage, and backline burst/control rather than stacking a single role.'
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTENT_PATTERNS — Consolidated regex dictionary
// ─────────────────────────────────────────────────────────────────────────────
// All the large inline regex walls from the previous version are grouped here
// as named, commented patterns. Each is compiled once at module load.
const INTENT_PATTERNS = {
  // Synergy / "best paired with" style queries — multilingual variants included
  // to match existing user base phrasing (Hinglish, Spanish, Portuguese, French, Indonesian).
  // Synergy / "best paired with" style queries — multilingual variants included
  // to match existing user base phrasing (Hinglish, Spanish, Portuguese, French, Indonesian).
  // 🆕 FIX: "best hero for X" / "best troop for X" is extremely natural
  // phrasing that was previously NOT caught by this pattern — it only had
  // "best with", not "best hero for" / "best troop for" / "best X for Y".
  // This caused genuine synergy questions (e.g. "best hero for Bonebreaker")
  // to silently fall through with isSynergyQuery=false, so SCENARIO B's
  // hero/troop synergy matching never ran even though the underlying data
  // and matching logic were both correct — the query just never reached them.
  synergy: /\b(best with|best (hero|troop|heroes|troops)\s+(for|to use|to pair)|synergy|alongside|use with|pair(ed)?\s+with|combination|combo|formation|weapon|armor|equipment|gear|which hero|which troop|which troops|konse hero|konse troop|kiske sath|accha outcome|mejor con|melhor com|meilleur avec|terbaik dengan|sinergia|synergie)\b/i,

  // Counter / "how do I beat" style queries — multilingual variants included.
  counter: /\b(counter|beat|against|harana|opponents?|enemy|enemies|kill|defeat|samne)\b/i,

  // Category/roster count queries — "how many tank troops", "list all mages", etc.
  categoryCountA: /\b(how many|list|all|count|total|what|which)\b.{0,40}\b(troop|hero|unit|mage|tank|archer|healer|summoner|debuffer|ranger|controller|assassin)\b/i,
  categoryCountB: /\b(mage|tank|archer|healer|summoner|debuffer|ranger|controller|assassin)s?\b.{0,30}\b(list|count|all|total|we have|available|roster)\b/i,

  // 🆕 Macro/Taxonomy queries — asking about the classification system itself
  // rather than a specific category, e.g. "how many roles are there",
  // "what types of categories exist", "all factions", "what are the tags".
  // Deliberately distinct from categoryCountA/B, which require a specific
  // known keyword (tank/mage/etc.) — this one fires on the meta-question.
  taxonomyQuery: /\b(how many|what|which|list|all)\b.{0,40}\b(roles?|categories|category|factions?|tags?|classifications?|types? of (troop|hero|unit|role|categor))\b/i,

  // Pronoun / follow-up resolution trigger — multilingual variants included.
  followUp: /\b(uska|iske|woh|he|she|it|they|him|her|this|that|its|stats|ability|skill)\b/i,

  // Fact-style follow-up disambiguation ("what's its ability", "how much hp").
  factFollowUp: /\b(ability|skill|stat|stats|hp|damage|health)\b/i,

  // Explicit "X vs Y" comparison phrasing.
  explicitVs: /(?:.+?)\s+vs\s+(?:.+)/i,
  vsSplit: /(.+?)\s+vs\s+(.+)/i,

  // Equipment/gear guide queries.
  equipment: /\b(weapon|armor|equipment|gear|item|items)\b/i,

  // Generic scenario/fight/boss phrasing used for loose scenario matching.
  genericScenario: /\b(scenario|fight|boss)\b/i,

  // Dashboard/mechanical commands — strict prefix, never gets an AI voice.
  dashboardCommand: /^!/,

  // 🆕 Deep Question Detector — messages that open with or heavily feature
  // "why", "how", "explain", "what makes" get forced into STRATEGY intent so
  // the AI's reasoning pipeline (not the flat fact-card path) handles them.
  deepQuestionLead: /^\s*(why|how|explain|what makes)\b/i,
  deepQuestionAnywhere: /\b(why|how does|how do|explain|what makes)\b/i
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _detectCategoryQueries(text)
 * Returns the unique set of category/role keywords explicitly mentioned in text.
 * Uses strict word-boundary matching so "ranged" doesn't match "arranged".
 */
function _detectCategoryQueries(text) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const kw of CATEGORY_KEYWORDS) {
    // Singular form of plural keyword for canonical lookup
    const canonical = kw.replace(/s$/, '');
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      found.add(canonical);
    }
  }
  return Array.from(found);
}

/**
 * _isCategoryCountQuery(text)
 * Returns true when the message is asking for a count or list of a category
 * ("how many tank troops", "list all mages", "what mages do we have").
 */
function _isCategoryCountQuery(text) {
  return INTENT_PATTERNS.categoryCountA.test(text) || INTENT_PATTERNS.categoryCountB.test(text);
}

/**
 * _isTaxonomyQuery(text)
 * Pillar / Feature: Macro/Taxonomy Detector.
 * True when the user is asking about the game's classification system
 * itself ("how many roles are there", "what factions exist", "list all
 * categories") rather than asking about one specific known category value.
 * Distinct from _isCategoryCountQuery, which fires on a named keyword like
 * "tank" or "mage" — this fires on the meta-question about the taxonomy.
 */
function _isTaxonomyQuery(text) {
  return INTENT_PATTERNS.taxonomyQuery.test(text);
}

/**
 * _isDeepQuestion(text)
 * Pillar / Feature: Deep Question Detector.
 * True when the message opens with, or heavily features, a reasoning-style
 * question word ("why", "how", "explain", "what makes"). Used to force
 * STRATEGY intent even over what would otherwise look like a flat FACT query.
 */
function _isDeepQuestion(text) {
  return INTENT_PATTERNS.deepQuestionLead.test(text) || INTENT_PATTERNS.deepQuestionAnywhere.test(text);
}

/**
 * _isDashboardCommand(text)
 * Strict dashboard commands (bot-prefix `!` commands) are the ONLY path
 * allowed to short-circuit with `resolved: true` — they're intentionally
 * silent/mechanical (e.g. `!inventory`, `!setrole`) and were never meant to
 * carry the bot's conversational persona.
 */
function _isDashboardCommand(text) {
  return INTENT_PATTERNS.dashboardCommand.test(text.trim());
}

/**
 * _toHeroSummary(hero) / _toTroopSummary(troop)
 * Pillar / Feature: Context Window Protection.
 * Compacts a full hero/troop record down to the minimal fields the AI needs
 * to reason about it in bulk: Name, Rarity, Primary Role, Talent Name.
 * Used whenever more than 3 heroes/troops are mentioned in a single message.
 */
function _toHeroSummary(hero) {
  if (!hero) return null;
  return {
    name: hero.name || 'Unknown',
    rarity: hero.rarity || 'N/A',
    primaryRole: (hero.analysis && hero.analysis.primaryRole) || hero.type || hero.faction || 'N/A',
    talentName: (hero.talent && hero.talent.name) || 'N/A'
  };
}

function _toTroopSummary(troop) {
  if (!troop) return null;
  return {
    name: troop.name || 'Unknown',
    rarity: troop.rarity || 'N/A',
    primaryRole: (troop.analysis && troop.analysis.primaryRole) || troop.type || troop.faction || 'N/A',
    talentName: (troop.talent && troop.talent.name) || (troop.ability && troop.ability.name) || 'N/A'
  };
}

/**
 * _isShortAmbiguousName(name)
 * Pillar 2: Confidence Scoring.
 * Flags very short entity names (<= 4 chars) as low-confidence matches —
 * these are the names most likely to have fired off common-word collisions
 * elsewhere in the pipeline (e.g. "Imp", "Orc", "Ash").
 */
function _isShortAmbiguousName(name) {
  return typeof name === 'string' && name.replace(/\s+/g, '').length <= 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────────────────────────────────────

function route(text, recentContext = '', userCorrections = []) {
  let { intent, entities } = classify(text);
  entities.rawText = text;

  // ── Normalised text variants used throughout ──────────────────────────────
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const textNoSpace    = text.toLowerCase().replace(/[^a-z0-9]/g, '');

  // ── Seed array fields ─────────────────────────────────────────────────────
  if (!entities.heroNames)  entities.heroNames  = [];
  if (!entities.troopNames) entities.troopNames = [];
  if (entities.heroName  && !entities.heroNames.includes(entities.heroName))   entities.heroNames.push(entities.heroName);
  if (entities.troopName && !entities.troopNames.includes(entities.troopName)) entities.troopNames.push(entities.troopName);

  const allKnownHeroes = typeof queryEngine.findHeroes === 'function' ? queryEngine.findHeroes() : [];
  const allKnownTroops = typeof queryEngine.findTroops === 'function' ? queryEngine.findTroops() : [];

  // ── 🐙 BOSS / SCENARIO INSTANT-RECOGNITION ────────────────────────────────
  // Must run BEFORE entity scraping and BEFORE synergy/counter regex so that
  // phrasing like "how do I beat dagon" or "against balthazar" is never
  // misrouted into the PvP counter branch.
  const matchedBossKeywords = BOSS_KEYWORDS.filter(k => {
    const wordBoundaryHit = new RegExp(`\\b${k}\\b`, 'i').test(normalizedText);
    const noSpaceHit      = textNoSpace.includes(k);   // catches "Dagon's", "Dagon-Boss"
    return wordBoundaryHit || noSpaceHit;
  });
  const isBossQuery = matchedBossKeywords.length > 0;

  // ── 🛡️ SCUNTHORPE-PROOF ENTITY SCRAPER ───────────────────────────────────
  // Rule 1: word-boundary match is always tried.
  // Rule 2: no-space typo match is ONLY used when the name (no spaces) is > 4
  //         chars, preventing short names ("Imp", "Ash", "Kai") from firing on
  //         unrelated words ("wish him praise him", "crashes", "kaise").
  allKnownHeroes.forEach(h => {
    const hName        = h.name.toLowerCase();
    const hNameNoSpace = hName.replace(/\s+/g, '');
    const safeName     = hName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = hNameNoSpace.length > 4 && textNoSpace.includes(hNameNoSpace);

    if ((exactMatch || typoMatch) && !entities.heroNames.some(e => e.toLowerCase() === hName)) {
      entities.heroNames.push(h.name);
    }
  });

  allKnownTroops.forEach(t => {
    const tName        = t.name.toLowerCase();
    const tNameNoSpace = tName.replace(/\s+/g, '');
    const safeName     = tName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = tNameNoSpace.length > 4 && textNoSpace.includes(tNameNoSpace);

    if ((exactMatch || typoMatch) && !entities.troopNames.some(e => e.toLowerCase() === tName)) {
      entities.troopNames.push(t.name);
    }
  });

  if (entities.heroNames.length  > 0) entities.heroName  = entities.heroNames[0];
  if (entities.troopNames.length > 0) entities.troopName = entities.troopNames[0];

  // ── Intent signal detection ───────────────────────────────────────────────

  const isSynergyQuery = INTENT_PATTERNS.synergy.test(text);
  const isCounterQuery = INTENT_PATTERNS.counter.test(text);

  // Category count detection
  const categoryKeywordsInText = _detectCategoryQueries(text);
  const isCategoryQuery        = _isCategoryCountQuery(text) || categoryKeywordsInText.length > 0;

  // 🆕 Deep Question Detector
  const isDeepQuestion = _isDeepQuestion(text);

  // 🆕 Macro/Taxonomy Detector — "how many roles are there", "all factions",
  // "what are the tags". Checked independently of isCategoryQuery since a
  // taxonomy question may not mention any specific known category keyword.
  const isTaxonomyQuery = _isTaxonomyQuery(text);

  // Force STRATEGY intent for synergy / counter / boss / category / deep-question / taxonomy queries
  if (isSynergyQuery || isCounterQuery || isBossQuery || isCategoryQuery || isDeepQuestion || isTaxonomyQuery) {
    intent = 'STRATEGY';
  }

  // ── Pillar 2: CONFIDENCE SCORING ──────────────────────────────────────────
  // If the ONLY entity hits are short/ambiguous names (<= 4 chars, e.g. "Imp",
  // "Orc") and the classifier's original read on the message was social/banter
  // rather than a genuine strategy/fact intent, don't confidently dump stats —
  // flag it so behaviorEngine/AI can lightly confirm intent first. This check
  // runs against the ORIGINAL classified intent (before the STRATEGY-forcing
  // above), since that's the signal that tells us whether the user actually
  // sounded like they were asking about the game.
  const originalIntentWasSocial = ['BANTER', 'SOCIAL', 'UNKNOWN'].includes(
    (classify(text).intent || '').toUpperCase ? classify(text).intent : ''
  );
  const allMatchedNames = [...entities.heroNames, ...entities.troopNames];
  const onlyShortAmbiguousMatches = allMatchedNames.length > 0 && allMatchedNames.every(_isShortAmbiguousName);
  const needsClarification = onlyShortAmbiguousMatches
    && !isSynergyQuery && !isCounterQuery && !isBossQuery && !isCategoryQuery && !isDeepQuestion && !isTaxonomyQuery
    && originalIntentWasSocial;

  // ── Pronoun / follow-up resolution ───────────────────────────────────────
  const hasFollowUpTrigger = INTENT_PATTERNS.followUp.test(text);

  if (hasFollowUpTrigger && !entities.troopName && !entities.heroName && (!entities.heroNames || entities.heroNames.length === 0)) {
    const pastEntities = resolveEntities(recentContext);
    if (pastEntities.troopName)  entities.troopName  = pastEntities.troopName;
    if (pastEntities.heroName)   entities.heroName   = pastEntities.heroName;
    if (pastEntities.troopNames && pastEntities.troopNames.length > 0) entities.troopNames = pastEntities.troopNames;
    if (pastEntities.heroNames  && pastEntities.heroNames.length  > 0) entities.heroNames  = pastEntities.heroNames;
    if (pastEntities.levels     && pastEntities.levels.length     > 0 && (!entities.levels || entities.levels.length === 0)) {
      entities.levels = pastEntities.levels;
    }
    if (intent === 'UNKNOWN' && INTENT_PATTERNS.factFollowUp.test(text)) {
      intent = 'FACT';
    } else if (intent === 'UNKNOWN') {
      intent = 'STRATEGY';
    }
  }

  // ── 💰 GOLD / GEM ENGINE ─────────────────────────────────────────────────
  // Dashboard-style deterministic output. Stays resolved:true only because it
  // is a pure calculator response with no room for conversational analysis —
  // matches the "strict dashboard command" carve-out described above.
  if (intent === 'GOLD' || intent === 'GEM') {
    const isGold  = intent === 'GOLD';
    const ratios  = isGold ? economyRatios.gold : economyRatios.gems;
    const amountMatch = text.match(/\b(\d+k?|\d+)\b/i);

    const embed = new EmbedBuilder()
      .setColor(isGold ? '#FFD700' : '#2ECC71')
      .setTitle(isGold ? '💰 Ultimate Gold Blueprint' : '💎 Premium Gem Matrix');

    if (amountMatch) {
      let amountStr = amountMatch[1].toLowerCase();
      let amount    = amountStr.includes('k') ? parseInt(amountStr) * 1000 : parseInt(amountStr);
      embed.setDescription(`**Calculated Spending Plan for ${amount.toLocaleString()} ${isGold ? 'Gold' : 'Gems'}**`);
      for (const [category, pct] of Object.entries(ratios)) {
        embed.addFields({ name: `${category} (${pct}%)`, value: Math.round(amount * (pct / 100)).toLocaleString(), inline: true });
      }
    } else {
      embed.setDescription('**Optimal Spending Ratios**');
      for (const [category, pct] of Object.entries(ratios)) {
        embed.addFields({ name: category, value: `${pct}%`, inline: true });
      }
    }
    return { resolved: true, embeds: [embed] };
  }

  let prebuiltEmbeds = [];
  const isDashboardCommand = _isDashboardCommand(text);

  // ── 📝 FACT & SINGLE ENTITY ENGINE ───────────────────────────────────────
  if (['FACT', 'UNKNOWN', 'QUESTION', 'STRATEGY', 'game-query'].includes(intent)) {

    // Single hero card
    if (
      (entities.heroName || (entities.heroNames && entities.heroNames.length === 1)) &&
      !entities.troopName && (!entities.troopNames || entities.troopNames.length === 0)
    ) {
      const heroQuery = entities.heroName || entities.heroNames[0];
      const entity    = queryEngine.findEntityByName(heroQuery);

      if (entity && entity.type === 'hero') {
        const hero  = entity.data;
        const embed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`🦸‍♂️ ${hero.name}`)
          .addFields(
            { name: 'Faction',     value: hero.faction || 'N/A',                                  inline: true },
            { name: 'Rarity',      value: hero.rarity  || 'N/A',                                  inline: true },
            { name: '❤️ HP',       value: hero.stats?.hp      ? hero.stats.hp.toLocaleString()  : 'N/A', inline: true },
            { name: '🛡️ Defense', value: String(hero.stats?.defense || 'N/A'),                   inline: true },
            { name: '⚔️ Attack',  value: hero.stats?.attack  ? hero.stats.attack.toLocaleString(): 'N/A', inline: true }
          );
        if (hero.talent) {
          embed.addFields({ name: `🌟 Talent: ${hero.talent.name}`, value: hero.talent.description });
        }
        if (hero.ability && hero.ability.description) {
          embed.addFields({ name: `✨ Ability: ${hero.ability.name || 'Skill'}`, value: hero.ability.description });
        }

        // 🆕 SMART EMBED + AI CO-EXISTENCE: pure entity/fact lookups never
        // short-circuit anymore. Only a strict `!` dashboard command is
        // allowed to bypass the AI pipeline with resolved:true.
        prebuiltEmbeds.push(embed);
        if (isDashboardCommand) {
          return { resolved: true, embeds: [embed] };
        }
      } else {
        // 🆕 PILLAR 1 — Missing Data Protocol: hero name matched but not found.
        // (Rare — scraper only adds names it found in allKnownHeroes — but
        // covers the case where findEntityByName's lookup diverges from the
        // scraper's own list, e.g. a stale cache.)
      }
    }

    // Single troop card
    if (
      (entities.troopName || (entities.troopNames && entities.troopNames.length === 1)) &&
      !entities.heroName && (!entities.heroNames || entities.heroNames.length === 0)
    ) {
      const troopQuery = entities.troopName || entities.troopNames[0];
      const lvl        = (entities.levels && entities.levels.length > 0) ? entities.levels[0] : 10;
      const data       = queryEngine.getTroopLevel(troopQuery, lvl);

      if (data) {
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle(`📜 ${data.troopName} (Lv. ${data.level})`)
          .addFields(
            { name: '❤️ HP',      value: data.hp?.toLocaleString()      || 'N/A', inline: true },
            { name: '⚔️ Damage', value: data.damage?.toLocaleString()   || 'N/A', inline: true },
            { name: '🛡️ Defense',value: String(data.defense             || 'N/A'), inline: true },
            { name: '👥 Units',   value: String(data.units              || 1),    inline: true }
          );

        const ability = queryEngine.getTroopAbility(troopQuery, lvl);
        if (ability && ability.name) {
          let abText = ability.description;
          if (ability.statsAtLevel) {
            abText += `\n\n**Stats at Lv. ${lvl}:**\n` +
              Object.entries(ability.statsAtLevel)
                .map(([k, v]) => `• **${k}:** ${v}`)
                .join('\n');
          }
          embed.addFields({ name: `✨ Ability: ${ability.name}`, value: abText });
        }

        // 🆕 SMART EMBED + AI CO-EXISTENCE — same rule as the hero card above.
        prebuiltEmbeds.push(embed);
        if (isDashboardCommand) {
          return { resolved: true, embeds: [embed] };
        }
      }
    }
  }

  // ── ⚔️ COMPARISON ENGINE (Dual Cards + AI Fallthrough) ───────────────────
  // 🛡️ FALSE-POSITIVE "VS" GUARD (Fix: "Bengali vs Vikings" banter trap)
  // Bare "vs"/"versus" text is no longer sufficient on its own to trigger the
  // comparison engine. It must co-occur with at least one recognized game
  // entity — a hero, a troop, a boss name, or a mentioned category/tag —
  // otherwise this is almost certainly casual banter ("Bengali vs Vikings",
  // "cats vs dogs") and must be left alone so it falls through to SOCIAL/
  // BANTER handling instead of the strict game-data pipeline.
  const hasKnownGameEntity =
    (entities.heroNames  && entities.heroNames.length  > 0) ||
    (entities.troopNames && entities.troopNames.length > 0) ||
    isBossQuery ||
    GAME_TAGS.some(tag => new RegExp(`\\b${tag}s?\\b`, 'i').test(text));

  const isExplicitVs       = INTENT_PATTERNS.explicitVs.test(text) && hasKnownGameEntity;
  const isExactlyTwoHeroes = entities.heroNames && entities.heroNames.length === 2;

  if ((isExplicitVs || isExactlyTwoHeroes) && !isSynergyQuery && !isCounterQuery) {
    let nameA, nameB;

    if (isExactlyTwoHeroes) {
      nameA = entities.heroNames[0];
      nameB = entities.heroNames[1];
    } else if (isExplicitVs) {
      const vsMatch = text.match(INTENT_PATTERNS.vsSplit);
      if (vsMatch) { nameA = vsMatch[1].trim(); nameB = vsMatch[2].trim(); }
    }

    if (nameA && nameB) {
      const entityA = queryEngine.findEntityByName(nameA);
      const entityB = queryEngine.findEntityByName(nameB);

      if (entityA && entityB && entityA.type === 'hero' && entityB.type === 'hero') {
        const h1 = entityA.data;
        const h2 = entityB.data;

        const embed1 = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`🦸‍♂️ ${h1.name}`)
          .addFields(
            { name: 'Faction / Rarity', value: `${h1.faction || 'N/A'} (${h1.rarity || 'N/A'})`, inline: false },
            { name: '❤️ HP',            value: h1.stats?.hp      ? h1.stats.hp.toLocaleString()   : 'N/A', inline: true },
            { name: '🛡️ Defense',      value: String(h1.stats?.defense || 'N/A'),                  inline: true },
            { name: '⚔️ Attack',       value: h1.stats?.attack  ? h1.stats.attack.toLocaleString(): 'N/A', inline: true }
          );
        if (h1.talent)  embed1.addFields({ name: `🌟 Talent: ${h1.talent.name}`,  value: h1.talent.description });
        if (h1.ability) embed1.addFields({ name: `✨ Ability: ${h1.ability.name}`, value: h1.ability.description });

        const embed2 = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle(`🦸‍♂️ ${h2.name}`)
          .addFields(
            { name: 'Faction / Rarity', value: `${h2.faction || 'N/A'} (${h2.rarity || 'N/A'})`, inline: false },
            { name: '❤️ HP',            value: h2.stats?.hp      ? h2.stats.hp.toLocaleString()   : 'N/A', inline: true },
            { name: '🛡️ Defense',      value: String(h2.stats?.defense || 'N/A'),                  inline: true },
            { name: '⚔️ Attack',       value: h2.stats?.attack  ? h2.stats.attack.toLocaleString(): 'N/A', inline: true }
          );
        if (h2.talent)  embed2.addFields({ name: `🌟 Talent: ${h2.talent.name}`,  value: h2.talent.description });
        if (h2.ability) embed2.addFields({ name: `✨ Ability: ${h2.ability.name}`, value: h2.ability.description });

        prebuiltEmbeds = [embed1, embed2];
        // Comparisons always fall through to the AI (never resolved:true here,
        // even historically) — no dashboard-command carve-out needed.
      }
    }
  }

  // ── 🧠 STRATEGY & AI INTELLIGENCE PIPELINE ───────────────────────────────
  let strategyData = build(intent, entities, userCorrections);
  if (!strategyData)          strategyData = { sufficient: false, context: null };
  if (!strategyData.context)  strategyData.context = {};

  let enrichmentAdded = false;

  const mentionedTags = GAME_TAGS.filter(tag => new RegExp(`\\b${tag}s?\\b`, 'i').test(text));

  // ── SCENARIO A: EXPLICIT DATA INJECTION ──────────────────────────────────
  // 🆕 CONTEXT WINDOW PROTECTION: full JSON objects only when <= 3 entities
  // are mentioned; beyond that, every entity in the list is compacted into a
  // lightweight Summary Object (name, rarity, primaryRole, talentName).
  if (entities.heroNames.length > 0) {
    const resolvedHeroes = entities.heroNames
      .map(name => queryEngine.findEntityByName(name))
      .filter(d => d && d.data)
      .map(d => d.data);

    if (resolvedHeroes.length > 0) {
      strategyData.context.mentionedHeroes = resolvedHeroes.length > 3
        ? resolvedHeroes.map(_toHeroSummary)
        : resolvedHeroes;
      if (resolvedHeroes.length > 3) {
        strategyData.context.mentionedHeroesTruncated = true; // signal to the AI these are summaries, not full records
      }
      enrichmentAdded = true;
    }
  }

  if (entities.troopNames.length > 0) {
    const resolvedTroops = entities.troopNames
      .map(name => queryEngine.findEntityByName(name))
      .filter(d => d && d.data)
      .map(d => d.data);

    if (resolvedTroops.length > 0) {
      strategyData.context.mentionedTroops = resolvedTroops.length > 3
        ? resolvedTroops.map(_toTroopSummary)
        : resolvedTroops;
      if (resolvedTroops.length > 3) {
        strategyData.context.mentionedTroopsTruncated = true;
      }
      enrichmentAdded = true;
    }
  }

  // ── SCENARIO A2: CATEGORY COUNT INJECTION ────────────────────────────────
  // When the user asks "how many tank troops" / "list all mages", we call
  // getTroopsByCategory() / getHeroesByRole() and inject the exact, structured
  // result. The AI receives totalCount + troopsList / heroesList — no guessing.
  if (isCategoryQuery && categoryKeywordsInText.length > 0) {
    strategyData.context.categoryData = {};

    categoryKeywordsInText.forEach(category => {
      // Check troops first
      const troopResult = queryEngine.getTroopsByCategory(category);
      if (troopResult.totalCount > 0) {
        strategyData.context.categoryData[`troops_${category}`] = {
          query:      category,
          totalCount: troopResult.totalCount,
          list:       troopResult.troopsList.map(t => `${t.name} (${t.rarity}, ${t.primaryRole || t.categories.join('/')})`),
          type:       'troops'
        };
        enrichmentAdded = true;
      }

      // Check heroes
      const heroResult = queryEngine.getHeroesByRole(category);
      if (heroResult.totalCount > 0) {
        strategyData.context.categoryData[`heroes_${category}`] = {
          query:      category,
          totalCount: heroResult.totalCount,
          list:       heroResult.heroesList.map(h => `${h.name} (${h.rarity}, ${h.faction})`),
          type:       'heroes'
        };
        enrichmentAdded = true;
      }
    });

    // 🆕 PILLAR 1 — Missing Data Protocol: category found nothing anywhere.
    // Inject heuristicFallback instead of an empty/"not found" dead end.
    if (Object.keys(strategyData.context.categoryData).length === 0) {
      strategyData.context.categoryData._notFound = {
        queriedCategories: categoryKeywordsInText,
        result: 'No troops or heroes matched these categories in the local database.'
      };
      strategyData.context.heuristicFallback = HEURISTIC_FALLBACKS.category;
      enrichmentAdded = true;
    }
  }

  // ── SCENARIO A3: MACRO/TAXONOMY INJECTION ────────────────────────────────
  // When the user asks a meta-question about the classification system
  // itself ("how many roles are there", "what factions exist", "list all
  // categories"), pull the full deduplicated taxonomy straight from the live
  // troop/hero data via getGameTaxonomy() and hand it to the AI raw. The AI's
  // existing STRATEGY_SYSTEM_INSTRUCTION formats this into a conversational,
  // educational answer — this router only supplies the exact, aggregated
  // facts so nothing is invented.
  //
  // Deliberately does NOT set `resolved: true` — this must fall through so
  // the AI pipeline adds the conversational/tutorial layer on top, per the
  // "Smart Embed + AI Co-existence" rule used everywhere else in this router.
  if (isTaxonomyQuery) {
    const taxonomy = queryEngine.getGameTaxonomy();
    strategyData.context.gameTaxonomy = taxonomy;
    enrichmentAdded = true;
  }

  // ── SCENARIO B: BIDIRECTIONAL SMART SYNERGY ENRICHMENT ───────────────────
  if (isSynergyQuery && !isCounterQuery) {
    if (entities.troopNames && entities.troopNames.length > 0) {
      let troopIdentifiers = new Set();
      entities.troopNames.forEach(tName => {
        const tEntity = queryEngine.findEntityByName(tName);
        if (tEntity && tEntity.data) {
          const tData = tEntity.data;
          if (tData.faction) troopIdentifiers.add(String(tData.faction).toUpperCase());
          if (tData.type)    troopIdentifiers.add(String(tData.type).toUpperCase());
          if (Array.isArray(tData.tags))               tData.tags.forEach(t => troopIdentifiers.add(String(t).toUpperCase()));
          // 🆕 Troops also carry a `categories[]` array (e.g. "Human", "Tank",
          // "Trickster") which may not always be fully duplicated into tags[].
          // Folding it in here makes the synergy match resilient to future
          // troop entries that only populate categories, not tags.
          if (Array.isArray(tData.categories))         tData.categories.forEach(c => troopIdentifiers.add(String(c).toUpperCase()));
          if (tData.analysis && Array.isArray(tData.analysis.secondaryRoles)) tData.analysis.secondaryRoles.forEach(t => troopIdentifiers.add(String(t).toUpperCase()));
          if (tData.analysis && tData.analysis.primaryRole) troopIdentifiers.add(String(tData.analysis.primaryRole).toUpperCase());
        }
      });

      if (troopIdentifiers.size > 0) {
        const tIdArray = Array.from(troopIdentifiers);
        const matchingHeroes = allKnownHeroes.filter(h => {
          let hId = [];
          if (h.faction) hId.push(String(h.faction).toUpperCase());
          if (h.type)    hId.push(String(h.type).toUpperCase());
          if (Array.isArray(h.tags))      hId.push(...h.tags.map(t => String(t).toUpperCase()));
          if (Array.isArray(h.synergies)) hId.push(...h.synergies.map(t => String(t).toUpperCase()));
          return hId.some(id => tIdArray.includes(id));
        });

        if (matchingHeroes.length > 0) {
          strategyData.context.heroRecommendations = matchingHeroes.map(h => ({
            name:          h.name,
            synergy_links: h.faction || h.type || (h.tags ? h.tags.join(', ') : 'N/A'),
            rarity:        h.rarity,
            talent:        h.talent ? (h.talent.description || h.talent) : 'N/A'
          }));
          enrichmentAdded = true;
        }
      }
    }

    if (entities.heroNames && entities.heroNames.length > 0) {
      let heroIdentifiers = new Set();
      entities.heroNames.forEach(hName => {
        const hEntity = queryEngine.findEntityByName(hName);
        if (hEntity && hEntity.data) {
          const hData = hEntity.data;
          if (hData.faction) heroIdentifiers.add(String(hData.faction).toUpperCase());
          if (hData.type)    heroIdentifiers.add(String(hData.type).toUpperCase());
          if (Array.isArray(hData.tags))      hData.tags.forEach(t => heroIdentifiers.add(String(t).toUpperCase()));
          if (Array.isArray(hData.synergies)) hData.synergies.forEach(t => heroIdentifiers.add(String(t).toUpperCase()));
        }
      });

      if (heroIdentifiers.size > 0) {
        const hIdArray = Array.from(heroIdentifiers);
        const matchingTroops = allKnownTroops.filter(t => {
          let tId = [];
          if (t.faction) tId.push(String(t.faction).toUpperCase());
          if (t.type)    tId.push(String(t.type).toUpperCase());
          if (Array.isArray(t.tags)) tId.push(...t.tags.map(tag => String(tag).toUpperCase()));
          if (t.analysis && Array.isArray(t.analysis.secondaryRoles)) tId.push(...t.analysis.secondaryRoles.map(tag => String(tag).toUpperCase()));
          if (t.analysis && t.analysis.primaryRole) tId.push(String(t.analysis.primaryRole).toUpperCase());
          return tId.some(id => hIdArray.includes(id));
        });

        if (matchingTroops.length > 0) {
          strategyData.context.troopRecommendations = matchingTroops.map(t => ({
            name:          t.name,
            synergy_links: t.faction || (t.tags ? t.tags.join(', ') : 'N/A'),
            rarity:        t.rarity
          }));
          enrichmentAdded = true;
        }
      }
    }
  }

  // ── SCENARIO C: CATEGORY & ROLE SCANNER ──────────────────────────────────
  if (!enrichmentAdded && mentionedTags.length > 0 && !isCounterQuery) {
    const matchingHeroes = allKnownHeroes.filter(h => {
      let hId = [];
      if (h.faction) hId.push(String(h.faction).toLowerCase());
      if (h.type)    hId.push(String(h.type).toLowerCase());
      if (Array.isArray(h.tags))      hId.push(...h.tags.map(t => String(t).toLowerCase()));
      if (Array.isArray(h.synergies)) hId.push(...h.synergies.map(t => String(t).toLowerCase()));
      return mentionedTags.some(mt => hId.some(id => id.includes(mt)));
    });

    if (matchingHeroes.length > 0) {
      strategyData.context.targetCategory      = mentionedTags.join(', ').toUpperCase();
      strategyData.context.heroRecommendations = matchingHeroes.map(h => ({
        name:          h.name,
        synergy_links: h.faction || h.type || (h.tags ? h.tags.join(', ') : 'N/A'),
        rarity:        h.rarity,
        talent:        h.talent ? (h.talent.description || h.talent) : 'N/A'
      }));
      enrichmentAdded = true;
    }
  }

  // ── SCENARIO D / E: ADVANCED COMBOS, EQUIPMENT, BOSS & COUNTERS ──────────
  const strategiesData = queryEngine.gameLibrary ? queryEngine.gameLibrary.strategies : null;

  if (strategiesData) {

    // ── 🔥 SCENARIO E: FORCE-INJECT BOSS GUIDE ────────────────────────────
    // Runs unconditionally — completely bypasses isSynergyQuery / isCounterQuery
    // gating. Boss queries worded as "how do I beat dagon" / "counter dagon"
    // previously fell into the PvP counterGuides branch (no boss data) instead
    // of scenarioGuides. This block guarantees a match regardless of phrasing.
    if (isBossQuery && Array.isArray(strategiesData.scenarioGuides)) {
      const existingScenarios = Array.isArray(strategyData.context.scenarioGuides) ? strategyData.context.scenarioGuides : [];
      const seen = new Set(existingScenarios.map(s => s.scenario));

      let bossGuides = strategiesData.scenarioGuides.filter(scen => {
        const scenString = JSON.stringify(scen).toLowerCase();
        return matchedBossKeywords.some(k => scenString.includes(k));
      });

      // NOTE: previous versions fell back to ANY scenario guide whose title
      // contained the word "boss" when no keyword-specific match was found.
      // That silently handed a Dagon query the Kraken guide (or vice versa)
      // whenever only one boss had a written scenario entry — a false match
      // is worse than no match. That generic fallback has been REMOVED.
      // If matchedBossKeywords found nothing scenario-specific, bossGuides
      // stays empty and Pillar 1's heuristicFallback below takes over instead.

      // Also pull from bosses.js directly and inject as structured context
      const bossesData = queryEngine.gameLibrary.bosses || [];
      const matchedBossRecords = bossesData.filter(b =>
        matchedBossKeywords.some(k => b.name && b.name.toLowerCase().includes(k))
      );

      bossGuides.forEach(g => {
        if (!seen.has(g.scenario)) { existingScenarios.push(g); seen.add(g.scenario); }
      });

      if (existingScenarios.length > 0 || matchedBossRecords.length > 0) {
        strategyData.context.scenarioGuides  = existingScenarios;
        strategyData.context.detectedBoss    = matchedBossKeywords.join(', ');
        // Inject the raw boss record so the AI has ability/strategy data directly
        if (matchedBossRecords.length > 0) {
          strategyData.context.bossRecords = matchedBossRecords;
        }
        enrichmentAdded        = true;
        strategyData.sufficient = true;   // guaranteed — never falls through to "no data found"
      } else {
        // 🆕 PILLAR 1 — Missing Data Protocol: boss keyword was recognized but
        // NO scenario guide, generic boss guide, or boss record exists for it.
        // Inject general boss-fighting heuristic instead of an empty context.
        strategyData.context.detectedBoss     = matchedBossKeywords.join(', ');
        strategyData.context.heuristicFallback = HEURISTIC_FALLBACKS.boss;
        enrichmentAdded        = true;
        strategyData.sufficient = true;
      }
    }

    // 1. Equipment Guide Check
    if (INTENT_PATTERNS.equipment.test(text) && strategiesData.equipmentSynergies) {
      strategyData.context.equipmentGuide = strategiesData.equipmentSynergies;
      enrichmentAdded = true;
    }

    // 2. Counter Strategy Check
    if (isCounterQuery && !isBossQuery && strategiesData.counterGuides) {
      const relevantCounters = strategiesData.counterGuides.filter(guide => {
        const guideString = JSON.stringify(guide).toLowerCase();
        return entities.heroNames.some(h  => guideString.includes(h.toLowerCase()))  ||
               entities.troopNames.some(t => guideString.includes(t.toLowerCase())) ||
               (guide.targetOpponent && text.toLowerCase().includes(guide.targetOpponent.toLowerCase()));
      });

      if (relevantCounters.length > 0) {
        strategyData.context.counterGuides = relevantCounters;
        enrichmentAdded = true;
      }
    }

    // 3. 2-Hero Formation Check
    if (isSynergyQuery && !isCounterQuery && strategiesData.optimalFormations) {
      const relevantFormations = strategiesData.optimalFormations.filter(form => {
        const formString = JSON.stringify(form).toLowerCase();
        return entities.heroNames.some(h  => formString.includes(h.toLowerCase()))  ||
               entities.troopNames.some(t => formString.includes(t.toLowerCase())) ||
               mentionedTags.some(tag => formString.includes(tag.toLowerCase()));
      });

      if (relevantFormations.length > 0) {
        strategyData.context.optimalFormations = relevantFormations;
        enrichmentAdded = true;
      } else if (entities.heroNames.length === 0 && entities.troopNames.length === 0 && mentionedTags.length === 0) {
        strategyData.context.optimalFormations = strategiesData.optimalFormations.slice(0, 3);
        enrichmentAdded = true;
      }
    }

    // 4. Scenario Strategy Guides (Bosses, PvP, Scenarios)
    // Gate relaxed: boss queries must never be blocked by isCounterQuery.
    if (strategiesData.scenarioGuides && (!isCounterQuery || isBossQuery)) {
      const genericScenarioQuery = INTENT_PATTERNS.genericScenario.test(normalizedText);
      const relevantScenarios    = strategiesData.scenarioGuides.filter(scen => {
        const scenString = JSON.stringify(scen).toLowerCase();
        return mentionedTags.some(tag      => scenString.includes(tag.toLowerCase())) ||
               matchedBossKeywords.some(k  => scenString.includes(k))                 ||
               (genericScenarioQuery && INTENT_PATTERNS.genericScenario.test(scen.scenario));
      });

      if (relevantScenarios.length > 0) {
        const existingScenarios = Array.isArray(strategyData.context.scenarioGuides) ? strategyData.context.scenarioGuides : [];
        const seen = new Set(existingScenarios.map(s => s.scenario));
        relevantScenarios.forEach(g => {
          if (!seen.has(g.scenario)) { existingScenarios.push(g); seen.add(g.scenario); }
        });
        strategyData.context.scenarioGuides = existingScenarios;
        enrichmentAdded = true;
      }
    }
  }

  // ── 🆕 HERO COLLECTION BONUS AUTO-INJECTION ───────────────────────────────
  // When the context now has mentionedHeroes, compute their collection bonuses
  // automatically and inject into context so the AI can quote exact numbers.
  // NOTE: only runs against full (non-summarized) records — collection bonus
  // math needs the real hero `id`, which the Context Window Protection summary
  // objects intentionally omit.
  if (
    strategyData.context.mentionedHeroes &&
    strategyData.context.mentionedHeroes.length > 0 &&
    !strategyData.context.mentionedHeroesTruncated
  ) {
    const heroIds = strategyData.context.mentionedHeroes
      .map(h => h.id)
      .filter(Boolean);

    if (heroIds.length > 0) {
      const collectionResult = queryEngine.calculateHeroCollectionBonus(heroIds);
      strategyData.context.heroCollectionBonusSummary = {
        totalCollectionBonus: collectionResult.totalCollectionBonus,
        breakdown: collectionResult.breakdown,
        note: 'totalCollectionBonus feeds into calculateFinalPower() as heroCollectionBonusPct'
      };
    }
  }

  // ── 🆕 PILLAR 1 — Missing Data Protocol: single hero/troop name matched but
  // resolved to nothing anywhere above (no embed, no strategy enrichment).
  // Covers direct FACT/STRATEGY lookups on a name the scraper caught but that
  // produced zero usable data (e.g. malformed roster entry). Only fires when
  // nothing else has already provided sufficient context, so it never
  // overwrites a real result.
  if (!enrichmentAdded && !strategyData.sufficient) {
    if (entities.heroNames.length === 1 && entities.troopNames.length === 0) {
      strategyData.context.heuristicFallback = HEURISTIC_FALLBACKS.hero;
      strategyData.context.unresolvedQuery   = entities.heroNames[0];
      enrichmentAdded = true;
    } else if (entities.troopNames.length === 1 && entities.heroNames.length === 0) {
      strategyData.context.heuristicFallback = HEURISTIC_FALLBACKS.troop;
      strategyData.context.unresolvedQuery   = entities.troopNames[0];
      enrichmentAdded = true;
    }
  }

  if (enrichmentAdded) {
    strategyData.sufficient = true;
  }

  if (strategyData.sufficient || prebuiltEmbeds.length > 0) {
    return {
      resolved: false,
      embeds:   prebuiltEmbeds.length > 0 ? prebuiltEmbeds : null,
      intent,
      entities,
      context:  strategyData.sufficient ? strategyData.context : null,
      needsClarification
    };
  }

  return { resolved: false, intent, entities, context: null, needsClarification };
}

module.exports = { route };
