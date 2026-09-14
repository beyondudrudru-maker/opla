const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Partials, 
    EmbedBuilder 
} = require('discord.js');
const express = require('express');

const { ramClient } = require('./database/supabaseClient');
const melody = require('./api/gemini');
const knowledgeRetrieval = require('./knowledge/knowledgeRetrieval');
const reflectionJob = require('./reflection/reflectionJob');
const { getGoldGuide, rawGoldData, getGemGuide, rawGemData } = require('./data/gameData');

const gameDomainRouter = require('./router/gameDomainRouter');
const { compressGameData } = require('./promptBuilder/promptAssembler');
const { askAI: askGameAI } = require('./ai/aiFallback');
const requestQueue = require('./utils/requestQueue');

const processedMessages = new Set();

const app = express();
app.get('/', (req, res) => res.send('✨ INF AI Core is awake and monitoring.'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`🌐 Web Server running.`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers // Required to resolve names from text
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction
    ]
});

const supportCooldown = new Set();
const goldCooldown = new Set();
const gemCooldown = new Set();
const adminCooldown = new Set();

// ─────────────────────────────────────────────────────────────
// 🔍 Helper: Fuzzy & Normalized Member Name Resolver
// ─────────────────────────────────────────────────────────────
const COMMON_IGNORE_WORDS = new Set([
    'alert', 'them', 'play', 'complete', 'their', 'clan', 'clash', 'battle', 
    'tell', 'with', 'about', 'from', 'this', 'that', 'here', 'there', 'what',
    'please', 'help', 'roast', 'insult', 'kick', 'babe', 'honey', 'love',
    'notify', 'events', 'event', 'other', 'guys', 'karo', 'both', 'also'
]);

function cleanName(str) {
    if (!str) return '';
    // Strip common clan tags like !N, [IND], emojis, and punctuation
    return str
        .toLowerCase()
        .replace(/[!|\[\(].*?[\]\)]/g, '') // strip brackets like [IND]
        .replace(/[^a-z0-9\s]/g, ' ')     // replace special symbols with spaces
        .replace(/\s+/g, ' ')
        .trim();
}

function resolveMembersFromText(text, guild, botId) {
    if (!guild || !text) return [];

    const foundMembers = new Map();
    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !COMMON_IGNORE_WORDS.has(w));

    if (words.length === 0) return [];

    guild.members.cache.forEach(member => {
        if (member.id === botId) return;

        const candidateNames = [
            member.nickname,
            member.displayName,
            member.user.username,
            member.user.globalName
        ].filter(Boolean);

        for (const rawName of candidateNames) {
            const cleaned = cleanName(rawName);
            if (cleaned.length < 3 || COMMON_IGNORE_WORDS.has(cleaned)) continue;

            const nameTokens = cleaned.split(' ');

            // Check if any query word matches a token or starts with it
            const isMatch = words.some(word => 
                nameTokens.some(token => token === word || (token.startsWith(word) && word.length >= 4))
            );

            if (isMatch) {
                foundMembers.set(member.id, {
                    id: member.id,
                    username: member.displayName || member.user.username,
                    matchedName: rawName
                });
                break;
            }
        }
    });

    return Array.from(foundMembers.values());
}

