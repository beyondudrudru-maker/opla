const { Events } = require('discord.js');

// 📥 IMPORT YOUR MODULES
const { getGoldGuide, getGemGuide } = require('../data/gameData.js');
const aiBrain = require('../ai/gemini.js'); 
const supabase = require('../database/supabase.js'); 

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {
        
        // 🛑 GUARD 1: Ignore all bot messages to prevent infinite loops
        if (message.author.bot) return;

        // 📝 Normalize the text to lowercase so keywords match easily
        const msgText = message.content.toLowerCase();

        // ─── 🟢 PASSIVE LISTENER: KEYWORD INTERVENTION (0 API Cost) ───
        
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

        // ─── 🟡 DEVELOPER OVERRIDE: REAL SUPABASE FETCH ───
        
        if (msgText.includes('fetch chats from supabase') || msgText.includes('present all chats')) {
            
            // SECURITY: Only Beyonder (You) can run this code
            if (message.author.id !== '1369404203880939650') {
                return message.reply("❌ **Access Denied:** You do not have clearance to view server logs.");
            }

            await message.channel.send("🔄 Accessing the secure Supabase archives for you right now, my King... please wait.");

            try {
                // ⚠️ IMPORTANT: Change 'chat_logs' to your actual Supabase table name
                const { data, error } = await supabase
                    .from('chat_logs') 
                    .select('*')
                    .order('created_at', { ascending: false }) // Gets the newest messages
                    .limit(5); // Grabs the last 5 logs

                if (error) throw error;

                if (!data || data.length === 0) {
                    return message.channel.send("I checked the database, but the table is currently empty!");
                }

                let logMessage = "**📜 Here are the most recent records:**\n\n";
                
                // ⚠️ IMPORTANT: Change 'username' and 'message' to your actual column names
                data.forEach(row => {
                    logMessage += `> **[${row.id}] ${row.username || 'User'}:** ${row.message || '[No Content]'}\n`;
                });

                return message.channel.send(logMessage);

            } catch (err) {
                console.error('[SUPABASE ERROR]', err);
                return message.channel.send("⚠️ I encountered a critical error while trying to connect to the database.");
            }
        }

        // ─── 🔴 ACTIVE LISTENER: AI BRAIN (REQUIRES @MENTION) ───
        
        // 🛑 GUARD 2: Check if the bot was actually tagged before waking up the AI
        if (!message.mentions.has(client.user)) return;

        // Clean the mention out of the text so the AI only reads the user's actual question
        const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

        await message.channel.sendTyping();

        try {
            // Send the cleaned message to your Gemini Dual-Core engine
            const response = await aiBrain.generateContent(userMessage);
            await message.reply(response.response.text());
        } catch (error) {
            console.error('[AI BRAIN ERROR]', error);
            await message.reply('My system is running a bit slow right now, give me a moment! 💤');
        }
    }
};