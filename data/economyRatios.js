/**
 * data/economyRatios.js
 *
 * Structured economy allocation data, additive to the existing prose
 * gold/gem guides in data/gameData.js (getGoldGuide / getGemGuide are
 * NOT replaced — keep using those for the Discord embed trigger).
 *
 * This module exists so JS can answer "what's the ratio" and "how should
 * I spend N gold/gems" without any AI call.
 */

const economyRatios = {
  gold: {
    troopRecruitment: 50,
    heroUpgrades: 20,
    fusions: 10,
    emergencyReserve: 20
  },
  gems: {
    troopHeroFusions: 40,
    highLevelHeroUpgrades: 20,
    legendaryBundles: 20,
    luckyWheel: 10,
    operationalReserve: 10
  }
};

function _splitAmount(amount, ratios) {
  const breakdown = {};
  for (const [key, pct] of Object.entries(ratios)) {
    breakdown[key] = Math.round(amount * (pct / 100));
  }
  return breakdown;
}

function getGoldRatio() {
  return economyRatios.gold;
}

function getGemRatio() {
  return economyRatios.gems;
}

/** allocateGold(100000) -> { troopRecruitment: 50000, heroUpgrades: 20000, ... } */
function allocateGold(amount) {
  if (typeof amount !== 'number' || amount <= 0) return null;
  return _splitAmount(amount, economyRatios.gold);
}

/** allocateGems(5000) -> { troopHeroFusions: 2000, ... } */
function allocateGems(amount) {
  if (typeof amount !== 'number' || amount <= 0) return null;
  return _splitAmount(amount, economyRatios.gems);
}

module.exports = { economyRatios, getGoldRatio, getGemRatio, allocateGold, allocateGems };
