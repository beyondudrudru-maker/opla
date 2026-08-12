/**
 * engine/bonusCalculator.js
 * 
 * PURPOSE: Manages the logic for dynamic game scaling, including
 * level-dependent gear passives and the cumulative Hero Bonus.
 */

// Define the global rules for the Hero Bonus based on game mechanics
const HERO_BONUS_RULES = {
    description: "Every hero in your collection has a bonus that strengthens the army on the battlefield.",
    isCumulative: true,
    scalingFactors: ["level", "rarity"],
    affectedStats: ["HP", "basic attack", "abilities"],
    activeModes: ["Arena", "Boss modes"]
};

/**
 * Generates a standard disclaimer about the Hero Bonus to append to responses.
 * @returns {string} The formatted disclaimer.
 */
function getHeroBonusDisclaimer() {
    return `💡 **Note on Power:** Overall army strength is heavily influenced by your cumulative Hero Bonus. This bonus scales with every hero's level and rarity, boosting HP, attack, and abilities for all units in Arena and Boss modes.`;
}

/**
 * Safely fetches a gear's passive value based on its level.
 * @param {Object} gearItem - The gear object from your database.
 * @param {number} requestedLevel - The level the user is asking about.
 * @returns {string} The value at that level, or a dynamic range if level is unknown.
 */
function getGearPassiveAtLevel(gearItem, requestedLevel) {
    if (!gearItem || !gearItem.passive || !gearItem.passive.scaling) {
        return "Data unavailable";
    }

    const scaling = gearItem.passive.scaling;
    const levelIndex = scaling.level.indexOf(requestedLevel);

    // If we have the exact level data, return it
    if (levelIndex !== -1) {
        // Find the specific stat array (e.g., damageIncreasePercent)
        const statKey = Object.keys(scaling).find(key => key !== 'level');
        return `${scaling[statKey][levelIndex]}% (at Level ${requestedLevel})`;
    }

    // If exact level isn't provided, return a dynamic range to show scaling
    const statKey = Object.keys(scaling).find(key => key !== 'level');
    const minStat = scaling[statKey][0];
    const maxStat = scaling[statKey][scaling[statKey].length - 1];
    const maxLevel = scaling.level[scaling.level.length - 1];
    
    return `Scales from ${minStat}% (Lv. 1) to ${maxStat}% (Lv. ${maxLevel}). Exact value depends on your item level.`;
}

module.exports = {
    HERO_BONUS_RULES,
    getHeroBonusDisclaimer,
    getGearPassiveAtLevel
};
