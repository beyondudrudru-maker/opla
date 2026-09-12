/**
 * router/gameDomain/enrichment.js
 *
 * 🧠 STRATEGY & AI INTELLIGENCE PIPELINE
 * ─────────────────────────────────────────────────────────────────────────
 * Takes the base `strategyData` produced by strategyContextBuilder.build()
 * and layers on every deterministic, zero-hallucination enrichment scenario:
 *
 *   A.  Explicit hero/troop data injection (with Context Window Protection
 *       summarization above 3 entities)
 *   A2. Category/roster count injection ("how many tank troops")
 *   A3. Macro/taxonomy injection ("how many roles are there")
 *   B.  Bidirectional smart synergy enrichment (explicit recommendedHeroes/
 *       recommendedTroops/optimalGear only — no tag/faction guesswork)
 *   C.  Category & role scanner (tag-based hero recommendations)
 *   D/E. Advanced combos, equipment, boss force-injection, counters,
 *        formations, scenario guides
 *
 * Plus:
 *   - Hero Collection Bonus auto-injection
 *   - Pillar 1 (Missing Data Protocol) heuristic fallback for an unresolved
 *     single hero/troop name
 *
 * Returns { strategyData, enrichmentAdded, embeds } — `embeds` is an array
 * of any additional Discord embeds produced here (currently: synergy-target
 * entity cards) that the caller should concat onto its own embeds list.
 */

const { HEURISTIC_FALLBACKS, GAME_TAGS, INTENT_PATTERNS } = require('./constants.js');
const { toHeroSummary, toTroopSummary } = require('./summaries.js');
const { buildEntityEmbed } = require('./embedBuilders.js');

