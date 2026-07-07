// data/gameData.js
const { EmbedBuilder } = require('discord.js');

// 1. MAIN GUIDE MENU (!guide)
function getGuideMenu() {
    return new EmbedBuilder()
        .setColor('#1abc9c') // Cyan color (Screenshot jaisa)
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

// 2. GOLD GUIDE EMBED (!guide gold)
function getGoldGuide() {
    return new EmbedBuilder()
        .setColor('#f1c40f') // Gold/Yellow color
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

module.exports = { getGuideMenu, getGoldGuide };