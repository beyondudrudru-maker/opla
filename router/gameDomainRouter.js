/**
 * router/gameDomainRouter.js
 *
 * PURPOSE: Resolves user queries into visual Embed Cards AND passes strict
 * deterministic data contexts to the AI pipeline for deep, hallucination-free
 * strategic analysis.
 *
 * 🆕 REFACTOR — Split into router/gameDomain/*.js modules for maintainability.
 * This file is now a thin orchestrator: it wires together entity scraping,
 * embed building, strategy enrichment, and query-flag construction, but owns
 * none of that logic directly anymore. See router/gameDomain/ for:
 *   - constants.js        boss/category keyword lists, regex dictionary,
 *                          heuristic fallback library
 *   - statFormatter.js     hero/troop stat range formatting
 *   - fuzzyMatch.js         Levenshtein-based typo tolerance
 *   - queryDetectors.js    category/taxonomy/deep-question/dashboard/
 *                          confidence-scoring predicates
 *   - summaries.js          Context Window Protection compaction helpers
 *   - embedBuilders.js     all Discord EmbedBuilder construction
 *   - entityScraper.js      Scunthorpe-proof hero/troop/boss name scraping
 *                          + 🆕 seeded-entity DB validation guard
 *   - enrichment.js         Scenarios A–E strategy context enrichment
 *   - queryFlags.js         queryFlags + deterministic-cache descriptor
 *
 * FEATURE HISTORY (retained from the pre-split monolith)
 * ─────────────────────────────────────────────────────
 * 1. Scunthorpe-Proof Scraper, Category & Tag Counting, Boss & Scenario
 *    Routing, clean bullet-list output formatting, Smart Embed + AI
 *    Co-existence (only `!` dashboard commands short-circuit resolved:true),
 *    Context Window Protection, Deep Question Detector, Pillar 1 (Missing
 *    Data Protocol heuristic fallbacks), Pillar 2 (Confidence Scoring).
 *
 * 🆕 NEW IN THIS VERSION
 * ─────────────────────────────────────────────────────
 * 11. Seeded Entity DB Validation Guard — classifier-seeded heroName/
 *     troopName guesses (from gameIntentClassifier's own NLP heuristics,
 *     e.g. capitalized word-shape detection) are now cross-checked against
 *     the real roster BEFORE they can set `isSingleEntity: true` or trigger
 *     the aiFallback strategy pipeline. This is the fix for messages like
 *     "I will be Hitler, will you be my Eva Anna?" being misrouted into
 *     game-strategy analysis — no such hero/troop exists, so the guess is
 *     now dropped instead of trusted. See entityScraper.validateSeededEntities.
 * 12. hasValidatedEntity query flag — defense-in-depth signal passed to
 *     aiFallback alongside isSingleEntity so the AI-side prompt can also
 *     refuse to fabricate if a name only reached it unvalidated.
 * 13. Roster snapshot memoization — allKnownHeroes/allKnownTroops are cached
 *     for a short TTL instead of re-materialized from queryEngine on every
 *     single message, cutting redundant array/object churn on high-traffic
 *     channels.
 */

const { EmbedBuilder } = require('discord.js');
const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');

const { INTENT_PATTERNS, GAME_TAGS } = require('./gameDomain/constants.js');
const {
  detectCategoryQueries,
  isCategoryCountQuery,
  isTaxonomyQuery: isTaxonomyQueryDetector,
  isDeepQuestion,
  isDashboardCommand,
  isShortAmbiguousName
} = require('./gameDomain/queryDetectors.js');
const { scrapeBossKeywords, scrapeEntities, validateSeededEntities } = require('./gameDomain/entityScraper.js');
const {
  buildHeroCard,
  buildTroopCard,
  buildComparisonCards,
  buildEconomyEmbed,
  buildGearEmbed
} = require('./gameDomain/embedBuilders.js');