function enrichStrategyContext({
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
}) {
  let strategyData = baseStrategyData;
  if (!strategyData)          strategyData = { sufficient: false, context: null };
  if (!strategyData.context)  strategyData.context = {};

  let enrichmentAdded = false;
  const embeds = [];

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
        ? resolvedHeroes.map(toHeroSummary)
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
        ? resolvedTroops.map(toTroopSummary)
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
  // Deliberately does NOT set `resolved: true` — this must fall through so
  // the AI pipeline adds the conversational/tutorial layer on top, per the
  // "Smart Embed + AI Co-existence" rule used everywhere else in this router.
  if (isTaxonomyQuery) {
    const taxonomy = queryEngine.getGameTaxonomy();
    strategyData.context.gameTaxonomy = taxonomy;
    enrichmentAdded = true;
  }

  // ── SCENARIO B: BIDIRECTIONAL SMART SYNERGY ENRICHMENT ───────────────────
  // Calls queryEngine.getSynergyContext(), which reads ONLY the explicit
  // recommendedHeroes / recommendedTroops / optimalGear references stored
  // directly on the entity's own record. No tag/faction/substring inference
  // of any kind happens here.
  //
  // CRITICAL: synergy queries must NEVER set resolved:true — enrichmentAdded
  // only marks strategyData.sufficient so the enriched context is handed to
  // the AI, which still generates the actual explanation/response.
  if (isSynergyQuery && !isCounterQuery) {
    const synergyTargets = [
      ...entities.troopNames.map(name => ({ name, type: 'troop' })),
      ...entities.heroNames.map(name  => ({ name, type: 'hero'  }))
    ];

    if (synergyTargets.length > 0) {
      const synergyCandidates = [];

      synergyTargets.forEach(target => {
        const ctx = queryEngine.getSynergyContext(target.name, target.type);
        if (!ctx) return;

        synergyCandidates.push({
          targetType:        ctx.entityType,
          targetName:        ctx.entity.name,
          target:             ctx.entity,
          recommendedHeroes: ctx.recommendedHeroes,
          recommendedTroops: ctx.recommendedTroops,
          synergyCategories: ctx.synergyCategories,
          optimalGear:       ctx.optimalGear,
          unresolvedRecommendations: ctx.unresolvedRecommendations
        });

        // 🚀 Attach a real embed card for every entity actually named in a
        // multi-entity synergy query (e.g. "Anavin + Edelina combo?") so the
        // AI never has to type out full HP/Talent/Ability text from memory.
        const embed = buildEntityEmbed(ctx.entity, ctx.entityType);
        if (embed) embeds.push(embed);

        // Keep the legacy field names populated too (heroRecommendations /
        // troopRecommendations) so downstream consumers of strategyData.context
        // that already key off those names keep working, but now sourced from
        // the explicit recommendedHeroes/recommendedTroops data instead of
        // tag/faction guesswork.
        if (ctx.entityType === 'troop' && ctx.recommendedHeroes.length > 0) {
          const existing = Array.isArray(strategyData.context.heroRecommendations)
            ? strategyData.context.heroRecommendations : [];
          strategyData.context.heroRecommendations = existing.concat(
            ctx.recommendedHeroes.map(h => ({
              name:   h.name,
              rarity: h.rarity,
              talent: h.talent ? (h.talent.description || h.talent) : 'N/A'
            }))
          );
        }
        if (ctx.entityType === 'hero' && ctx.recommendedTroops.length > 0) {
          const existing = Array.isArray(strategyData.context.troopRecommendations)
            ? strategyData.context.troopRecommendations : [];
          strategyData.context.troopRecommendations = existing.concat(
            ctx.recommendedTroops.map(t => ({
              name:   t.name,
              rarity: t.rarity
            }))
          );
        }
      });

      if (synergyCandidates.length > 0) {
        strategyData.context.synergyCandidates = synergyCandidates;
        enrichmentAdded = true;
      } else {
        // 🆕 PILLAR 1 — Missing Data Protocol: entity(ies) recognized by the
        // scraper but getSynergyContext() found no record / no recommendations.
        // Never silently fall back to fuzzy matching — surface a heuristic instead.
        strategyData.context.heuristicFallback = HEURISTIC_FALLBACKS.category;
        strategyData.context.unresolvedSynergyQuery = synergyTargets.map(t => t.name);
        enrichmentAdded = true;
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

      // NOTE: a generic fallback to ANY scenario guide containing the word
      // "boss" was intentionally removed in a prior version — a false match
      // is worse than no match. If matchedBossKeywords finds nothing
      // scenario-specific, bossGuides stays empty and the heuristicFallback
      // below takes over instead.

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
          // 🎯 RESISTANCE-BASED DEPLOYMENT: surface any resistance field explicitly
          // (e.g. "Ranged-Resistant" / "Melee-Resistant") so the AI can adapt troop
          // recommendations to this specific boss instead of a generic loadout.
          const resistanceNotes = matchedBossRecords
            .filter(b => b.resistance || b.resistances)
            .map(b => ({ boss: b.name, resistance: b.resistance || b.resistances }));
          if (resistanceNotes.length > 0) {
            strategyData.context.bossResistance = resistanceNotes;
          }
        }
        // Always attach the Boss Troop Meta tier list so recommendations stay
        // anchored to the approved priority order (Legendary > Epic > Rare > Common).
        if (strategiesData.bossTroopMeta) {
          strategyData.context.bossTroopMeta = strategiesData.bossTroopMeta;
        }
        enrichmentAdded        = true;
        strategyData.sufficient = true;   // guaranteed — never falls through to "no data found"
      } else {
        // 🆕 PILLAR 1 — Missing Data Protocol: boss keyword was recognized but
        // NO scenario guide, generic boss guide, or boss record exists for it.
        // Inject general boss-fighting heuristic instead of an empty context.
        strategyData.context.detectedBoss     = matchedBossKeywords.join(', ');
        strategyData.context.heuristicFallback = HEURISTIC_FALLBACKS.boss;
        if (strategiesData.bossTroopMeta) {
          strategyData.context.bossTroopMeta = strategiesData.bossTroopMeta;
        }
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

      // 🗜️ PAYLOAD BOUND: filtering already narrows this to matches, but on a
      // generic name (e.g. a hero mentioned in many guides) match count is
      // still unbounded. Cap to the 3 most relevant so one broad query can't
      // silently balloon the context the same way an unfiltered dump would.
      if (relevantCounters.length > 0) {
        strategyData.context.counterGuides = relevantCounters.slice(0, 3);
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

      // 🗜️ PAYLOAD BOUND: same reasoning as counterGuides above — cap matched
      // formations to the 3 most relevant instead of injecting every hit.
      if (relevantFormations.length > 0) {
        strategyData.context.optimalFormations = relevantFormations.slice(0, 3);
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
        // 🗜️ PAYLOAD BOUND: this array is fed by TWO paths (the boss force-inject
        // above, then this generic scenario match), so it can grow unbounded when
        // a query's keywords happen to land in several guides at once. Cap to the
        // 4 most relevant — each guide already carries a dense, formatted
        // description block, so a handful is plenty for the AI to reason from.
        strategyData.context.scenarioGuides = existingScenarios.slice(0, 4);
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

  return { strategyData, enrichmentAdded, embeds };
}

module.exports = { enrichStrategyContext };