client.once(Events.ClientReady, async (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, Banter, Smart Data & Hall of Fame.`);
    console.log('----------------------------------------');
    client.user.setActivity('over the !NF!N!TY family 💅', { type: 3 });

    // Pre-cache guild members for instant name resolution
    for (const guild of readyClient.guilds.cache.values()) {
        try {
            await guild.members.fetch();
            console.log(`👥 Cached ${guild.members.cache.size} members for guild: ${guild.name}`);
        } catch (err) {
            console.warn(`⚠️ Could not pre-fetch members for guild ${guild.name}:`, err.message);
        }
    }

    try {
        const startupChannelId = '1524748262765101176';
        const channel = await client.channels.fetch(startupChannelId);
        if (channel) {
            await channel.send('✨ I am alive and back online! 🌸');
            console.log(`✅ Startup message sent to channel ${startupChannelId}`);
        }
    } catch (err) {
        console.error('⚠️ Could not send startup message:', err.message);
    }
});

setInterval(async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    try {
        const { error } = await ramClient.from('chat_ram').delete().lt('created_at', fiveHoursAgo);
        if (!error) console.log('🧹 5-Hour Memory Wiped.');
    } catch (err) { console.error('❌ Cleanup Error:', err); }
}, 3600000);

// 🚀 SUPABASE KEEP-ALIVE HEARTBEAT
setInterval(async () => {
    try {
        await ramClient.from('chat_ram').select('id').limit(1);
        console.log('💓 Database connection heartbeat sent.');
    } catch (err) {
        console.error('⚠️ Heartbeat failed, connection might be sleeping:', err.message);
    }
}, 300000); 

client.on('guildMemberRemove', async (member) => {
    try {
        const { error } = await ramClient
            .from('conversation_turns')
            .delete()
            .eq('user_id', member.id);
            
        if (error) {
            console.error("Error wiping user data on leave:", error);
        } else {
            console.log(`Successfully wiped data for user: ${member.user.username}`);
        }
    } catch (err) {
        console.error("Fatal error during member cleanup:", err);
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 5000);

    try {
        await ramClient.from('chat_ram').insert([{
            player_id: message.author.id,
            player_name: message.author.username,
            channel_id: message.channel.id,
            message_content: message.content
        }]);
    } catch (err) {
        console.error('⚠️ Failed to save to chat_ram:', err.message);
    }

    const lowerText = message.content.toLowerCase();
    const isExplicitlyTagged = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

    if (lowerText.includes('fetch chats from supabase') || lowerText.includes('present all chats')) {
        if (message.author.id !== '1369404203880939650') {
            return message.reply("❌ **Access Denied:** You do not have clearance to view server logs.").catch(() => {});
        }
        try {
            await message.channel.send("🔄 Accessing the secure Supabase Memory RAM for you right now, my King... please wait. 🌸");
            const { data, error } = await ramClient
                .from('chat_ram')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            if (!data || data.length === 0) return message.channel.send("I checked my memory banks, but the RAM is currently empty!");

            let logMessage = "**📜 Here are my most recent memory records:**\n\n";
            data.forEach(row => {
                logMessage += `> **${row.player_name || 'Unknown'}:** ${row.message_content || '[No Content]'}\n`;
            });
            return message.channel.send(logMessage);
        } catch (err) {
            console.error('[SUPABASE ERROR]', err);
            return message.channel.send("⚠️ I encountered a critical error while trying to connect to my memory banks.").catch(() => {});
        }
    }

    // 🚀 UNIFIED CONTEXT PRE-FETCHING
    let sharedHistory = [];
    let recentContext = '';
    let chatContextForAI = '';
    
    try {
        const { data } = await ramClient.from('chat_ram')
            .select('player_name, message_content') 
            .eq('channel_id', message.channel.id)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (data) {
            sharedHistory = data;
            recentContext = data.slice(0, 3).map(r => r.message_content).join(' ');
            chatContextForAI = data.slice().reverse().map(r => `[${r.player_name || 'User'}]: ${r.message_content}`).join('\n');
        }
    } catch (err) {
        console.warn('⚠️ Unified history fetch failed:', err.message);
    }

    if (isExplicitlyTagged) {
        const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        const lowerClean = cleanText.toLowerCase();

        if (cleanText.length === 0) {
            return message.reply("Yes, my Beyonder? 🌸").catch(() => {});
        }

        const isModCommand = lowerClean.includes('assign') || lowerClean.includes('give') || lowerClean.includes('remove') || lowerClean.includes('take') || lowerClean.includes('kick') || lowerClean.includes('ban');
        const targetMember = message.mentions.members.filter(m => m.id !== client.user.id).first();

        if (isModCommand && targetMember) {
            const isSakha = message.author.id === '1369404203880939650';
            const isAdmin = message.member.roles.cache.has('1372987132855058504');

            if (!isSakha && !isAdmin) {
                return message.reply("❌ **Access Denied:** You must be my King or a Clan Admin to command me to modify users.").catch(() => {});
            }

            if (adminCooldown.has(message.author.id)) {
                return message.reply("⏳ Please wait a few seconds before issuing another server command.").catch(() => {});
            }
            adminCooldown.add(message.author.id);
            setTimeout(() => adminCooldown.delete(message.author.id), 5000);

            if (lowerClean.includes('kick')) {
                try {
                    await targetMember.kick("Requested by Admin/Creator via INF AI");
                    return message.reply(`👢 Consider it done! I have kicked ${targetMember.user.username} from the server.`);
                } catch (err) { return message.reply("❌ I don't have permission to kick this user.").catch(() => {}); }
            }

            if (lowerClean.includes('ban')) {
                try {
                    await targetMember.ban({ reason: "Requested by Admin/Creator via INF AI" });
                    return message.reply(`🔨 Handled. ${targetMember.user.username} has been permanently banned.`);
                } catch (err) { return message.reply("❌ I don't have permission to ban this user.").catch(() => {}); }
            }

            const roleBundles = {
                'boss': ['1413760143337721936'],
                'clan': ['1439158157640339557', '1373179239049859082'],
                'main clan': ['1439158157640339557', '1373179239049859082']
            };

            let rolesToModify = [];
            if (message.mentions.roles.size > 0) {
                message.mentions.roles.forEach(role => rolesToModify.push(role.id));
            }

            for (const [bundleName, bundleIds] of Object.entries(roleBundles)) {
                if (lowerClean.includes(bundleName)) {
                    rolesToModify = rolesToModify.concat(bundleIds);
                }
            }

            if (rolesToModify.length > 0) {
                try {
                    if (lowerClean.includes('remove') || lowerClean.includes('take')) {
                        await targetMember.roles.remove(rolesToModify);
                        return message.reply(`✅ As you wish. I have stripped the requested role(s) from ${targetMember.user.username}.`);
                    } else {
                        await targetMember.roles.add(rolesToModify);
                        return message.reply(`✅ Perfectly executed! I have granted the requested role(s) to ${targetMember.user.username}. 🌸`);
                    }
                } catch (err) {
                    return message.reply("❌ **Role Error:** I cannot assign this. Please ensure my 'INF AI' role is placed HIGHER in your server settings.").catch(() => {});
                }
            } else {
                return message.reply("⚠️ I couldn't figure out which role you want me to give. Try mentioning the role directly.").catch(() => {});
            }
        }

        if (lowerClean.startsWith('say ') && message.author.id === '1369404203880939650') {
            const speechText = cleanText.substring(4).trim();
            if (speechText.length > 0) {
                try {
                    await message.channel.send(speechText);
                    await ramClient.from('chat_ram').insert([{
                        player_id: client.user.id,
                        player_name: "INF AI",
                        channel_id: message.channel.id,
                        message_content: speechText
                    }]);
                } catch (err) { console.error('⚠️ Proxy speech failed:', err.message); }
                return;
            }
        }

        const announceTriggers = ['mention everyone', 'tag everyone', 'announce', 'leave message', 'send message to everyone', 'ping everyone'];
        const wantsAnnouncement = announceTriggers.some(t => lowerClean.includes(t));

        if (wantsAnnouncement) {
            const isCreator = message.author.id === '1369404203880939650';
            const isAdmin = message.member?.roles.cache.has('1372987132855058504');

            if (!isCreator && !isAdmin) {
                return message.reply("❌ Only my Creator or a Clan Admin can ask me to send announcements.").catch(() => {});
            }

            let announceText = cleanText;
            for (const trigger of announceTriggers) {
                announceText = announceText.replace(new RegExp(trigger, 'i'), '').trim();
            }
            if (announceText.length === 0) {
                announceText = 'Please check the announcement above! 🌸';
            }

            const targetsEveryone = message.mentions.everyone || lowerClean.includes('everyone');
            const targetedUser = message.mentions.users.filter(u => u.id !== client.user.id).first();

            try {
                if (targetsEveryone) {
                    await message.channel.send({ content: `@everyone ${announceText}`, allowedMentions: { parse: ['everyone'] } });
                } else if (targetedUser) {
                    await message.channel.send({ content: `<@${targetedUser.id}> ${announceText}`, allowedMentions: { users: [targetedUser.id] } });
                } else {
                    return message.reply("⚠️ Tell me who to mention — @everyone or tag a specific person.");
                }
                return;
            } catch (err) {
                console.error('[ANNOUNCEMENT ERROR]', err);
                return message.reply("❌ I couldn't send that — check my permissions in this channel.").catch(() => {});
            }
        }

        try {
            await message.channel.sendTyping();

            // 1. Gather users directly tagged via @
            const directMentions = message.mentions.users
                .filter(u => u.id !== client.user.id)
                .map(u => ({ id: u.id, username: u.username }));

            // 2. Gather users mentioned in plain text (e.g., "Srikar, Anwar, Ashkash")
            const textResolvedUsers = resolveMembersFromText(cleanText, message.guild, client.user.id);

            // 3. Deduplicate combined mentions
            const mentionMap = new Map();
            directMentions.forEach(u => mentionMap.set(u.id, u));
            textResolvedUsers.forEach(u => mentionMap.set(u.id, u));
            const mentionedUsers = Array.from(mentionMap.values());

            let gameResult = { resolved: false, context: null, intent: 'UNKNOWN' };
            try {
                gameResult = gameDomainRouter.route(cleanText, recentContext);
                console.log(`[GAME ROUTER] input="${cleanText}" intent=${gameResult.intent} resolved=${gameResult.resolved}`);
            } catch (err) {
                console.error('❌ [GAME ROUTER ERROR]', err);
            }

            if (gameResult.resolved === true) {
                console.log(`[GAME ROUTER] Deterministic answer — Gemini bypassed`);
                
                const replyPayload = { allowedMentions: { repliedUser: false } };
                if (gameResult.reply) replyPayload.content = gameResult.reply;
                if (gameResult.embeds) replyPayload.embeds = gameResult.embeds;

                try {
                    const memLog = gameResult.reply ? gameResult.reply : `[Sent Embedded Card(s)]`;
                    await ramClient.from('chat_ram').insert([{
                        player_id: client.user.id,
                        player_name: "INF AI",
                        channel_id: message.channel.id,
                        message_content: memLog
                    }]);
                } catch (dbErr) {
                    console.warn('⚠️ Failed to log JS reply to Supabase:', dbErr.message);
                }

                return await message.reply(replyPayload);
            }

            const gameKeywords = ['stats', 'hero', 'troop', 'boss', 'use', 'good', 'bad', 'vs', 'guide', 'best', 'counter', 'synergy'];
            const hasGameKeyword = gameKeywords.some(kw => lowerClean.includes(kw));

            const hasRealGameSignal = Boolean(
                gameResult.context ||
                (gameResult.queryFlags && (
                    gameResult.queryFlags.isBossQuery ||
                    gameResult.queryFlags.isSynergyQuery ||
                    gameResult.queryFlags.isComparisonQuery ||
                    gameResult.queryFlags.needsGear ||
                    (gameResult.queryFlags.isSingleEntity && (gameResult.intent !== 'UNKNOWN' || hasGameKeyword))
                ))
            );

            const roles = message.member ? message.member.roles.cache.map(r => r.name.toLowerCase()) : [];
            let aiReply, modelUsed, debug, pipelineUsed;

            if (hasRealGameSignal) {
                pipelineUsed = 'aiFallback (gameStrategyEngine)';
                
                aiReply = await requestQueue.enqueue(() => askGameAI({
                    userMessage: cleanText,
                    intent: gameResult.intent,
                    context: gameResult.context,
                    geminiKeys: melody.geminiKeys,
                    groqKeys: melody.groqKeys,
                    queryFlags: gameResult.queryFlags,
                    deterministic: gameResult.deterministic,
                }));
                
                modelUsed = 'aiFallback';
                debug = { intent: gameResult.intent, tier: 'game-strategy' };
            } else {
                pipelineUsed = 'melody (api/gemini.js persona)';
                let knowledgeContext = knowledgeRetrieval.retrieve(cleanText, { rawGoldData, rawGemData });

                let aiPromptContent = cleanText;
                