let _facetStore = null;
try { _facetStore = require('../engine/facetStore.js'); } catch (_) { _facetStore = null; }
let _gearData = null;
try { _gearData = require('../data/gearData.js'); } catch (_) { _gearData = null; }
function _heroReachesTroop(hero, troop) {
  const tags = new Set([...(troop.categories || []), ...(troop.synergyCategories || []), ...(troop.tags || [])].map(x => String(x).toLowerCase()));
  const hit = (t) => Array.isArray(t) && t.some(x => {
    const k = String(x).toLowerCase().trim();
    return k === 'all allies' || k === 'all' || tags.has(k) || tags.has(k + 's') || tags.has(k.replace(/s$/, ''));
  });
  return hit(hero.talent && hero.talent.targets) || hit(hero.ability && hero.ability.targets);
}
// Hero with no gear of its own: look at the troops its buffs actually reach and gear for the dominant troop family.
function _reachGearRec(hero) {
  try {
    const troops = (queryEngine.findTroops && queryEngine.findTroops()) || [];
    const reached = troops.filter(t => _heroReachesTroop(hero, t));
    if (reached.length < 2) return null;
    const tally = new Map();
    for (const t of reached) {
      const r = _gearData.recommendGearForTroop(t);
      const items = r && Array.isArray(r.matchedGear) ? r.matchedGear : [];
      if (!items.length) continue;
      const key = items.map(g => g.name).sort().join('|');
      const cur = tally.get(key) || { n: 0, rec: r };
      cur.n++; tally.set(key, cur);
    }
    let best = null;
    for (const v of tally.values()) if (!best || v.n > best.n) best = v;
    if (!best || best.n / reached.length <= 0.5) return null;
    const pct = Math.round(100 * best.n / reached.length);
    return { rec: best.rec, note: `${hero.name}'s buffs reach mostly troops that use this gear (${pct}% of ${reached.length} reachable troops), so it is picked to favour them.` };
  } catch (_) { return null; }
}
function _gearEmbedFor(data, type, rawTroop) {
  try {
    if (!_gearData || !data) return null;
    const fn = type === 'hero' ? _gearData.recommendGearForHero : _gearData.recommendGearForTroop;
    if (typeof fn !== 'function') return null;
    const rec = fn(type === 'hero' ? data : (rawTroop || data)) || null;
    const has = rec && Array.isArray(rec.matchedGear) && rec.matchedGear.length;
    if (type === 'hero' && !has && typeof _gearData.recommendGearForTroop === 'function') {
      const rr = _reachGearRec(data);
      if (rr) return buildGearEmbed(data.name, rr.rec, rr.note);
    }
    return buildGearEmbed(data.name, rec);
  } catch (_) { return null; }
}
const { enrichStrategyContext } = require('./gameDomain/enrichment.js');
const { buildQueryFlags } = require('./gameDomain/queryFlags.js');

const ecoModule = require('../data/economyRatios.js');
const economyRatios = ecoModule.economyRatios || ecoModule;

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 ADVANCEMENT — Roster Snapshot Memoization
// ─────────────────────────────────────────────────────────────────────────────
// queryEngine.findHeroes()/findTroops() rebuild fresh arrays on every call.
// On a busy server this function runs on every single message, so re-pulling
// (and re-iterating, in the scraper) the full roster every time is wasted
// work when the underlying data (heroes.js/troops.js) only changes on a
// deploy. A short TTL cache avoids that churn while still picking up data
// edits within a few seconds without needing a bot restart.
const ROSTER_CACHE_TTL_MS = 15000;
let _rosterCache = { heroes: [], troops: [], expiresAt: 0 };

