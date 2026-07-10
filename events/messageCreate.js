const { Events } = require('discord.js');

const { getGoldGuide, getGemGuide } = require('../data/gameData.js');
const supabase = require('../database/supabase.js');
const aiBrain = require('../api/gemini.js');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {

        if (message.author.bot) return;

        const msgText = message.content.toLowerCase();

        if (msgText.includes('need gold') || msgText.includes('less gold') || msgText.includes('struggling for gold') || msgText.includes('how to get gold')) {
            const goldEmbed = getGoldGuide();
            return message.channel.send({
                content: `✨ Hey ${message.author}, I overheard you talking about gold! Here is the Clan Blueprint:`,
                embeds: [goldEmbed]
            });
        }

        if (msgText.includes('need gems') || msgText.includes('how to get gems') || msgText.includes('less gems') || msgText.includes('struggling for gems')) {
            const gemEmbed = getGemGuide();
            return message.channel.send({
                content: `💎 Hey ${message.author}, need some premium currency? Check this out:`,
                embeds: [gemEmbed]
            });
        }

        if (msgText.includes('fetch chats from supabase') || msgText.includes('present all chats')) {
            if (message.author.id !== '1369404203880939650') {
                return message.reply("❌ **Access Denied:** You do not have clearance to view server logs.");
            }
            await message.channel.send("🔄 Accessing the secure Supabase archives for you right now, my King... please wait.");
            try {
                const { data, error } = await supabase
                    .from('chat_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (error) throw error;
                if (!data || data.length === 0) {
                    return message.channel.send("I checked the database, but the table is currently empty!");
                }
                let logMessage = "**📜 Here are the most recent records:**\n\n";
                data.forEach(row => {
                    logMessage += `> **[${row.id}] ${row.username || 'User'}:** ${row.message || '[No Content]'}\n`;
                });
                return message.channel.send(logMessage);
            } catch (err) {
                console.error('[SUPABASE ERROR]', err);
                return message.channel.send("⚠️ I encountered a critical error while trying to connect to the database.");
            }
        }

        if (!message.mentions.has(client.user)) return;

        const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

        // NEW: capture who else got @mentioned besides Melody
        const mentions = {
            everyone: message.mentions.everyone,
            users: [...message.mentions.users.values()]
                .filter((u) => u.id !== client.user.id)
                .map((u) => ({
                    id: u.id,
                    name: message.guild?.members.cache.get(u.id)?.displayName || u.username,
                })),
        };

        await message.channel.sendTyping();

        try {
            const { text } = await aiBrain.generateContent({
                userId: message.author.id,
                displayName: message.member?.displayName || message.author.username,
                roles: message.member?.roles.cache.map((r) => r.name) || [],
                channelId: message.channel.id,
                content: userMessage,
                isGroupContext: message.channel.type !== 'DM',
                mentions,
            });

            await message.reply(text);

        } catch (error) {
            console.error('[AI BRAIN ERROR]', error);
            await message.reply('My system is running a bit slow right now, give me a moment! 💤');
        }
    }
};