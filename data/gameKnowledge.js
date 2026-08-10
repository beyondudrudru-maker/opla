/**
 * data/gameKnowledge.js
 * 
 * PURPOSE: Central Hub for all modular game data. 
 * Combines split data files into one neat package for the Query Engine.
 */

const heroes = require('./heroes.js');
const troops = require('./troops.js');
const bosses = require('./bosses.js');
const synergies = require('./synergies.js');
const formulas = require('./formulas.js');
const strategies = require('./strategies.js'); // Now actively importing your new strategies!

const gameLibrary = {
  heroes,
  troops,
  bosses,
  // We handle potential variations in how Claude might have exported synergies
  troopHeroSynergy: synergies.troopHeroSynergy || synergies,
  heroSynergyIndex: synergies.heroSynergyIndex || [],
  indexes: synergies.indexes || {},
  formulas,
  strategies // Making strategies available to the rest of your bot!
};

module.exports = { gameLibrary };
