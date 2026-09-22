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

const decisionPipeline = require('./decision/decisionPipeline');
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
        GatewayIntentBits.GuildMembers
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
    'notify', 'events', 'event', 'other', 'guys', 'karo', 'both', 'also',
    'send', 'regarding', 'advisor', 'management', 'request', 'known'
]);

function cleanName(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[!|\[\(].*?[\]\)]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
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

    if (reflectionJob && typeof reflectionJob.start === 'function') {
        reflectionJob.start();
        console.log('🔄 Reflection Job started for background summarization.');
    }
});

setInterval(async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    try {
        const { error } = await ramClient.from('chat_ram').delete().lt('created_at', fiveHoursAgo);
        if (!error) console.log('🧹 5-Hour Memory Wiped.');
    } catch (err) { console.error('❌ Cleanup Error:', err); }
}, 3600000);

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

    let sharedHistory = [];
    let recentContext = '';
    let chatContextForAI = '';
    
    try {
        const { data } = await ramClient.from('chat_ram')
            .select('player_name, message_content') 
            .eq('channel_id', message.channel.id)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (data && data.length > 0) {
            sharedHistory = data;
            recentContext = data.slice(0, 3).map(r => r.message_content).join(' ');
            chatContextForAI = data.slice().reverse().map(r => `[${r.player_name || 'User'}]: ${r.message_content}`).join('\n');
        }
    } catch (err) {
        console.warn('⚠️ Unified history fetch failed:', err.message);
    }

    if (isExplicitlyTagged) {
        const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        
        if (cleanText.length === 0) {
            return message.reply("Yes, my Beyonder? 🌸").catch(() => {});
        }

        const isModCommand = cleanText.toLowerCase().includes('assign') || cleanText.toLowerCase().includes('give') || cleanText.toLowerCase().includes('remove') || cleanText.toLowerCase().includes('take') || cleanText.toLowerCase().includes('kick') || cleanText.toLowerCase().includes('ban');
        const targetMember = message.mentions.members.filter(m => m.id !== client.user.id).first();

        if (isModCommand && targetMember) {
            const lowerClean = cleanText.toLowerCase();
            const isSakha = message.author.id === '1369404203880939650';
            const isAdmin = message.member?.roles.cache.has('1372987132855058504');

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

        if (cleanText.toLowerCase().startsWith('say ') && message.author.id === '1369404203880939650') {
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

        // ─────────────────────────────────────────────────────────────
        // 🚀 DM, ANNOUNCEMENT & CROSS-CHANNEL ROUTING
        // ─────────────────────────────────────────────────────────────
        const flattenedCleanText = cleanText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        const lowerCleanFlat = flattenedCleanText.toLowerCase();

        const directMentions = message.mentions.users
            .filter(u => u.id !== client.user.id)
            .map(u => ({ id: u.id, username: u.username }));

        const mentionMap = new Map();
        directMentions.forEach(u => mentionMap.set(u.id, u));

        const textResolvedUsers = resolveMembersFromText(flattenedCleanText, message.guild, client.user.id);
        textResolvedUsers.forEach(u => mentionMap.set(u.id, u));

        let targetUsers = Array.from(mentionMap.values());

        // 🚀 UPGRADE: Expanded trigger words to support ask/tell cross-channel logic
        const announceRegex = /\b(announce|notify|alert|ping everyone|sabko bol|bol do|boldo|message kardo|msg kardo|in dm|send dm to|dm to|send dm|message bhejo|send apology|tell them|dm me bolo|dm me|dm kardo|dm them|dm|ask|tell|say to)\b/i;
        const wantsAnnouncement = announceRegex.test(lowerCleanFlat);

        if (wantsAnnouncement) {
            const isCreator = message.author.id === '1369404203880939650';
            const isAdmin = message.member?.roles.cache.has('1372987132855058504');

            if (!isCreator && !isAdmin) {
                return message.reply("❌ Only my Creator or a Clan Admin can ask me to route messages.").catch(() => {});
            }

            // 🚀 TARGET CHANNEL RESOLUTION: Determine where the message should go
            const targetChannel = message.mentions.channels.first() || message.channel;

            let rawMessagePayload = flattenedCleanText;
            const triggersToStrip = [
                'announce', 'notify everyone', 'notify', 'alert', 'ping everyone',
                'sabko bol', 'bol do', 'boldo', 'message kardo', 'msg kardo',
                'in dm', 'send dm to', 'dm to', 'send dm', 'message bhejo',
                'send apology msg', 'send apology', 'tell them', 'dm me bolo',
                'dm me', 'dm kardo', 'dm them', 'dm', 'ask', 'tell', 'say to', 'in'
            ];

            for (const trigger of triggersToStrip) {
                rawMessagePayload = rawMessagePayload.replace(new RegExp(`\\b${trigger}\\b`, 'gi'), '');
            }
            
            // Remove channel mentions from the payload so they aren't echoed
            rawMessagePayload = rawMessagePayload.replace(/<#\d+>/g, '');
            // Remove user mentions from the payload so we can format them neatly later
            rawMessagePayload = rawMessagePayload.replace(/<@!?\d+>/g, '');

            targetUsers.forEach(u => {
                const nameRegex = new RegExp(`\\b${u.username}\\b`, 'gi');
                rawMessagePayload = rawMessagePayload.replace(nameRegex, '');
                if (u.matchedName) {
                    const matchedRegex = new RegExp(`\\b${u.matchedName.split(' ')[0]}\\b`, 'gi');
                    rawMessagePayload = rawMessagePayload.replace(matchedRegex, '');
                }
            });

            let previousText;
            do {
                previousText = rawMessagePayload;
                rawMessagePayload = rawMessagePayload.replace(/^[\s]*(and|ki|ko|ke|me|to|also|bolo|bol|say|tell|that|usko|because|a request regarding)[\s]+/gi, '');
            } while (rawMessagePayload !== previousText);

            rawMessagePayload = rawMessagePayload.replace(/\b(and|ko|me|to|also|because)\s*$/gi, '').trim();

            if (rawMessagePayload.length === 0) {
                rawMessagePayload = 'Please check with your Clan Admin for updates! ⚔️🌸';
            }

            // ─────────────────────────────────────────────────────────────
            // 🚀 AI DRAFTING MODE: Smart Message Generation
            // ─────────────────────────────────────────────────────────────
            try {
                await message.channel.sendTyping();
                
                const aiPrompt = `[SYSTEM INSTRUCTION: You are acting strictly as an official Discord Server Dispatcher drafting an announcement or routing a message on behalf of the Admin.
CRITICAL RULES:
1. STRICTLY FORBIDDEN: DO NOT mention love, dating, romance, boyfriends, hearts, or personal relationships under ANY circumstances.
2. NO PERSONA BLEED: Never add phrases like "my heart belongs to..." or "Beyonder is my boyfriend". Keep it 100% focused only on the admin's requested message.
3. ADAPTIVE TONE:
   - If greeting/casual: Friendly, warm, engaging.
   - If moderation/warning/troll/ask: Translate the exact intent into natural language (e.g. Hindi/Hinglish if the prompt implies it). Keep it sharp.
4. OUTPUT FORMAT: ONLY output the exact final message to be posted. DO NOT output conversational filler like "Sure, here is the message" or "Okay, I will ask".]

Raw Instruction from Admin: "${rawMessagePayload}"`;

                const melodyResult = await requestQueue.enqueue(() => melody.generateContent({
                    userId: message.author.id,
                    displayName: message.author.username,
                    roles: message.member?.roles.cache.map(r => r.name.toLowerCase()) || [],
                    channelId: message.channel.id,
                    content: aiPrompt,
                    isGroupContext: Boolean(message.guild),
                    mentionedUsers: targetUsers, 
                    knowledgeContext: "",
                    recentChatLog: recentContext
                }));

                if (melodyResult && melodyResult.text) {
                    rawMessagePayload = melodyResult.text.trim();
                }
            } catch (err) {
                console.error('❌ [AI DRAFTING ERROR]', err.message);
            }
            // ─────────────────────────────────────────────────────────────

            const targetsEveryone = message.mentions.everyone || lowerCleanFlat.includes('everyone') || lowerCleanFlat.includes('sabko');
            const wantsDM = /\b(dm|message|msg)\b/i.test(lowerCleanFlat);

            try {
                let dmTargets = [];
                if (wantsDM) {
                    if (targetsEveryone) {
                        const members = await message.guild.members.fetch();
                        dmTargets = members
                            .filter(m => !m.user.bot && m.id !== client.user.id)
                            .map(m => ({ id: m.id, username: m.user.username }));
                    } else if (targetUsers.length > 0) {
                        dmTargets = targetUsers;
                    }
                }

                // --- DM ROUTING ---
                if (wantsDM) {
                    if (dmTargets.length === 0) {
                        return message.reply("⚠️ Could not locate that user in the server to send a DM. Please mention them directly using `@`.").catch(() => {});
                    }

                    const confirmId = `confirm_dm_${Date.now()}`;
                    const cancelId = `cancel_dm_${Date.now()}`;

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(confirmId).setLabel('Yes, Send it!').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(cancelId).setLabel('No, Cancel').setStyle(ButtonStyle.Danger)
                    );

                    const previewMsg = await message.reply({
                        content: `📝 **Draft Preview for ${dmTargets.length} members:**\n\n> ${rawMessagePayload.replace(/\n/g, '\n> ')}\n\n**Shall I begin the broadcast?**`,
                        components: [row]
                    });

                    const filter = i => (i.customId === confirmId || i.customId === cancelId) && i.user.id === message.author.id;

                    try {
                        const confirmation = await previewMsg.awaitMessageComponent({ filter, time: 60000 });

                        if (confirmation.customId === cancelId) {
                            await confirmation.update({ content: '🛑 DM broadcast cancelled by Admin.', components: [] });
                            return;
                        }

                        await confirmation.update({ content: `⏳ Initiating DM broadcast to **${dmTargets.length}** members. Applying a strict 5-second delay between each message to protect the server connection... 💅`, components: [] });

                        let dmSuccessCount = 0;

                        for (let i = 0; i < dmTargets.length; i++) {
                            const target = dmTargets[i];
                            try {
                                const discordUser = await client.users.fetch(target.id);
                                await discordUser.send(`🔔 **Clan Alert from ${message.author.username}:**\n\n${rawMessagePayload}`);
                                dmSuccessCount++;

                                if (i < dmTargets.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                }
                            } catch (err) {
                                console.warn(`Could not deliver DM to ${target.username}: DMs are likely locked.`);
                            }
                        }

                        if (dmSuccessCount > 0) {
                            await message.channel.send(`✅ DM broadcast complete! Successfully delivered to ${dmSuccessCount} members. 💌`);
                        } else {
                            await message.channel.send(`⚠️ Broadcast complete, but unable to deliver any DMs. Recipients likely have their DMs closed.`);
                        }
                    } catch (timeoutErr) {
                        await previewMsg.edit({ content: '⏳ DM confirmation timed out. Broadcast aborted.', components: [] });
                    }
                    
                    return; // 🛑 Stops AI execution
                }

                // --- CROSS-CHANNEL & GENERAL ANNOUNCEMENT ROUTING ---
                if (targetsEveryone) {
                    await targetChannel.send({ content: `@everyone ${rawMessagePayload}`, allowedMentions: { parse: ['everyone'] } });
                    if (targetChannel.id !== message.channel.id) {
                         await message.reply(`✅ Announced to everyone in <#${targetChannel.id}>.`);
                    }
                } else if (targetUsers.length > 0) {
                    const pings = targetUsers.map(u => `<@${u.id}>`).join(' ');
                    await targetChannel.send({ content: `${pings} ${rawMessagePayload}`, allowedMentions: { parse: ['users'] } });
                    if (targetChannel.id !== message.channel.id) {
                         await message.reply(`✅ Message routed to <#${targetChannel.id}>.`);
                    }
                } else {
                    await targetChannel.send(rawMessagePayload);
                    if (targetChannel.id !== message.channel.id) {
                         await message.reply(`✅ Sent your message to <#${targetChannel.id}>!`);
                    }
                }

                return; // 🛑 Stops AI execution
            } catch (err) {
                console.error('[ANNOUNCEMENT/ROUTING ERROR]', err);
                return message.reply("❌ Error sending message. Please check bot permissions or channel accessibility.").catch(() => {});
            }
        }

        // ─────────────────────────────────────────────────────────────
        // 🚀 4. GENERAL STRATEGY & DECISION PIPELINE (AI REPLIES + STRICT GAME FILTER)
        // ─────────────────────────────────────────────────────────────
        try {
            await message.channel.sendTyping();

            let gameResult = { resolved: false, context: null, intent: 'UNKNOWN' };
            
            // 🚀 UPGRADE: Strict Keyword Guard to prevent false game triggers on casual text
            const strictGameKeywords = [
                'hero', 'heroes', 'troop', 'troops', 'boss', 'stats', 'stat', 
                'buff', 'nerf', 'gear', 'formation', 'counter', 'synergy', 
                'clash', 'kingdom clash', 'pvp', 'arena', 'tier list'
            ];
            
            const hasStrictGameIntent = strictGameKeywords.some(keyword => 
                new RegExp(`\\b${keyword}\\b`, 'i').test(cleanText)
            );

            try {
                // Only route to game domain if strict keywords are found
                if (hasStrictGameIntent) {
                    gameResult = gameDomainRouter.route(cleanText, recentContext);
                    console.log(`[GAME ROUTER] input="${cleanText}" intent=${gameResult.intent} resolved=${gameResult.resolved}`);
                } else {
                    console.log(`[GAME ROUTER SKIPPED] Non-game casual input detected.`);
                }
            } catch (err) {
                console.error('❌ [GAME ROUTER ERROR]', err);
            }

            if (gameResult.resolved === true) {
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
            const hasGameKeyword = gameKeywords.some(kw => lowerCleanFlat.includes(kw));

            const hasRealGameSignal = Boolean(
                hasStrictGameIntent && (
                    gameResult.context ||
                    (gameResult.queryFlags && (
                        gameResult.queryFlags.isBossQuery ||
                        gameResult.queryFlags.isSynergyQuery ||
                        gameResult.queryFlags.isComparisonQuery ||
                        gameResult.queryFlags.needsGear ||
                        (gameResult.queryFlags.isSingleEntity && (gameResult.intent !== 'UNKNOWN' || hasGameKeyword))
                    ))
                )
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
                pipelineUsed = 'decisionPipeline';
                let knowledgeContext = knowledgeRetrieval.retrieve(cleanText, { rawGoldData, rawGemData });

                const currentDay = new Date().toLocaleString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
                let activeEvent = 'None';
                if (['Mon', 'Tue', 'Wed'].includes(currentDay)) activeEvent = '🛡️ Glorious Boss Hunt (Players must use 3 daily attacks)';
                else if (currentDay === 'Thu') activeEvent = '⚙️ Clan Clash Prep Day (Players must save their formations)';
                else if (['Fri', 'Sat', 'Sun'].includes(currentDay)) activeEvent = '⚔️ Clan Clash PvP (Players must fight 3 battles today)';

                let aiPromptContent = `[SYSTEM EVENT STATUS: Today is ${currentDay} in India. The current active clan event is: ${activeEvent}. If the user asks what to do today, refer to this event.]\n\n${cleanText}`;

                if (gameResult.context) {
                    const compressedContext = typeof gameResult.context === 'object'
                        ? compressGameData(gameResult.context)
                        : gameResult.context;
                    const contextStr = typeof compressedContext === 'object'
                        ? JSON.stringify(compressedContext)
                        : compressedContext;

                    aiPromptContent = `[SYSTEM INSTRUCTION: You MUST use the following exact game data to answer the user's question. Compare the stats directly and provide strategic advice based ONLY on these numbers. Do not invent abilities or stats.]\n\n[GAME DATA]:\n${contextStr}\n\n[USER QUESTION]: ${aiPromptContent}`;
                }

                console.log(`[PIPELINE TRACE] route=decisionPipeline | hasGameContext=${Boolean(gameResult.context)} | liveEvent=${activeEvent}`);

                const directMentions = message.mentions.users
                    .filter(u => u.id !== client.user.id)
                    .map(u => ({ id: u.id, username: u.username }));
                const textResolvedUsers = resolveMembersFromText(cleanText, message.guild, client.user.id);
                const mentionMap = new Map();
                directMentions.forEach(u => mentionMap.set(u.id, u));
                textResolvedUsers.forEach(u => mentionMap.set(u.id, u));
                const allMentioned = Array.from(mentionMap.values());

                const turnData = await decisionPipeline.planTurn({
                    userId: message.author.id,
                    displayName: message.author.username,
                    roles: roles,
                    channelId: message.channel.id,
                    content: aiPromptContent,
                    isGroupContext: Boolean(message.guild),
                    mentions: {
                        everyone: message.mentions.everyone,
                        users: allMentioned
                    },
                    gameData: gameResult.context,
                    recentChatLog: chatContextForAI
                });

                const melodyResult = await requestQueue.enqueue(() => melody.generateContent({
                    userId: message.author.id,
                    displayName: message.author.username,
                    roles,
                    channelId: message.channel.id,
                    content: turnData.prompt,
                    isGroupContext: Boolean(message.guild),
                    mentionedUsers: allMentioned, 
                    knowledgeContext,
                    recentChatLog: chatContextForAI
                }));
                
                aiReply = melodyResult.text;
                modelUsed = melodyResult.modelUsed;
                debug = melodyResult.debug;

                await decisionPipeline.finalizeTurn({
                    channelId: message.channel.id,
                    userId: message.author.id,
                    content: cleanText,
                    responseText: aiReply
                });
            }

            console.log(`🧠 [PIPELINE TRACE] pipeline="${pipelineUsed}" intent=${debug?.intent} tier=${debug?.tier} model=${modelUsed}`);

            let finalReply = aiReply;

            const directMentions = message.mentions.users
                .filter(u => u.id !== client.user.id)
                .map(u => ({ id: u.id, username: u.username }));
            const textResolvedUsers = resolveMembersFromText(cleanText, message.guild, client.user.id);
            const mentionMap = new Map();
            directMentions.forEach(u => mentionMap.set(u.id, u));
            textResolvedUsers.forEach(u => mentionMap.set(u.id, u));
            const allMentioned = Array.from(mentionMap.values());

            if (allMentioned.length > 0) {
                allMentioned.forEach(u => {
                    const cleanUName = u.username.replace(/[^a-zA-Z0-9]/g, '');
                    const malformedRegex = new RegExp(`<@!?${cleanUName}>`, 'gi');
                    finalReply = finalReply.replace(malformedRegex, `<@${u.id}>`);
                    
                    if (u.matchedName) {
                        const firstWord = u.matchedName.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
                        if (firstWord.length >= 3) {
                            const wordRegex = new RegExp(`<@!?${firstWord}>`, 'gi');
                            finalReply = finalReply.replace(wordRegex, `<@${u.id}>`);
                        }
                    }
                });
            }

            const isCreator = message.author.id === '1369404203880939650';
            const isAdmin = message.member?.roles.cache.has('1372987132855058504');
            const allowedToPingEveryone = message.mentions.everyone && (isCreator || isAdmin);

            if (allowedToPingEveryone && !finalReply.includes('@everyone')) {
                finalReply = `@everyone\n\n${finalReply}`;
            }

            const allowedParse = ['users'];
            if (allowedToPingEveryone) allowedParse.push('everyone');

            const mentionOptions = {
                repliedUser: false,
                parse: allowedParse
            };

            const replyPayload = { 
                content: finalReply, 
                allowedMentions: mentionOptions 
            };
            
            if (gameResult.embeds && gameResult.embeds.length > 0) {
                replyPayload.embeds = gameResult.embeds;
            }
                    
            if (finalReply.length > 1950) {
                const chunks = finalReply.match(/(.|[\r\n]){1,1950}(?=\s|$)/g) || [];
                for (let i = 0; i < chunks.length; i++) {
                    if (i === 0) {
                        await message.reply({ ...replyPayload, content: chunks[i] });
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 600)); 
                        await message.channel.send({ content: chunks[i], allowedMentions: { parse: mentionOptions.parse } });
                    }
                }
            } else {
                await message.reply(replyPayload);
            }

            try {
                await ramClient.from('chat_ram').insert([{
                    player_id: client.user.id,
                    player_name: "INF AI",
                    channel_id: message.channel.id,
                    message_content: finalReply
                }]);
            } catch (dbErr) {
                console.warn('⚠️ Failed to log AI reply to Supabase:', dbErr.message);
            }

        } catch (error) {
            console.error('❌ AI Error:', error.message);
            try { 
                await message.reply('My cognitive processors are cooling down, I am very busy right now! 🌸'); 
            } catch (e) {}
        }
    } 

    if (!supportCooldown.has(message.channel.id) && sharedHistory.length >= 2) {
        const triggers = ['boss', 'tough', 'hard', 'score', 'stuck', 'impossible'];
        const isDifficultyConvo = sharedHistory.slice(0, 2).every(m => 
            triggers.some(t => m.message_content.toLowerCase().includes(t))
        );

        if (isDifficultyConvo) {
            supportCooldown.add(message.channel.id);
            setTimeout(() => supportCooldown.delete(message.channel.id), 120000);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_yes_help').setLabel('Yes, Please!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_no_thanks').setLabel('No, I got this').setStyle(ButtonStyle.Secondary)
            );
            
            await message.channel.send({
                content: `💅 I noticed you boys are struggling. Do you need me to ping the Advisors for a strategy breakdown?`,
                components: [row]
            }).catch(()=>{});
        }
    }

    if (!goldCooldown.has(message.channel.id) && sharedHistory.length > 0) {
        const goldTriggers = ['gold', 'need gold', 'farm gold', 'how to farm', 'broke', 'no gold', 'out of gold'];
        let goldMentionCount = 0;
        
        sharedHistory.forEach(m => {
            if (goldTriggers.some(t => m.message_content.toLowerCase().includes(t))) goldMentionCount++;
        });

        if (goldMentionCount >= 2) {
            goldCooldown.add(message.channel.id);
            setTimeout(() => goldCooldown.delete(message.channel.id), 300000);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_yes_gold').setLabel('Yes, show me!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_no_gold').setLabel('No, I am rich.').setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({
                content: `💅 I noticed you guys are discussing gold farming. Do you want me to pull up the Ultimate Gold Blueprint?`,
                components: [row]
            }).catch(()=>{});
        }
    }

    if (!gemCooldown.has(message.channel.id) && sharedHistory.length > 0) {
        const gemTriggers = ['gem', 'need gems', 'low on gems', 'out of gems', 'how to farm gems', 'gem farming'];
        let gemMentionCount = 0;
        
        sharedHistory.forEach(m => {
            if (gemTriggers.some(t => m.message_content.toLowerCase().includes(t))) gemMentionCount++;
        });

        if (gemMentionCount >= 2) {
            gemCooldown.add(message.channel.id);
            setTimeout(() => gemCooldown.delete(message.channel.id), 300000);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_yes_gem').setLabel('Yes, show me!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_no_gem').setLabel('No, I have plenty.').setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({
                content: `💎 I noticed you guys are discussing gems. Do you want me to pull up the Gem Matrix?`,
                components: [row]
            }).catch(()=>{});
        }
    }
}); 

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    try {
        if (interaction.customId === 'btn_yes_help') {
            await interaction.message.edit({ components: [] });
            await interaction.reply({
                content: `🔔 **Tactical Support Initiated!** \n<@&1524079498646126662>, the team needs your breakdown! \n\n*Analysis complete. Protocols engaged.*`
            });
        } else if (interaction.customId === 'btn_no_thanks') {
            await interaction.message.edit({ components: [] });
            await interaction.reply({ content: `Fine, tough guys! Don't come crying to me when you lose. 💅` });
        }

        else if (interaction.customId === 'btn_yes_gold') {
            await interaction.message.edit({ components: [] });
            const goldEmbed = getGoldGuide();
            await interaction.reply({ 
                content: `✨ Here is the Ultimate Gold Blueprint, ${interaction.user}:`, 
                embeds: [goldEmbed] 
            });
        } else if (interaction.customId === 'btn_no_gold') {
            await interaction.message.edit({ components: [] });
            await interaction.reply({ content: `No worries, King! Let me know if you ever need the Blueprint. 💰` });
        }

        else if (interaction.customId === 'btn_yes_gem') {
            await interaction.message.edit({ components: [] });
            const gemEmbed = getGemGuide();
            await interaction.reply({ 
                content: `💎 Here is the Gem Matrix for you, ${interaction.user}:`, 
                embeds: [gemEmbed] 
            });
        } else if (interaction.customId === 'btn_no_gem') {
            await interaction.message.edit({ components: [] });
            await interaction.reply({ content: `Alright! I'll keep the Gem Matrix ready for whenever you need it. 💎` });
        }
    } catch (error) {
        console.warn('⚠️ Interaction failed (possibly expired/timeout):', error.message);
    }
});

