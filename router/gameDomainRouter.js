/**
 * router/gameDomainRouter.js
 *
 * Discord message -> intentClassifier -> HERE -> either:
 *   { resolved: true, reply }          (answered by JS, no AI)
 *   { resolved: false, context, intent, entities }  (needs AI interpretation)
 *
 * Never sends full game data anywhere. Preserves the existing gold/gem
 * keyword-trigger behavior in messageCreate.js untouched — this router
 * is for the @mention / structured-question path, and additionally
 * exposes deterministic gold/gem math (ratios, allocation) that the
 * keyword trigger doesn't do today.
 */

const { INTENTS, classify } = require('./gameIntentClassifier.js');
const queryEngine = require('../gameQueryEngine.js');
const strategyEngine = require('../gameStrategyEngine.js');
const squadCalculator = require('../engine/squadCalculator.js');
const strategyContextBuilder = require('./strategyContextBuilder.js');
const { getGoldRatio, getGemRatio, allocateGold, allocateGems } = require('../data/economyRatios.js');

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : n;
}

function handleGold(entities) {
  if (entities.goldGemAmount) {
    const plan = allocateGold(entities.goldGemAmount);
    return {
      resolved: true,
      reply: `For ${fmt(entities.goldGemAmount)} gold: ${fmt(plan.troopRecruitment)} troop recruitment, ` +
        `${fmt(plan.heroUpgrades)} hero upgrades, ${fmt(plan.fusions)} fusions, ${fmt(plan.emergencyReserve)} emergency reserve.`
    };
  }
  const r = getGoldRatio();
  return {
    resolved: true,
    reply: `Gold ratio: ${r.troopRecruitment}% troop recruitment, ${r.heroUpgrades}% hero upgrades, ${r.fusions}% fusions, ${r.emergencyReserve}% emergency reserve.`
  };
}

function handleGem(entities) {
  if (entities.goldGemAmount) {
    const plan = allocateGems(entities.goldGemAmount);
    return {
      resolved: true,
      reply: `For ${fmt(entities.goldGemAmount)} gems: ${fmt(plan.troopHeroFusions)} troop/hero fusions, ` +
        `${fmt(plan.highLevelHeroUpgrades)} high-level hero upgrades, ${fmt(plan.legendaryBundles)} legendary bundles, ` +
        `${fmt(plan.luckyWheel)} lucky wheel, ${fmt(plan.operationalReserve)} operational reserve.`
    };
  }
  const r = getGemRatio();
  return {
    resolved: true,
    reply: `Gem ratio: ${r.troopHeroFusions}% troop/hero fusions, ${r.highLevelHeroUpgrades}% high-level hero upgrades, ` +
      `${r.legendaryBundles}% legendary bundles, ${r.luckyWheel}% lucky wheel, ${r.operationalReserve}% operational reserve.`
  };
}

