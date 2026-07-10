require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// 1. IMPORT MODULES
const { ramClient } = require('./database/supabaseClient');

const melody = require('./api/gemini');                          // 👈 NEW modular pipeline (was: aiModel)
const knowledgeRetrieval = require('./knowledge/knowledgeRetrieval'); // 👈 NEW: gold/gem guide injection, extracted out
const { triggerScriptedBanter, isPrimeTime } = require('./ai/banter');
const { getGoldGuide, rawGoldData, getGemGuide, rawGemData } = require('./data/gameData');
const processedMessages = new Set();

// 2. SERVER SETUP
const app = express();
app.get('/', (req, res) => res.send('✨ INF AI Core is awake and monitoring.'));
app.listen(process.env.PORT || 3000, () => {
    console.log(`🌐 Web Server running.`);
});

// 3. DISCORD CLIENT SETUP
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Cooldown trackers for popup engines & admin commands
const supportCooldown = new Set();
const goldCooldown = new Set();
const gemCooldown = new Set();
const adminCooldown = new Set();

client.once(Events.ClientReady, (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, Banter, & Smart Data.`);
    console.log('----------------------------------------');
    client.user.setActivity('over the !NF!N!TY family 💅', { type: 3 });
});

// 4. MEMORY CLEANUP (Runs every hour)
// NOTE: this cleans ONLY `chat_ram` (Project 1 / ramClient), the
// lightweight activity log used by the popup engines (6.3-6.5) and the
// developer override (6.1.5). It must NEVER touch Project 2 / coreClient
// (`user_profiles`, `emotional_state`, `conversation_turns`,
// `long_term_memories` — personality traits + persistent memory). There is
// currently no automatic pruning job for coreClient tables in this
// codebase, so that data is retained indefinitely unless deleted manually.
setInterval(async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    try {
        const { error } = await ramClient.from('chat_ram').delete().lt('created_at', fiveHoursAgo);
        if (!error) console.log('🧹 5-Hour Memory Wiped.');
    } catch (err) { console.error('❌ Cleanup Error:', err); }
}, 3600000);

// ==========================================
// 6. MESSAGE EVENT LISTENER (Core Engines)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // 🧠 6.1: MEMORY LOGIC (Always listening — activity log for popups/debug)
    await ramClient.from('chat_ram').insert([{
        player_id: message.author.id,
        player_name: message.author.username,
        channel_id: message.channel.id,
        message_content: message.content
    }]);

    const lowerText = message.content.toLowerCase();
    const isExplicitlyTagged = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

    // 👑 6.1.5: DEVELOPER OVERRIDE (Runs FIRST to prevent AI collision)
    if (lowerText.includes('fetch chats from supabase') || lowerText.includes('present all chats')) {

        // SECURITY: Only Beyonder can run this code
        if (message.author.id !== '1369404203880939650') {
            return message.reply("❌ **Access Denied:** You do not have clearance to view server logs.");
        }

        await message.channel.send("🔄 Accessing the secure Supabase Memory RAM for you right now, my King... please wait. 🌸");

        try {
            const { data, error } = await ramClient
                .from('chat_ram')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            if (!data || data.length === 0) {
                return message.channel.send("I checked my memory banks, but the RAM is currently empty!");
            }

            let logMessage = "**📜 Here are my most recent memory records:**\n\n";

            data.forEach(row => {
                logMessage += `> **${row.player_name || 'Unknown'}:** ${row.message_content || '[No Content]'}\n`;
            });

            return message.channel.send(logMessage);

        } catch (err) {
            console.error('[SUPABASE ERROR]', err);
            return message.channel.send("⚠️ I encountered a critical error while trying to connect to my memory banks.");
        }
    }

    // 🤖 6.2: AI RESPONSE LOGIC (Runs ONLY if explicitly tagged)
    if (isExplicitlyTagged) {

        // ==========================================
        // 🛡️ 6.2.1: THE HYBRID INTERCEPTOR (0 API COST) — unchanged
        // Checks for admin keywords AND a targeted user mention
        // ==========================================
        const isModCommand = lowerText.includes('assign') || lowerText.includes('give') || lowerText.includes('remove') || lowerText.includes('take') || lowerText.includes('kick') || lowerText.includes('ban');
        const targetMember = message.mentions.members.filter(m => m.id !== client.user.id).first();

        if (isModCommand && targetMember) {

            const isSakha = message.author.id === '1369404203880939650';
            const isAdmin = message.member.roles.cache.has('1372987132855058504');

            if (!isSakha && !isAdmin) {
                return message.reply("❌ **Access Denied:** You must be my King or a Clan Admin to command me to modify users.");
            }

            if (adminCooldown.has(message.author.id)) {
                return message.reply("⏳ Please wait a few seconds before issuing another server command.");
            }
            adminCooldown.add(message.author.id);
            setTimeout(() => adminCooldown.delete(message.author.id), 5000);

            if (lowerText.includes('kick')) {
                try {
                    await targetMember.kick("Requested by Admin/Creator via INF AI");
                    return message.reply(`👢 Consider it done! I have kicked ${targetMember.user.username} from the server.`);
                } catch (err) {
                    return message.reply("❌ I don't have permission to kick this user. Check my role hierarchy!");
                }
            }

            if (lowerText.includes('ban')) {
                try {
                    await targetMember.ban({ reason: "Requested by Admin/Creator via INF AI" });
                    return message.reply(`🔨 Handled. ${targetMember.user.username} has been permanently banned.`);
                } catch (err) {
                    return message.reply("❌ I don't have permission to ban this user.");
                }
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
                if (lowerText.includes(bundleName)) {
                    rolesToModify = rolesToModify.concat(bundleIds);
                }
            }

            if (rolesToModify.length > 0) {
                try {
                    if (lowerText.includes('remove') || lowerText.includes('take')) {
                        await targetMember.roles.remove(rolesToModify);
                        return message.reply(`✅ As you wish. I have stripped the requested role(s) from ${targetMember.user.username}.`);
                    } else {
                        await targetMember.roles.add(rolesToModify);
                        return message.reply(`✅ Perfectly executed! I have granted the requested role(s) to ${targetMember.user.username}. 💅`);
                    }
                } catch (err) {
                    return message.reply("❌ **Role Error:** I cannot assign this. Please ensure my 'INF AI' role is placed HIGHER in your server settings than the roles you want me to give out.");
                }
            } else {
                return message.reply("⚠️ I couldn't figure out which role you want me to give. Try mentioning the role directly or using a bundle word like 'boss' or 'clan'.");
            }
        } // End of Hybrid Interceptor

        //
// ==========================================
// 📢 6.2.1c: ANNOUNCEMENT INTERCEPTOR (Real @everyone / @user pings)
// Only fires when creator/admin explicitly asks to mention/announce.
// This is a deterministic Discord action, not an AI-generated reply —
// the AI never fakes a mention in text; only this block can send a real one.
// ==========================================
const announceTriggers = ['mention everyone', 'tag everyone', 'announce', 'leave message', 'send message to everyone', 'ping everyone'];
const wantsAnnouncement = announceTriggers.some(t => lowerText.includes(t));

if (isExplicitlyTagged && wantsAnnouncement) {

    const isCreator = message.author.id === '1369404203880939650';
    const isAdmin = message.member?.roles.cache.has('1372987132855058504');

    if (!isCreator && !isAdmin) {
        return message.reply("❌ Only my Creator or a Clan Admin can ask me to send announcements.");
    }

    // Extract the actual message to broadcast: strip the bot mention and
    // the trigger phrase itself, keep whatever's left as the content.
    let announceText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    for (const trigger of announceTriggers) {
        announceText = announceText.replace(new RegExp(trigger, 'i'), '').trim();
    }
    if (announceText.length === 0) {
        announceText = 'Please check the announcement above! 🌸';
    }

    // Decide target: real @everyone, or a specific mentioned user, based
    // on what's actually present in the message (Discord's own mention data).
    const targetsEveryone = message.mentions.everyone || lowerText.includes('everyone');
    const targetedUser = message.mentions.users.filter(u => u.id !== client.user.id).first();

    try {
        if (targetsEveryone) {
            await message.channel.send({
                content: `@everyone ${announceText}`,
                allowedMentions: { parse: ['everyone'] },
            });
        } else if (targetedUser) {
            await message.channel.send({
                content: `<@${targetedUser.id}> ${announceText}`,
                allowedMentions: { users: [targetedUser.id] },
            });
        } else {
            return message.reply("⚠️ Tell me who to mention — @everyone or tag a specific person.");
        }
        return; // stop here, don't also run Melody Core for this message
    } catch (err) {
        console.error('[ANNOUNCEMENT ERROR]', err);
        return message.reply("❌ I couldn't send that — check my permissions in this channel.");
    }
} ==========================================
        // 🧠 6.2.2: MELODY CORE — now routed through the modular pipeline
        // (relationship / emotion / memory ranking / behavior / prompt
        //  assembly all happen inside melody.generateContent; this handler
        //  is now only responsible for gathering Discord-side inputs)
        // ==========================================
        try {
            await message.channel.sendTyping();
            const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

            if (cleanText.length === 0) {
                await message.reply("Yes, my Beyonder? 🌸");
                return;
            }

            // 👤 Mention translator data — same data as before, now passed
            // structured instead of pre-formatted into a giant string; the
            // pipeline's promptAssembler renders the ping-format block.
            const mentionedUsers = message.mentions.users
                .filter(u => u.id !== client.user.id)
                .map(u => ({ id: u.id, username: u.username }));

            // 🌐 Domain knowledge (gold/gem guides) — same trigger logic as
            // before, now owned by knowledge/knowledgeRetrieval.js instead
            // of inline if/else in this handler.
            const knowledgeContext = knowledgeRetrieval.retrieve(cleanText, { rawGoldData, rawGemData });

            // Roles, lowercased, for relationshipEngine tier resolution
            // (creator/admin/moderator/vip detection lives in
            // relationship/relationshipEngine.js, not here).
            const roles = message.member
                ? message.member.roles.cache.map(r => r.name.toLowerCase())
                : [];

            // 🚀 GENERATE — this single call now internally: resolves
            // relationship tier, updates time-decayed emotional state,
            // retrieves + ranks working & long-term memory (replacing the
            // old raw "last 20 messages" fetch from chat_ram), decides
            // response shape, assembles the prompt, routes to Flash or
            // Flash-Lite, and runs the repetition/emoji post-processor.
            // NOTE: melody.generateContent talks to Project 2 (coreClient)
            // internally via database/supabaseClient.js's core accessors —
            // it never touches chat_ram / ramClient.
            const { text: aiReply, modelUsed, debug } = await melody.generateContent({
                userId: message.author.id,
                displayName: message.author.username,
                roles,
                channelId: message.channel.id,
                content: cleanText,
                isGroupContext: Boolean(message.guild),
                mentionedUsers,
                knowledgeContext,
            });

            console.log(`🧠 [MELODY] intent=${debug.intent} tier=${debug.tier} model=${modelUsed}`);

            await message.reply(aiReply);

            // NOTE: melody.generateContent already persists both turns into
            // Melody's own conversation_turns/long_term_memories tables (on
            // Project 2 / coreClient) via decisionPipeline.finalizeTurn —
            // no manual memory write needed here. That data is never
            // touched by the 5-hour cleanup above. We still log the reply
            // into chat_ram (Project 1 / ramClient) below purely so the
            // popup engines (6.3-6.5) and dev override (6.1.5), which read
            // chat_ram directly, stay in sync.
            await ramClient.from('chat_ram').insert([{
                player_id: client.user.id,
                player_name: "INF AI",
                channel_id: message.channel.id,
                message_content: aiReply
            }]);

        } catch (error) {
            console.error('❌ AI Error:', error.message);
            try { await message.reply('My cognitive processors are cooling down. Google AI is very busy right now! 🌸'); }
            catch (e) { await message.channel.send(`<@${message.author.id}>, my cognitive processors are cooling down! 🌸`); }
        }
        return; // Stops checking popup engines if AI already replied
    }

    // =================================================================
    // 🔔 PROACTIVE POPUP ENGINES (Runs ONLY if bot is NOT tagged) — unchanged
    // =================================================================

    // ⚔️ 6.3: CONTEXTUAL SUPPORT ENGINE (Boss Struggles)
    if (!supportCooldown.has(message.channel.id)) {
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

            await message.channel.send({
                content: `💅 I noticed you boys are struggling. Do you need me to ping the Advisors for a strategy breakdown?`,
                components: [row]
            });
        }
    }

    // 💰 6.4: PROACTIVE GOLD GUIDE ENGINE (Smart Frequency Trigger)
    if (!goldCooldown.has(message.channel.id)) {
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

            await message.channel.send({
                content: `💅 I noticed you guys are discussing gold farming. Do you want me to pull up the Ultimate Gold Blueprint?`,
                components: [row]
            });
        }
    }

    // 💎 6.5: PROACTIVE GEM GUIDE ENGINE (Smart Frequency Trigger)
    if (!gemCooldown.has(message.channel.id)) {
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

            await message.channel.send({
                content: `💎 I noticed you guys are discussing gems. Do you want me to pull up the Gem Matrix?`,
                components: [row]
            });
        }
    }
});

// ==========================================
// 7. INTERACTION LISTENER (Buttons) — unchanged
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

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
        await interaction.reply({
            content: `💰 Here is the official gold blueprint! Read it carefully. 💅`,
            embeds: [getGoldGuide()]
        });
    }
    else if (interaction.customId === 'btn_no_gold') {
        await interaction.message.edit({ components: [] });
        await interaction.reply({ content: `Alright, keep hoarding that wealth! 💅` });
    }

    // --- GEM BUTTONS ---
    else if (interaction.customId === 'btn_yes_gem') {
        await interaction.message.edit({ components: [] });
        await interaction.reply({
            content: `💎 Here is the official gem matrix! Spend it wisely. 💅`,
            embeds: [getGemGuide()]
        });
    }
    else if (interaction.customId === 'btn_no_gem') {
        await interaction.message.edit({ components: [] });
        await interaction.reply({ content: `Alright, keep stacking those gems then! 💅` });
    }
});

client.login(process.env.DISCORD_TOKEN);
