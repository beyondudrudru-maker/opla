/**
 * data/economyRatios.js
 *
 * Structured economy allocation data, additive to the existing prose
 * gold/gem guides in data/gameData.js (getGoldGuide / getGemGuide are
 * NOT replaced — keep using those for the Discord embed trigger).
 *
 * This module exists so JS can answer "what's the ratio" and "how should
 * I spend N gold/gems" without any AI call, and now includes game guides and raw data.
 */

const { EmbedBuilder } = require('discord.js');

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

// ============================================================
// EMBED GUIDES & RAW DATA INTEGRATION
// ============================================================

function getGuideMenu() {
    return new EmbedBuilder()
        .setColor('#1abc9c')
        .setTitle('📚 INFCOMMAND AI: Tactical Library')
        .setDescription('Access advanced clan blueprints and meta strategies by typing a command below:')
        .addFields(
            { name: '💰 !guide gold', value: 'The Ultimate Gold Farming & Spending Blueprint' },
            { name: '⚔️ !guide arena', value: 'The Arena Masterclass: Trophies, Tactics & Psychology' },
            { name: '💎 !guide gem', value: 'The Premium Gem Matrix: Acquisition & Optimal Spending' },
            { name: '💥 !guide clash', value: 'Operation Clan Clash: Tactical Deployment & Scoring Supremacy' },
            { name: '🛡️ !guide troops', value: 'The Strategic Army Composition: Baseline Minimum Requirements' }
        )
        .setFooter({ text: '!NF!N!TY Clan // Database Query' });
}

function getGoldGuide() {
    return new EmbedBuilder()
        .setColor('#f1c40f') 
        .setTitle('📖 The Ultimate Gold Farming & Spending Blueprint')
        .setDescription('*Maximize your gold income in the Arena and learn the strict 50-20-10 reserve blueprint for spending.*')
        .addFields(
            { 
                name: '🏟️ PART 1: ARENA FARMING TACTICS', 
                value: '1. **The 7-Day Trap:** For the first 7 days of a new Arena season, purposefully set a weak or normal defense formation. This keeps your rank lower, allowing you to easily farm weaker opponents.\n\n2. **Target Prioritization:** When refreshing opponents, hunt for players using the **441 troop formation**.\n\n3. **Deploy the Baron:** Upgrade and deploy Baron exclusively for farming runs (generates a +1.5% gold boost).' 
            },
            { 
                name: '💰 PART 2: THE GOLDEN SPENDING BLUEPRINT', 
                value: 'Never spend gold randomly. Hoard your wealth and divide it using this exact ratio:\n\n**50% — Troop Recruitment:** Always save up for 120k gold pulls.\n**20% — Hero Upgrades:** Priority order: Legendary → Epic → Mythical.\n**10% — Fusions:** Strictly on necessary troop/hero fusions.\n**20% — Emergency Reserve:** DO NOT TOUCH. Keep as backup.' 
            },
            { 
                name: '📈 PART 3: MULTIPLIERS & DAILIES', 
                value: '• **Headhunt Sweeps:** Play Headhunt 2-3 times daily for steady gold and gems.\n• **Ad Multipliers:** Always watch ads at the end of battles to double revenue.\n• **Double Gold Card Rule:** Do NOT waste these! Only activate if your base earning is already hitting **14k to 15k gold**.' 
            }
        )
        .setFooter({ text: '!NF!N!TY Clan // Meta Blueprint' });
}