function handleFact(entities) {
  const { troopName, levels, stat, ability } = entities;
  const level = levels[0];
  if (!troopName) return { resolved: false, error: 'Could not identify a troop name in the message.' };
  if (!level) return { resolved: false, error: 'Levels available: 1–10. Please specify a level.' };

  if (ability) {
    const abilityInfo = queryEngine.getTroopAbility(troopName, level);
    if (!abilityInfo) return { resolved: false, error: `"${troopName}" not found.` };
    if (!abilityInfo.name) return { resolved: true, reply: `${abilityInfo.troopName} has no ability.` };
    const parts = Object.entries(abilityInfo.statsAtLevel || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    return { resolved: true, reply: `${abilityInfo.troopName} Lv${level} — ${abilityInfo.name}: ${abilityInfo.description} (${parts})` };
  }

  const s = queryEngine.getTroopLevel(troopName, level);
  if (!s) return { resolved: false, error: `Level ${level} is invalid, or "${troopName}" was not found. Levels available: 1–10.` };

  if (stat && s[stat] !== undefined) {
    return { resolved: true, reply: `${s.troopName} Lv${level} ${stat}: ${fmt(s[stat])}` };
  }
  // Generic full stat line (stat keyword didn't map to a direct field)
  return {
    resolved: true,
    reply: `${s.troopName} Lv${level} has ${fmt(s.hp)} HP, ${fmt(s.damage)} damage, ${fmt(s.defense)} defense and ${s.units} units.`
  };
}

function handleCalc(entities) {
  const { troopName, troopNames, levels, counts } = entities;
  const uniqueLevels = [...new Set(levels)];

  // Cross-troop squad comparison takes priority: "3 Lava Golem lvl7 vs 2
  // Immortal lvl7" mentions two distinct troops even if the level number
  // repeats (same level for both squads) — that must not be mistaken for
  // a same-troop level-to-level growth question.
  if (troopNames.length >= 2) {
    const level = levels[0] || 10;
    // Preserve the order troops actually appear in the raw text, not the
    // order they appear in gameKnowledge.js — entities.troopNames is
    // built by scanning the library, so re-detect count-to-troop pairing
    // isn't reliable beyond "first count -> first named troop, second
    // count -> second named troop" as extracted.
    const countA = counts[0] || 1;
    const countB = counts[1] || 1;
    const result = squadCalculator.compareSquads(
      [{ troop: troopNames[0], level, count: countA }],
      [{ troop: troopNames[1], level, count: countB }]
    );
    const a = result.squadA.totals, b = result.squadB.totals;
    return {
      resolved: true,
      reply: `${countA} ${troopNames[0]} Lv${level} (HP ${fmt(a.totalHp)}, Damage ${fmt(a.totalDamage)}) vs ` +
        `${countB} ${troopNames[1]} Lv${level} (HP ${fmt(b.totalHp)}, Damage ${fmt(b.totalDamage)})` +
        (result.note ? `\nNote: ${result.note}` : '')
    };
  }

  // Same-troop level-to-level growth
  if (troopName && uniqueLevels.length >= 2) {
    const cmp = strategyEngine.compareTroopLevels(troopName, uniqueLevels[0], uniqueLevels[1]);
    if (cmp.error) return { resolved: false, error: cmp.error };
    return {
      resolved: true,
      reply: `${troopName} Lv${uniqueLevels[0]} → Lv${uniqueLevels[1]}:\n` +
        `HP: ${fmt(cmp.levelA.hp)} → ${fmt(cmp.levelB.hp)} (${cmp.absoluteGrowth.hp >= 0 ? '+' : ''}${fmt(cmp.absoluteGrowth.hp)} / ${cmp.percentageGrowth.hp >= 0 ? '+' : ''}${cmp.percentageGrowth.hp}%)\n` +
        `Damage: ${fmt(cmp.levelA.damage)} → ${fmt(cmp.levelB.damage)} (${cmp.absoluteGrowth.damage >= 0 ? '+' : ''}${fmt(cmp.absoluteGrowth.damage)} / ${cmp.percentageGrowth.damage >= 0 ? '+' : ''}${cmp.percentageGrowth.damage}%)`
    };
  }

  return { resolved: false, error: 'Need two levels of the same troop, or two troops, to calculate a comparison.' };
}

/**
 * route(rawText) -> { resolved: true, reply } | { resolved: false, intent, entities, context, error }
 */
function route(rawText) {
  const { intent, entities } = classify(rawText);

  switch (intent) {
    case INTENTS.GOLD:
      return { intent, entities, ...handleGold(entities) };
    case INTENTS.GEM:
      return { intent, entities, ...handleGem(entities) };
    case INTENTS.FACT: {
      const r = handleFact(entities);
      if (r.resolved) return { intent, entities, ...r };
      // fall through to strategy context builder if FACT couldn't resolve
      break;
    }
    case INTENTS.CALC: {
      const r = handleCalc(entities);
      if (r.resolved) return { intent, entities, ...r };
      break;
    }
    default:
      break;
  }

  // STRATEGY, or FACT/CALC that couldn't be resolved deterministically:
  // hand off a compact context for the AI layer.
  const built = strategyContextBuilder.build(intent, entities, rawText);
  if (!built.sufficient) {
    return { intent, entities, resolved: false, context: null, error: built.error || 'Could not resolve this question deterministically.' };
  }
  return { intent, entities, resolved: false, context: built.context };
}

module.exports = { route };
