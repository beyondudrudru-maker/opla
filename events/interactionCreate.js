/**
 * events/interactionCreate.js
 * 
 * PURPOSE
 *   Handles interactions from Discord components (Buttons, Select Menus, etc.).
 *   Listens for button clicks like "Yes, show me!" for the gold blueprint.
 */

const { Events } = require('discord.js');
const { getGoldGuide, getGemGuide } = require('../data/gameData.js');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction, client) {
        // We only care about button interactions for now
        if (!interaction.isButton()) return;

        const { customId } = interaction;

        // Handle the gold blueprint button click
        if (customId === 'show_gold_blueprint') {
            const goldEmbed = getGoldGuide();
            return await interaction.reply({
                content: `✨ Here is the Ultimate Gold Blueprint you asked for, ${interaction.user}:`,
                embeds: [goldEmbed],
                ephemeral: false // Set to true if you want only the user who clicked to see it
            });
        }

        // Handle the gem blueprint button click if you have one
        if (customId === 'show_gem_blueprint') {
            const gemEmbed = getGemGuide();
            return await interaction.reply({
                content: `💎 Here is the Premium Gem Matrix for you, ${interaction.user}:`,
                embeds: [gemEmbed],
                ephemeral: false
            });
        }
    }
};