function getGemGuide() {
    return new EmbedBuilder()
        .setColor('#9b59b6') 
        .setTitle('📖 The Gem Matrix: Acquisition & Optimal Spending')
        .setDescription('*Master the secrets of gem farming—including the Library milestone loop—and decode the 40-20-20-10 spending hierarchy.*')
        .addFields(
            { 
                name: '💎 PART 1: THE ULTIMATE GEM HARVESTING STREAMS', 
                value: '• **The Library Exploitation:** Your primary hidden goldmine. Execute stages to gather library books. Once you hit the **150-book milestone**, every single book collected after that yields a massive **50 gems**!\n• **Competitive Yields:** Secure top ranks in the Arena and Boss Raids for massive seasonal payloads. Supplement daily with Headhunt missions, level-dependent Idle Chests, and Campaign stages.\n• **System Bonuses:** Claim Daily Logins and Promo Codes (frequently awarding up to 500 gems instantly). Use daily Lucky Royale spins for jackpots up to 20k gems.\n• **Premium Access:** Purchase store bundles or invest in Seasonal Battle Passes for high-density gem returns.' 
            },
            { 
                name: '⚔️ PART 2: TACTICAL FUSION & DEPLOYMENT TRICKS', 
                value: '• **The Gem-Saving Fusion Meta:** Troop fusion consumes heavy resources. While a standard 4 + 4 + 4 unit level layout is common, veteran players deploy the highly efficient **10 + 4 + 1 configuration** to bypass extreme fusion costs and save massive gem counts.\n• **Calculated Investments:** Spend gems strictly on critical Hero Upgrades (Level 7+), buying high-value 3k Hero Bundles, and targeted Lucky Wheel cycles. Avoid buying single 350-gem chests.' 
            },
            { 
                name: '📊 PART 3: THE CLAN GEM BUDGET MATRIX', 
                value: 'Apply your gathered gems strictly to this percentage layout to prevent running dry:\n\n**40% — Troop & Hero Fusions:** Main spending engine to forge max-tier units.\n**20% — High-Level Hero Upgrades:** Unlock crucial ability stats past Level 7.\n**20% — Legendary Bundles:** Mandatory to raise your Legendary collection and unlock global Hero Bonuses.\n**10% — Lucky Wheel Spins:** For resource cycling and picking up extra upgrade materials.\n**10% — Operational Reserves:** Kept for emergency purchases, Conquest unlocks (1700 gems for massive value), or Demo mode testing (10 gems per Boss run).' 
            }
        )
        .setFooter({ text: '// DIRECTIVE RECEIVED — COLLECT AND USE WISELY //\n!NF!N!TY Clan // Meta Blueprint' });
}

const rawGoldData = `
PART 1: ARENA FARMING TACTICS
1. The 7-Day Trap: For the first 7 days of a new Arena season, purposefully set a weak or normal defense formation. This keeps your rank lower, allowing you to easily farm weaker opponents.
2. Target Prioritization: When refreshing opponents, hunt for players using the 441 troop formation.
3. Deploy the Baron: Upgrade and deploy Baron exclusively for farming runs (generates a +1.5% gold boost).
PART 2: THE GOLDEN SPENDING BLUEPRINT
Never spend gold randomly. Hoard your wealth and divide it using this exact ratio:
50% — Troop Recruitment: Always save up for 120k gold pulls.
20% — Hero Upgrades: Priority order: Legendary -> Epic -> Mythical.
10% — Fusions: Strictly on necessary troop/hero fusions.
20% — Emergency Reserve: DO NOT TOUCH. Keep as backup.
PART 3: MULTIPLIERS & DAILIES
• Headhunt Sweeps: Play Headhunt 2-3 times daily for steady gold and gems.
• Ad Multipliers: Always watch ads at the end of battles to double revenue.
• Double Gold Card Rule: Do NOT waste these! Only activate if your base earning is already hitting 14k to 15k gold.
`;

const rawGemData = `
PART 1: THE ULTIMATE GEM HARVESTING STREAMS
• The Library Exploitation: Your primary hidden goldmine. Execute stages to gather library books. Once you hit the 150-book milestone, every single book collected after that yields a massive 50 gems!
• Competitive Yields: Secure top ranks in the Arena and Boss Raids for massive seasonal payloads. Supplement daily with Headhunt missions, level-dependent Idle Chests, and Campaign stages.
• System Bonuses: Claim Daily Logins and Promo Codes. Use daily Lucky Royale spins for jackpots up to 20k gems.
• Premium Access: Purchase store bundles or invest in Seasonal Battle Passes.
PART 2: TACTICAL FUSION & DEPLOYMENT TRICKS
• The Gem-Saving Fusion Meta: Troop fusion consumes heavy resources. While a standard 4 + 4 + 4 unit level layout is common, veteran players deploy the highly efficient 10 + 4 + 1 configuration to bypass extreme fusion costs and save massive gem counts.
• Calculated Investments: Spend gems strictly on critical Hero Upgrades (Level 7+), buying high-value 3k Hero Bundles, and targeted Lucky Wheel cycles. Avoid buying single 350-gem chests.
PART 3: THE CLAN GEM BUDGET MATRIX
Apply your gathered gems strictly to this percentage layout to prevent running dry:
40% — Troop & Hero Fusions: Main spending engine to forge max-tier units.
20% — High-Level Hero Upgrades: Unlock crucial ability stats past Level 7.
20% — Legendary Bundles: Mandatory to raise your Legendary collection and unlock global Hero Bonuses.
10% — Lucky Wheel Spins: For resource cycling and picking up extra upgrade materials.
10% — Operational Reserves: Kept for emergency purchases, Conquest unlocks (1700 gems), or Demo mode testing (10 gems per Boss run).
`;

module.exports = { 
  economyRatios, 
  getGoldRatio, 
  getGemRatio, 
  allocateGold, 
  allocateGems,
  getGuideMenu,
  getGoldGuide,
  getGemGuide,
  rawGoldData,
  rawGemData
};