const TARGET_EMOJI = '✅'; 
const HALL_OF_FAME_CHANNEL_ID = '1527749743483158558'; 
const REQUIRED_REACTIONS = 1; 

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) {
        try { 
            await reaction.fetch(); 
        } catch (error) { 
            console.error('Failed to fetch partial reaction:', error);
            return; 
        }
    }

    if (user.bot) return;

    const isTargetEmoji = reaction.emoji.name === '✅' || reaction.emoji.name === 'white_check_mark';

    if (isTargetEmoji && reaction.count >= REQUIRED_REACTIONS) {
        const message = reaction.message;

        try {
            const hallOfFameChannel = await client.channels.fetch(HALL_OF_FAME_CHANNEL_ID);
            if (!hallOfFameChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#00FF00') 
                .setAuthor({ 
                    name: message.author.username, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(message.content || '✅ *Highlighted Moment*')
                .setFooter({ text: `Archived by ${user.username} | ✅ !NF!N!TY Hall of Fame` })
                .setTimestamp(message.createdAt);

            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment?.contentType?.startsWith('image/')) {
                    embed.setImage(attachment.url);
                }
            }

            await hallOfFameChannel.send({ embeds: [embed] });
            console.log(`[SUCCESS] Message archived by ${user.username}`);
        } catch (error) {
            console.error('Error creating Hall of Fame entry:', error);
        }
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception thrown:', err);
});

