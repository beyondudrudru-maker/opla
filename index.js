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

// 1. IMPORT MODULES
const { ramClient } = require('./database/supabaseClient');
const melody = require('./api/gemini');
const knowledgeRetrieval = require('./knowledge/knowledgeRetrieval');
const reflectionJob = require('./reflection/reflectionJob');
const { getGoldGuide, rawGoldData, getGemGuide, rawGemData } = require('./data/gameData');

// 🚀 IMPORT THE GAME ROUTER
const gameDomainRouter = require('./router/gameDomainRouter');

// 🛡️ DEDUPLICATION SET (Global)
const processedMessages = new Set();

// 2. SERVER SETUP
const app = express();
app.get('/', (req, res) => res.send('✨ INF AI Core is awake and monitoring.'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`🌐 Web Server running.`);
});

// 3. DISCORD CLIENT SETUP
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction
    ]
});

// Cooldown trackers for popup engines & admin commands
const supportCooldown = new Set();
const goldCooldown = new Set();
const gemCooldown = new Set();
const adminCooldown = new Set();

// ==========================================
// 4. CLIENT READY & STARTUP MESSAGE
// ==========================================
client.once(Events.ClientReady, async (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, Banter, Smart Data & Hall of Fame.`);
    console.log('----------------------------------------');
    client.user.setActivity('over the !NF!N!TY family 💅', { type: 3 });

    // 🚀 Send "I am alive" message to the specific channel
    try {
        const startupChannelId = '1524748262765101176';
        const channel = await client.channels.fetch(startupChannelId);
        if (channel) {
            await channel.send('✨ I am alive and back online! 🌸');
            console.log(`✅ Startup message sent to channel ${startupChannelId}`);
        }
    } catch (err) {
        console.error('⚠️ Could not send startup message (Check channel ID or permissions):', err.message);
    }
});

// 5. MEMORY CLEANUP (Runs every hour)
setInterval(async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    try {
        const { error } = await ramClient.from('chat_ram').delete().lt('created_at', fiveHoursAgo);
        if (!error) console.log('🧹 5-Hour Memory Wiped.');
    } catch (err) { console.error('❌ Cleanup Error:', err); }
}, 3600000);

// guildMemberRemove event listener
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

// ==========================================
// 6. MESSAGE EVENT LISTENER (Core Engines)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // 🛡️ DEDUPLICATION: Stop double processing immediately
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 5000);

    // 🧠 6.1: MEMORY LOGIC
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

    // 👑 6.1.5: DEVELOPER OVERRIDE (Runs FIRST)
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

    // 🤖 6.2: AI RESPONSE LOGIC (Runs ONLY if explicitly tagged)
    if (isExplicitlyTagged) {
        const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        const lowerClean = cleanText.toLowerCase();

        if (cleanText.length === 0) {
            return message.reply("Yes, my Beyonder? 🌸").catch(() => {});
        }

        // ==========================================
        // 🛡️ 6.2.1a: THE HYBRID INTERCEPTOR (Moderation & Roles)
        // ==========================================
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
                } catch (err) { return message.reply("❌ I don't have permission to kick this user. Check my role hierarchy!").catch(() => {}); }
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
                    return message.reply("❌ **Role Error:** I cannot assign this. Please ensure my 'INF AI' role is placed HIGHER in your server settings than the roles you want me to give out.").catch(() => {});
                }
            } else {
                return message.reply("⚠️ I couldn't figure out which role you want me to give. Try mentioning the role directly or using a bundle word like 'boss' or 'clan'.").catch(() => {});
            }
        }

        // ==========================================
        // 🗣️ 6.2.1b: PROXY SPEECH INTERCEPTOR
        // ==========================================
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

        // ==========================================
        // 📢 6.2.1c: ANNOUNCEMENT INTERCEPTOR
        // ==========================================
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

        // ==========================================
        // 🧠 6.2.2: MELODY CORE (Conversational AI)
        // ==========================================
        try {
            await message.channel.sendTyping();

            const mentionedUsers = message.mentions.users
                .filter(u => u.id !== client.user.id)
                .map(u => ({ id: u.id, username: u.username }));

            // 🧠 PRE-FETCH RECENT CHAT FOR PRONOUN/FOLLOW-UP RESOLUTION
            let recentContext = '';
            try {
                const { data: recentChats } = await ramClient.from('chat_ram')
                    .select('message_content')
                    .eq('channel_id', message.channel.id)
                    .order('created_at', { ascending: false })
                    .limit(3);
                if (recentChats) recentContext = recentChats.map(r => r.message_content).join(' ');
            } catch (err) { }

            // 🚀 THE GATEKEEPER: DETERMINISTIC GAME ROUTING LAYER
            let gameResult = { resolved: false, context: null, intent: 'UNKNOWN' };
            try {
                gameResult = gameDomainRouter.route(cleanText, recentContext);
                console.log(`[GAME ROUTER] input="${cleanText}" intent=${gameResult.intent} resolved=${gameResult.resolved}`);
            } catch (err) {
                console.error('❌ [GAME ROUTER ERROR]', err);
            }

            // IF RESOLVED: Instant deterministic answer. Bypass Gemini completely.
            if (gameResult.resolved === true) {
                console.log(`[GAME ROUTER] Deterministic answer — Gemini bypassed`);
                
                // Construct the payload to support Embeds safely
                const replyPayload = { allowedMentions: { repliedUser: false } };
                if (gameResult.reply) replyPayload.content = gameResult.reply;
                if (gameResult.embeds) replyPayload.embeds = gameResult.embeds;

                // Save to memory so the AI remembers this interaction
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

            // IF UNRESOLVED: Proceed to AI Pipeline
            console.log(`[GAME ROUTER] Falling through to Melody AI`);

            let knowledgeContext = knowledgeRetrieval.retrieve(cleanText, { rawGoldData, rawGemData });

            // 🚀 AGGRESSIVE STRATEGY CONTEXT INJECTION FOR THE AI
            let aiPromptContent = cleanText;
            if (gameResult.context) {
                const contextStr = typeof gameResult.context === 'object' 
                    ? JSON.stringify(gameResult.context, null, 2) 
                    : gameResult.context;

                aiPromptContent = `[SYSTEM INSTRUCTION: You MUST use the following exact game data to answer the user's question. Compare the stats directly and provide strategic advice based ONLY on these numbers. Do not invent abilities or stats.]\n\n[GAME DATA]:\n${contextStr}\n\n[USER QUESTION]: ${cleanText}`;
            }

            const roles = message.member ? message.member.roles.cache.map(r => r.name.toLowerCase()) : [];

            // Execute the AI generation
            const { text: aiReply, modelUsed, debug } = await melody.generateContent({
                userId: message.author.id,
                displayName: message.author.username,
                roles,
                channelId: message.channel.id,
                content: aiPromptContent, // <-- Sends the strictly formatted payload
                isGroupContext: Boolean(message.guild),
                mentionedUsers,
                knowledgeContext,
            });

            console.log(`🧠 [MELODY] intent=${debug?.intent} tier=${debug?.tier} model=${modelUsed}`);

            // 👑 EVERYONE MENTION LOGIC
            let finalReply = aiReply;
            const isCreator = message.author.id === '1369404203880939650';
            const isAdmin = message.member?.roles.cache.has('1372987132855058504');
            const allowedToPingEveryone = message.mentions.everyone && (isCreator || isAdmin);

            if (allowedToPingEveryone && !finalReply.includes('@everyone')) {
                finalReply = `@everyone\n\n${finalReply}`;
            }

            const mentionOptions = {
                repliedUser: false,
                parse: allowedToPingEveryone ? ['everyone'] : []
            };

            // 🚀 HYBRID OUTPUT: Attach Prebuilt Embeds (if any from router) to the AI response
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

            // Log AI reply to RAM safely
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
            // 🛡️ LAYER 1 FORTIFIED: Safe error fallback that will not crash if permissions are missing
            try { 
                await message.reply('My cognitive processors are cooling down, I am very busy right now! 🌸'); 
            } catch (e) {
                console.warn('⚠️ Could not send error fallback message (likely missing permissions).');
            }
        }
    } 

    // ==========================================
    // 🔔 PROACTIVE POPUP ENGINES ...
    // ==========================================

    // ⚔️ 6.3: CONTEXTUAL SUPPORT ENGINE (Boss Struggles)
    if (!supportCooldown.has(message.channel.id)) {
        try {
            const { data: history } = await ramClient
                .from('chat_ram')
                .select('message_content')
                .eq('channel_id', message.channel.id)
                .order('created_at', { ascending: false })
                .limit(2);

            const triggers = ['boss', 'tough', 'hard', 'score', 'stuck', 'impossible'];
            const isDifficultyConvo = history && history.length >= 2 &&
                history.every(m => triggers.some(t => m.message_content.toLowerCase().includes(t)));

            if (isDifficultyConvo) {
                supportCooldown.add(message.channel.id);
                setTimeout(() => supportCooldown.delete(message.channel.id), 120000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_yes_help').setLabel('Yes, Please!').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_no_thanks').setLabel('No, I got this').setStyle(ButtonStyle.Secondary)
                );
                
                // 🛡️ LAYER 3 FORTIFIED: Safe popup delivery
                await message.channel.send({
                    content: `💅 I noticed you boys are struggling. Do you need me to ping the Advisors for a strategy breakdown?`,
                    components: [row]
                });
            }
        } catch (err) { console.warn("⚠️ Support popup failed:", err.message); }
    }

    // 💰 6.4: PROACTIVE GOLD GUIDE ENGINE
    if (!goldCooldown.has(message.channel.id)) {
        try {
            const { data: history } = await ramClient
                .from('chat_ram')
                .select('message_content')
                .eq('channel_id', message.channel.id)
                .order('created_at', { ascending: false })
                .limit(5);

            const goldTriggers = ['gold', 'need gold', 'farm gold', 'how to farm', 'broke', 'no gold', 'out of gold'];

            let goldMentionCount = 0;
            if (history) {
                history.forEach(m => {
                    const content = m.message_content.toLowerCase();
                    if (goldTriggers.some(t => content.includes(t))) {
                        goldMentionCount++;
                    }
                });
            }

            if (goldMentionCount >= 2) {
                goldCooldown.add(message.channel.id);
                setTimeout(() => goldCooldown.delete(message.channel.id), 300000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_yes_gold').setLabel('Yes, show me!').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_no_gold').setLabel('No, I am rich.').setStyle(ButtonStyle.Secondary)
                );

                // 🛡️ LAYER 3 FORTIFIED
                await message.channel.send({
                    content: `💅 I noticed you guys are discussing gold farming. Do you want me to pull up the Ultimate Gold Blueprint?`,
                    components: [row]
                });
            }
        } catch (err) { console.warn("⚠️ Gold popup failed:", err.message); }
    }

    // 💎 6.5: PROACTIVE GEM GUIDE ENGINE
    if (!gemCooldown.has(message.channel.id)) {
        try {
            const { data: history } = await ramClient
                .from('chat_ram')
                .select('message_content')
                .eq('channel_id', message.channel.id)
                .order('created_at', { ascending: false })
                .limit(5);

            const gemTriggers = ['gem', 'need gems', 'low on gems', 'out of gems', 'how to farm gems', 'gem farming'];

            let gemMentionCount = 0;
            if (history) {
                history.forEach(m => {
                    const content = m.message_content.toLowerCase();
                    if (gemTriggers.some(t => content.includes(t))) {
                        gemMentionCount++;
                    }
                });
            }

            if (gemMentionCount >= 2) {
                gemCooldown.add(message.channel.id);
                setTimeout(() => gemCooldown.delete(message.channel.id), 300000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_yes_gem').setLabel('Yes, show me!').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_no_gem').setLabel('No, I have plenty.').setStyle(ButtonStyle.Secondary)
                );

                // 🛡️ LAYER 3 FORTIFIED
                await message.channel.send({
                    content: `💎 I noticed you guys are discussing gems. Do you want me to pull up the Gem Matrix?`,
                    components: [row]
                });
            }
        } catch (err) { console.warn("⚠️ Gem popup failed:", err.message); }
    }
}); 

