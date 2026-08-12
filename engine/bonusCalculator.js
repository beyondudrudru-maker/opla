/**
 * engine/bonusCalculator.js
 * 
 * PURPOSE: Manages the dynamic game scaling logic, specifically
 * the Hero Collection Bonus and the Gear Ownership Bonus (0.20% per level).
 */

const { OWNERSHIP_BONUS_RATE_PER_LEVEL } = require('../data/gearData.js');

// Define global Hero Collection Bonus rules
const HERO_BONUS_RULES = {
    description: "Every hero in your collection strengthens the army on the battlefield.",
    isCumulative: true,
    affectedStats: ["HP", "Basic attack power", "Abilities"],
    activeModes: ["Arena", "Boss modes"]
};

// Define global Gear Ownership Bonus rules
const GEAR_OWNERSHIP_RULES = {
    description: "Ownership bonus boosts your army in the battlefield.",
    ratePerLevel: OWNERSHIP_BONUS_RATE_PER_LEVEL, // 0.20%
    affectedStats: ["HP", "Basic attack power", "Abilities"]
};

/**
 * Generates a dynamic disclaimer to ensure the AI always notes that
 * final game power is heavily dependent on levels and upgrades.
 */
function getDynamicScalingDisclaimer() {
    return `💡 **Important Note on Power:** The exact stats and effects in battle depend heavily on multiple dynamic factors. \n- **Gear Ownership Bonus:** Every single level of your gear adds +${OWNERSHIP_BONUS_RATE_PER_LEVEL}% to your army's HP, Attack, and Abilities.\n- **Hero Collection Bonus:** Having more heroes and leveling them up cumulatively boosts your entire army's power in Arena and Boss modes.`;
}

/**
 * Safely fetches a gear's passive value to show scaling ranges.
 */
function formatGearScalingNote(gearItem) {
    if (!gearItem || !gearItem.passive || !gearItem.passive.scaling) return "Scaling data unavailable";
    
    const scaling = gearItem.passive.scaling;
    const statKey = Object.keys(scaling).find(key => key !== 'level');
    
    const minStat = scaling[statKey][0];
    const maxStat = scaling[statKey][scaling[statKey].length - 1];
    
    return `Passive effect scales based on item level (e.g., from ${minStat}% up to ${maxStat}%+ at higher levels).`;
}

module.exports = {
    HERO_BONUS_RULES,
    GEAR_OWNERSHIP_RULES,
    getDynamicScalingDisclaimer,
    formatGearScalingNote
};
