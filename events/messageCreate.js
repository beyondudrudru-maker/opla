const { Events } = require('discord.js');
const { getGoldGuide, getGemGuide } = require('../data/gameData.js');
const supabase = require('../database/supabase.js');

// 🚀 THE FIX: Import the smart router instead of the old aiBrain
const { generate } = require('../router/modelRouter.js'); 

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
        // 3. SMART HYBRID AI ROUTER
        // ==========================================
        if (!message.mentions.has(client.user)) return;

        const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();
        await message.channel.sendTyping();

        // Construct dynamic context for the AI
        const displayName = message.member?.displayName || message.author.username;
        const roles = message.member?.roles.cache.map(r => r.name).join(', ') || 'None';
        const channelContext = message.channel.type !== 'DM' ? 'Group Chat' : 'Direct Message';
        
        // 🚀 THE FIX: Authoritative System Instruction
        const dynamicSystemInstruction = `
        You are MELODY, a highly intelligent AI assistant for the !NF!N!TY gaming clan.
        Current User: ${displayName}
        User Roles: ${roles}
        Chat Context: ${channelContext}

        CRITICAL DIRECTIVES:
        1. ADAPTABILITY: Mirror the user's language, slang, and energy instantly (e.g., Hinglish, English, etc.).
        2. LIVE DATA: You are connected to the live internet. You MUST use your Google Search tool to look up current events, dates, sports winners, and real-time facts before you reply. Never claim you lack real-time updates.
        `;

        try {
            // Execute our smart router
            const aiResponse = await generate({
                classification: { intent: 'question' }, // Default to question to encourage searching
                prompt: userMessage,
                systemInstruction: dynamicSystemInstruction,
                // Ensure your keys are loaded in your .env file
                geminiKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2], 
                hasGroq: !!process.env.GROQ_API_KEY,
                groqClient: client.groq // Assuming client.groq is initialized in your index.js
            });

            const aiReply = aiResponse.result;

            // ✂️ CHUNKING LOGIC (Prevents 2000+ Character Crashes)
            if (aiReply.length > 1950) {
                const chunks = aiReply.match(/(.|[\r\n]){1,1950}(?=\s|$)/g) || [];
                
                for (let i = 0; i < chunks.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                    if (i === 0) {
                        await message.reply({ content: chunks[i], allowedMentions: { repliedUser: false } });
                    } else {
                        await message.channel.send(chunks[i]);
                    }
                }
            } else {
                await message.reply({ content: aiReply, allowedMentions: { repliedUser: false } });
            }

        } catch (error) {
            console.error('[AI ROUTER ERROR]', error);
            await message.reply('My hybrid engine is running a bit slow right now, give me a moment! 💤');
        }
    }
};