client.on('error', (error) => {
    console.error('⚠️ [DISCORD CLIENT ERROR]:', error);
});

client.on('shardError', (error, shardId) => {
    console.error(`⚠️ [DISCORD SHARD ${shardId} ERROR]:`, error);
});

client.on('shardDisconnect', (event, shardId) => {
    console.warn(`⚠️ [DISCORD SHARD ${shardId} DISCONNECTED]: code=${event?.code} reason=${event?.reason}`);
});

client.on('disconnect', () => {
    console.warn('⚠️ [DISCORD DISCONNECTED]: The WebSocket disconnected.');
});

client.on('debug', (info) => {
    if (typeof info === 'string' && info.toLowerCase().includes('token')) return;
    console.log('[DISCORD DEBUG]', info);
});

try {
    console.log("🛠️ [DIAGNOSTICS] Checking Environment Variables...");
    
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.trim() === '') {
        console.error("❌ [CRITICAL ERROR] The DISCORD_TOKEN is missing or completely empty in Render!");
    } else {
        console.log(`✅ [DIAGNOSTICS] Token found! Length: ${process.env.DISCORD_TOKEN.length} characters.`);
    }

    console.log("🛠️ [DIAGNOSTICS] Attempting to connect to Discord WebSocket...");

    (async () => {
        try {
            const https = require('node:https');
            const probeResult = await new Promise((resolve, reject) => {
                const req = https.get('https://discord.com/api/v10/users/@me', {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                    timeout: 10000
                }, (res) => {
                    let body = '';
                    res.on('data', (c) => (body += c));
                    res.on('end', () => resolve({ status: res.statusCode, body }));
                });
                req.on('timeout', () => { req.destroy(); reject(new Error('REST probe timed out after 10s')); });
                req.on('error', reject);
            });
            if (probeResult.status === 200) {
                console.log('✅ [PROBE] REST API reachable AND token is valid (got 200 from /users/@me).');
                console.log('✅ [PROBE] This means the network path to Discord works and the token is good — the problem is specific to the WebSocket gateway connection.');
            } else if (probeResult.status === 401) {
                console.error('❌ [PROBE] REST API reachable but token was REJECTED (401 Unauthorized).');
                console.error('❌ [PROBE] The token in DISCORD_TOKEN is invalid/revoked. Regenerate it in the Developer Portal and update the Render env var.');
            } else {
                console.warn(`⚠️ [PROBE] REST API responded with unexpected status ${probeResult.status}:`, probeResult.body.slice(0, 200));
            }
        } catch (probeErr) {
            console.error('❌ [PROBE] Could not reach Discord REST API at all:', probeErr.message);
            console.error('❌ [PROBE] This points to an outbound network/egress problem on Render, not your code or token.');
        }
    })();

    const loginWatchdog = setTimeout(() => {
        console.error('❌ [CRITICAL ERROR] Still not connected 20s after login() was called.');
        console.error('❌ [LIKELY CAUSE] A privileged intent (e.g. MESSAGE CONTENT) requested in code is not enabled for this bot in the Discord Developer Portal, OR the token is invalid/regenerated.');
        console.error('❌ [ACTION] Go to https://discord.com/developers/applications -> your app -> Bot -> enable "MESSAGE CONTENT INTENT" (and any other intents you request in code), then redeploy.');
    }, 20000);

    client.login(process.env.DISCORD_TOKEN)
        .then(() => {
            console.log("✅ [DIAGNOSTICS] Login Promise resolved successfully! Waiting for ready event...");
        })
        .catch(error => {
            clearTimeout(loginWatchdog);
            console.error('❌ [CRITICAL ERROR] Discord rejected the login request!');
            console.error('❌ [DETAILS]:', error);
        });

    client.once(Events.ClientReady, () => clearTimeout(loginWatchdog));

} catch (syncError) {
    console.error('❌ [CRITICAL ERROR] A synchronous crash occurred during login:', syncError);
}