function _getRosterSnapshot() {
  const now = Date.now();
  if (now < _rosterCache.expiresAt) return _rosterCache;

  const heroes = typeof queryEngine.findHeroes === 'function' ? queryEngine.findHeroes() : [];
  const troops = typeof queryEngine.findTroops === 'function' ? queryEngine.findTroops() : [];
  _rosterCache = { heroes, troops, expiresAt: now + ROSTER_CACHE_TTL_MS };
  return _rosterCache;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────────────────────────────────────

function _correctTypos(text) {
  try {
    mentionsKnownEntity('x'); // make sure token cache is warm
    const toks = (_nameRe.toks || []).filter(k => !k.includes(' '));
    const known = new Set(_nameRe.toks || []);
    return String(text).replace(/[A-Za-z]{6,}/g, w => {
      const lw = w.toLowerCase();
      if (known.has(lw)) return w;
      for (const k of toks) if (k.length >= 5 && Math.abs(k.length - lw.length) <= 1 && _lev1(lw, k)) return k;
      return w;
    });
  } catch (_) { return text; }
}

function route(text, recentContext = '', userCorrections = []) {
  text = _correctTypos(text);
  let { intent, entities } = classify(text);
  const originalIntent = intent; // saved ONCE: classify() used to run 3x per message
  entities.rawText = text;

  // ── Normalised text variants used throughout ──────────────────────────────
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const textNoSpace    = text.toLowerCase().replace(/[^a-z0-9]/g, '');

  // ── Seed array fields ─────────────────────────────────────────────────────
  if (!entities.heroNames)  entities.heroNames  = [];
  if (!entities.troopNames) entities.troopNames = [];
  if (entities.heroName  && !entities.heroNames.includes(entities.heroName))   entities.heroNames.push(entities.heroName);
  if (entities.troopName && !entities.troopNames.includes(entities.troopName)) entities.troopNames.push(entities.troopName);

  const { heroes: allKnownHeroes, troops: allKnownTroops } = _getRosterSnapshot();

  // ── 🆕 SEEDED ENTITY DB VALIDATION GUARD ──────────────────────────────────
  // Drop any classifier-guessed heroName/troopName that doesn't independently
  // resolve against the real roster BEFORE it can influence isSingleEntity
  // or route this message into the game-strategy AI pipeline. See
  // entityScraper.js header for the "Hitler / Eva Anna" false-positive this
  // closes.
  validateSeededEntities(entities, normalizedText, textNoSpace, allKnownHeroes, allKnownTroops);

  // ── 🐙 BOSS / SCENARIO INSTANT-RECOGNITION ────────────────────────────────
  // Must run BEFORE entity scraping and BEFORE synergy/counter regex so that
  // phrasing like "how do I beat dagon" or "against balthazar" is never
  // misrouted into the PvP counter branch.
  const matchedBossKeywords = scrapeBossKeywords(normalizedText, textNoSpace);
  // generic "boss ke against best hero" (no boss named) is still a boss question
  const isGenericBossWord = /\bboss(es)?\b/i.test(text);
  // "boss ke against best hero" with no boss named -> use today's active boss (set by eventState/bossCommand)
  if (matchedBossKeywords.length === 0 && isGenericBossWord && global.activeBoss && global.activeBoss.name) {
    matchedBossKeywords.push(String(global.activeBoss.name).toLowerCase());
  }
  const isBossQuery = matchedBossKeywords.length > 0 || isGenericBossWord;

  // ── 🛡️ SCUNTHORPE-PROOF ENTITY SCRAPER ───────────────────────────────────
  scrapeEntities(text, normalizedText, textNoSpace, entities, allKnownHeroes, allKnownTroops);

  // Drop partial-name false hits: "bone dragon" must not also summon "Dragon Rider"
  // (its first word "dragon" is already explained by the longer matched name "Bone Dragon").
  {
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const padded = ' ' + normalizedText.replace(/\s+/g, ' ') + ' ';
    const all = [...new Set([...(entities.heroNames || []), ...(entities.troopNames || [])])].map(norm);
    const fullHit = n => padded.includes(' ' + n + ' ');
    const covered = n => {
      const first = n.split(' ')[0];
      return all.some(o => o !== n && fullHit(o) && o.split(' ').includes(first) && !fullHit(n));
    };
    const keep = n => { const x = norm(n); return fullHit(x) || !covered(x); };
    entities.heroNames  = (entities.heroNames  || []).filter(keep);
    entities.troopNames = (entities.troopNames || []).filter(keep);
    if (entities.heroName  && !keep(entities.heroName))  entities.heroName  = entities.heroNames[0]  || undefined;
    if (entities.troopName && !keep(entities.troopName)) entities.troopName = entities.troopNames[0] || undefined;
  }

  // ── Intent signal detection ───────────────────────────────────────────────

  const isSynergyQuery = INTENT_PATTERNS.synergy.test(text);
  const isCounterQuery = INTENT_PATTERNS.counter.test(text);

  // Category count detection
  const categoryKeywordsInText = detectCategoryQueries(text);
  const isCategoryQuery        = isCategoryCountQuery(text) || categoryKeywordsInText.length > 0;

  // 🆕 Deep Question Detector
  const isDeepQuestionQuery = isDeepQuestion(text);

  // 🆕 Macro/Taxonomy Detector — "how many roles are there", "all factions",
  // "what are the tags". Checked independently of isCategoryQuery since a
  // taxonomy question may not mention any specific known category keyword.
  const isTaxonomyQuery = isTaxonomyQueryDetector(text);

  // Force STRATEGY intent for synergy / counter / boss / category / deep-question / taxonomy queries
  if (isSynergyQuery || isCounterQuery || isBossQuery || isCategoryQuery || isDeepQuestionQuery || isTaxonomyQuery) {
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
  // Case-insensitive on purpose: the old check compared the raw classifier value against
  // UPPERCASE names (the `.toUpperCase ?` guard was always truthy and never uppercased anything),
  // so it silently never matched if the classifier emits lowercase intents.
  const originalIntentWasSocial = ['BANTER', 'SOCIAL', 'UNKNOWN'].includes(String(originalIntent || '').toUpperCase());
  const allMatchedNames = [...entities.heroNames, ...entities.troopNames];
  const onlyShortAmbiguousMatches = allMatchedNames.length > 0 && allMatchedNames.every(isShortAmbiguousName);
  const needsClarification = onlyShortAmbiguousMatches
    && !isSynergyQuery && !isCounterQuery && !isBossQuery && !isCategoryQuery && !isDeepQuestionQuery && !isTaxonomyQuery
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
    const embed = buildEconomyEmbed(intent, economyRatios, text);
    return { resolved: true, embeds: [embed] };
  }

  let prebuiltEmbeds = [];
  let gearInCard = false;
  const isDashboardCmd = isDashboardCommand(text);

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
        const embed = buildHeroCard(entity.data);

        // 🆕 SMART EMBED + AI CO-EXISTENCE: pure entity/fact lookups never
        // short-circuit anymore. Only a strict `!` dashboard command is
        // allowed to bypass the AI pipeline with resolved:true.
        prebuiltEmbeds.push(embed);
        if (isDashboardCmd) {
          return { resolved: true, embeds: [embed] };
        }
        const _ge = _gearEmbedFor(entity.data, 'hero');
        if (_ge) { prebuiltEmbeds.push(_ge); gearInCard = true; }
      }
      // else: 🆕 PILLAR 1 — Missing Data Protocol: hero name matched but not
      // found. (Rare — scraper only adds names it found in allKnownHeroes —
      // but covers the case where findEntityByName's lookup diverges from
      // the scraper's own list, e.g. a stale cache.)
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
        const ability = queryEngine.getTroopAbility(troopQuery, lvl);
        const embed = buildTroopCard(data, ability, lvl, queryEngine.getTroop(troopQuery));

        // 🆕 SMART EMBED + AI CO-EXISTENCE — same rule as the hero card above.
        prebuiltEmbeds.push(embed);
        if (isDashboardCmd) {
          return { resolved: true, embeds: [embed] };
        }
        const _ge = _gearEmbedFor(data, 'troop', queryEngine.getTroop(troopQuery));
        if (_ge) { prebuiltEmbeds.push(_ge); gearInCard = true; }
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

  // 🐉 BOSS GUARD: Boss Battle queries never trigger an unsolicited 1v1 comparison.
  // Two heroes simply being mentioned together in a boss query (e.g. "best heroes
  // for Dagon: Lireal, Calyra?") is a squad question, not a face-off request.
  // Only an explicit "X vs Y" phrasing is honored during a boss query.
  if ((isExplicitVs || (isExactlyTwoHeroes && !isBossQuery)) && !isSynergyQuery && !isCounterQuery) {
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
        prebuiltEmbeds = buildComparisonCards(entityA.data, entityB.data);
        // Comparisons always fall through to the AI (never resolved:true here,
        // even historically) — no dashboard-command carve-out needed.
      }
    }
  }

  // ── 🧠 STRATEGY & AI INTELLIGENCE PIPELINE ───────────────────────────────
  const baseStrategyData = build(intent, entities, userCorrections);
  const { strategyData, enrichmentAdded, embeds: enrichmentEmbeds } = enrichStrategyContext({
    text,
    normalizedText,
    intent,
    entities,
    baseStrategyData,
    allKnownHeroes,
    queryEngine,
    isSynergyQuery,
    isCounterQuery,
    isBossQuery,
    matchedBossKeywords,
    isCategoryQuery,
    categoryKeywordsInText,
    isTaxonomyQuery
  });

  if (enrichmentEmbeds.length > 0) {
    prebuiltEmbeds = prebuiltEmbeds.concat(enrichmentEmbeds);
  }

  // ── 🎖️ RARITY ROSTER: "best legendary hero for boss" needs the actual heroes of that rarity ──
  try {
    const rm = text.match(/\b(mythical|legendary|epic|rare|common)\b/i);
    if (rm && /\b(hero|heroes|best|top|konsa|kaun|which|sabse)\b/i.test(text) && (!entities.heroNames || entities.heroNames.length === 0)) {
      const rar = rm[1].toLowerCase();
      const bossDisabled = h => /xana|harkon/i.test(h.name || '') || /does not work in boss/i.test(JSON.stringify((h.talent && h.talent.description) || ''));
      const list = allKnownHeroes
        .filter(h => String(h.rarity || '').toLowerCase() === rar)
        .filter(h => !(isBossQuery && bossDisabled(h)))
        .map(h => ({
          name: h.name, faction: h.faction,
          talent: h.talent ? { name: h.talent.name, targets: h.talent.targets, effects: h.talent.effects } : undefined,
          ability: h.ability ? { name: h.ability.name, effects: h.ability.effects, targets: h.ability.targets } : undefined,
        }));
      if (list.length) {
        if (!strategyData.context) strategyData.context = {};
        strategyData.context.rarityHeroes = { rarity: rar, count: list.length, heroes: list };
        strategyData.context.rankingNote = `Heroes of ${rar} rarity are listed in rarityHeroes (${list.length}). Rank the best 3-5 for the user's goal using ONLY their talent/ability data${isBossQuery ? ' (boss goal = max damage score: army damage first, then HP/defense/healing; boss-disabled heroes already removed)' : ''}. For each: what it buffs and which troop families it reaches. Max 2 heroes per battle, max 1 Mythical.`;
        strategyData.sufficient = true;
      }
    }
  } catch (_) { /* never block the answer */ }

  // ── 🆕 QUERY FLAGS — drives aiFallback's per-query-type instruction split ──
  const { queryFlags, deterministic } = buildQueryFlags({
    text,
    entities,
    isSynergyQuery,
    isBossQuery,
    isCounterQuery,
    queryEngine
  });
  if (gearInCard) queryFlags.gearInCard = true;

  // never send the same card twice (same title+description)
  {
    const seen = new Set();
    prebuiltEmbeds = prebuiltEmbeds.filter(e => {
      const d = (e && e.data) || e || {};
      const k = (d.title || '') + '|' + String(d.description || '').slice(0, 80) + '|' + ((d.fields && d.fields[0] && d.fields[0].value) || '').slice(0, 40);
      if (seen.has(k)) return false; seen.add(k); return true;
    });
  }

  // 🧩 Modular facet plan (single hero/troop question) — index.js uses it instead of the full context
  let facetPlan = null;
  try { facetPlan = _facetStore ? _facetStore.planFirstTurn({ entities, queryFlags }, text) : null; } catch (_) { facetPlan = null; }

  if (strategyData.sufficient || prebuiltEmbeds.length > 0) {
    return {
      resolved: false,
      facetPlan,
      embeds:   prebuiltEmbeds.length > 0 ? prebuiltEmbeds : null,
      intent,
      entities,
      context:  strategyData.sufficient ? strategyData.context : null,
      needsClarification,
      queryFlags,
      deterministic,
    };
  }

  return { resolved: false, facetPlan, intent, entities, context: null, needsClarification, queryFlags, deterministic };
}