// ==========================================
// 7. INTERACTION LISTENER (Buttons)
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    try {
        // --- SUPPORT BUTTON ---
        if (interaction.customId === 'btn_yes_help') {
            await interaction.message.edit({ components: [] });
            await interaction.reply({
                content: `🔔 **Tactical Support Initiated!** \n<@&1524079498646126662>, the team needs your breakdown! \n\n*Analysis complete. Protocols engaged.*`
            });
        } else if (interaction.customId === 'btn_no_thanks') {
            await interaction.message.edit({ components: [] });
            await interaction.reply({ content: `Fine, tough guys! Don't come crying to me when you lose. 💅` });
        }

        // --- GOLD BUTTONS ---
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

        // --- GEM BUTTONS ---
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

// ==========================================
// 8. HALL OF FAME LISTENER (Starboard)
// ==========================================
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

// ==========================================
// GLOBAL ERROR HANDLERS (Prevents Render Crashes)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception thrown:', err);
});

// ==========================================
// 9. DISCORD WEBSOCKET ERROR HANDLERS
// ==========================================
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

// 🚀 ADDED DEBUG LOGGING TO SEE EXACTLY WHERE THE BOT IS STUCK
// (token-related debug lines are filtered out so the token prefix never hits the logs)
client.on('debug', (info) => {
    if (typeof info === 'string' && info.toLowerCase().includes('token')) return;
    console.log('[DISCORD DEBUG]', info);
});

// ==========================================
// 10. BULLETPROOF LOGIN DIAGNOSTICS
// ==========================================
try {
    console.log("🛠️ [DIAGNOSTICS] Checking Environment Variables...");
    
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.trim() === '') {
        console.error("❌ [CRITICAL ERROR] The DISCORD_TOKEN is missing or completely empty in Render!");
    } else {
        console.log(`✅ [DIAGNOSTICS] Token found! Length: ${process.env.DISCORD_TOKEN.length} characters.`);
    }

    console.log("🛠️ [DIAGNOSTICS] Attempting to connect to Discord WebSocket...");

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
