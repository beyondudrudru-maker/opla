const { Events } = require('discord.js');
const { getGoldGuide, getGemGuide } = require('../data/gameData.js');
const supabase = require('../database/supabase.js');
const aiBrain = require('../api/gemini.js');

// 🛡️ GLOBAL DEDUPLICATION SET (Prevents double processing)
const processedMessages = new Set();

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {

        // Ignore bot messages
        if (message.author.bot) return;

        // 🛡️ DEDUPLICATION CHECK
        if (processedMessages.has(message.id)) return;
        processedMessages.add(message.id);
        // Clear message ID after 5 seconds to free up memory
        setTimeout(() => processedMessages.delete(message.id), 5000);

        const msgText = message.content.toLowerCase();

        // ==========================================
        // 1. KEYWORD TRIGGERS (Gold & Gems)
        // ==========================================
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

        // ==========================================
        // 2. DEVELOPER OVERRIDE COMMANDS
        // ==========================================
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

        // ==========================================
        // 3. AI BRAIN LOGIC
        // ==========================================
        // If the bot wasn't mentioned, stop here.
        if (!message.mentions.has(client.user)) return;

        const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

        // Capture who else got @mentioned besides Melody
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
            const { text: aiReply } = await aiBrain.generateContent({
                userId: message.author.id,
                displayName: message.member?.displayName || message.author.username,
                roles: message.member?.roles.cache.map((r) => r.name) || [],
                channelId: message.channel.id,
                content: userMessage,
                isGroupContext: message.channel.type !== 'DM',
                mentions,
            });

            // ✂️ CHUNKING LOGIC (Prevents 2000+ Character Crashes)
            if (aiReply.length > 1950) {
                const chunks = aiReply.match(/(.|[\r\n]){1,1950}(?=\s|$)/g) || [];
                
                for (let i = 0; i < chunks.length; i++) {
                    // Small delay to prevent Discord rate-limiting on long outputs
                    await new Promise(resolve => setTimeout(resolve, 600));
                    
                    if (i === 0) {
                        // First chunk sent as a reply without pinging you
                        await message.reply({ content: chunks[i], allowedMentions: { repliedUser: false } });
                    } else {
                        // Following chunks sent as regular messages
                        await message.channel.send(chunks[i]);
                    }
                }
            } else {
                // Short messages sent normally without pinging you
                await message.reply({ content: aiReply, allowedMentions: { repliedUser: false } });
            }

        } catch (error) {
            console.error('[AI BRAIN ERROR]', error);
            await message.reply('My system is running a bit slow right now, give me a moment! 💤');
        }
    }
};