// ─────────────────────────────────────────────────────────────────────────────
// mentionsKnownEntity(text) — cheap pre-gate for index.js.
// A message that names a real hero/troop/boss ("anavin kya karti hai?") is a
// game question even without the words "hero"/"troop". Whole-word match on the
// full name AND on its first word (>=4 chars, so "Imp"/"Ox" don't fire on chat).
// ─────────────────────────────────────────────────────────────────────────────
function _lev1(a, b) { // true when edit distance <= 1 (but not equal)
  if (a === b) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}
let _nameRe = { re: null, expiresAt: 0 };
function _nm(x) { return String((x && (x.name || (x.data && x.data.name))) || '').trim(); }
function mentionsKnownEntity(text) {
  try {
    const now = Date.now();
    if (!_nameRe.re || now >= _nameRe.expiresAt) {
      const { heroes, troops } = _getRosterSnapshot();
      const toks = new Set();
      for (const x of [...heroes, ...troops]) {
        const n = _nm(x).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!n) continue;
        if (n.length >= 4) toks.add(n);
        const first = n.split(' ')[0];
        if (first.length >= 4) toks.add(first);
      }
      const esc = [...toks].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      _nameRe = { re: esc.length ? new RegExp('\\b(?:' + esc.join('|') + ')\\b', 'i') : null, expiresAt: now + ROSTER_CACHE_TTL_MS, toks: [...toks] };
    }
    const t = String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (_nameRe.re && _nameRe.re.test(t)) return true;
    // typo tolerance ("drogon rider"): 1 edit on a >=5-char word vs a known name token
    if (_nameRe.toks) {
      for (const w of t.split(' ')) {
        if (w.length < 5) continue;
        for (const k of _nameRe.toks) { if (Math.abs(k.length - w.length) <= 1 && !k.includes(' ') && _lev1(w, k)) return true; }
      }
    }
    const nt = t, ns = t.replace(/ /g, '');
    return scrapeBossKeywords(nt, ns).length > 0;
  } catch (_) { return false; }
}

module.exports = { route, mentionsKnownEntity };
