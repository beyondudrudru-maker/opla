/**
 * events/messageCreate.js
 *
 * PURPOSE
 *   The primary entry point for Discord messages.
 *   Orchestrates the flow: Discord -> Deterministic Gatekeeper -> Decision Pipeline -> AI -> Memory
 *
 * 🚀 FIX (this version)
 *   Previously, when gameDomainRouter returned an unresolved strategy
 *   context, it was pretty-printed (JSON.stringify(context, null, 2)) and
 *   appended RAW to the prompt, then sent via modelRouter.generate()
 *   directly with a generic persona instruction — completely bypassing
 *   compressGameData/fitGameDataToBudget, the STRATEGY-specific rules
 *   (zero-hallucination lock, boss vs PvP logic, gear-fallback wording),
 *   and the gatekeeper retry loop. That's fixed here: any message carrying
 *   a gameDomainRouter context (or detected as a game turn) now routes
 *   through aiFallback.askAI(), which handles compression, the modular
 *   per-query-type instruction, the deterministic-cache fast path, and
 *   retries — all in one place instead of three disconnected ones.
 *   Non-game/social messages are unaffected and still use the generic
 *   Melody persona instruction via modelRouter.generate() directly.
 */

const { Events } = require('discord.js');
const { getGoldGuide, getGemGuide } = require('../data/gameData.js');
const supabase = require('../database/supabase.js');

const { planTurn, finalizeTurn, isGameTurn } = require('../decision/decisionPipeline.js');
const { generate } = require('../router/modelRouter.js');
const { askAI } = require('../ai/aiFallback.js');

const gameDomainRouter = require('../router/gameDomainRouter.js');

const processedMessages = new Set();

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {

        if (message.author.bot) return;

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
        // 3. FULL AI PIPELINE ORCHESTRATION
        // ==========================================
        if (!message.mentions.has(client.user)) return;

        const rawUserMessage = message.content.replace(`<@${client.user.id}>`, '').trim();
        await message.channel.sendTyping();

        // 🚀 THE GATEKEEPER: DETERMINISTIC GAME ROUTING LAYER
        let gameResult = { resolved: false, context: null, intent: 'UNKNOWN', queryFlags: {}, entities: {} };
        try {
            gameResult = gameDomainRouter.route(rawUserMessage);
            console.log(`[GAME ROUTER] input="${rawUserMessage}" intent=${gameResult.intent} resolved=${gameResult.resolved}`);
        } catch (err) {
            console.error('❌ [GAME ROUTER ERROR]', err);
        }

        // IF RESOLVED: Instant deterministic answer. Bypass AI completely.
        if (gameResult.resolved === true) {
            console.log(`[GAME ROUTER] Deterministic answer — AI bypassed`);
            try {
                await finalizeTurn({
                    channelId: message.channel.id,
                    userId: message.author.id,
                    content: rawUserMessage,
                    responseText: gameResult.reply
                });
            } catch (memErr) {
                console.error('❌ [MEMORY LOGGING ERROR]', memErr);
            }
            return await message.reply({ content: gameResult.reply, allowedMentions: { repliedUser: false } });
        }

        console.log(`[GAME ROUTER] Falling through — has context: ${!!gameResult.context}`);

        const displayName = message.member?.displayName || message.author.username;
        const roles = message.member?.roles.cache.map(r => r.name) || [];
        const isGroupContext = message.channel.type !== 'DM';

        const mentions = {
            everyone: message.mentions.everyone,
            users: [...message.mentions.users.values()]
                .filter((u) => u.id !== client.user.id)
                .map((u) => ({
                    id: u.id,
                    name: message.guild?.members.cache.get(u.id)?.displayName || u.username,
                })),
        };

        const genericSystemInstruction = `
        You are MELODY, a highly intelligent AI assistant for the !NF!N!TY gaming clan.
        CRITICAL DIRECTIVES:
        1. ADAPTABILITY: Mirror the user's language, slang, and energy instantly (e.g., Hinglish, English, etc.).
        2. LIVE DATA: You are connected to the live internet. You MUST use your Google Search tool to look up current events, dates, sports winners, and real-time facts before you reply. Never claim you lack real-time updates.
        3. CONTEXT PARSING: You will receive XML tags representing the user's emotional state, relationship tier, and past memory. Use this to inform your personality natively. Do NOT mention the XML tags to the user.
        `;

        try {
            const turnData = await planTurn({
                userId: message.author.id,
                displayName,
                roles,
                channelId: message.channel.id,
                content: rawUserMessage,
                isGroupContext,
                mentions
            });

            // 🚀 THE FIX: a game-router context (resolved:false + context present)
            // now routes through aiFallback.askAI() — compression, per-type
            // instruction, deterministic-cache fast path, and gatekeeper retry
            // all happen there instead of raw JSON being glued onto a generic
            // prompt. Non-game messages are untouched and still use generate()
            // directly with the persona instruction.
            const hasGameContext = !!gameResult.context;
            const gameTurnDetected = isGameTurn({ content: rawUserMessage, gameData: gameResult.context, intent: turnData.classification?.intent });

            let aiReply;

            if (hasGameContext || gameTurnDetected) {
                aiReply = await askAI({
                    userMessage: rawUserMessage,
                    intent: turnData.classification?.intent,
                    context: gameResult.context,
                    geminiKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2],
                    groqKeys: [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean),
                    classification: turnData.classification,
                    queryFlags: gameResult.queryFlags || {},
                    deterministic: gameResult.deterministic || null,
                });
            } else {
                const aiResponse = await generate({
                    classification: turnData.classification,
                    prompt: turnData.prompt,
                    userMessage: rawUserMessage,
                    systemInstruction: genericSystemInstruction,
                    geminiKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2],
                    hasGroq: !!process.env.GROQ_API_KEY,
                    groqClient: client.groq
                });
                aiReply = aiResponse.result;
            }

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

            await finalizeTurn({
                channelId: message.channel.id,
                userId: message.author.id,
                content: rawUserMessage,
                responseText: aiReply
            });

        } catch (error) {
            console.error('❌ [AI PIPELINE ERROR]', error);
            await message.reply('My hybrid engine is running a bit slow right now, give me a moment! 💤');
        }
    }
};
