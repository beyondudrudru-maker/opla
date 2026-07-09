require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// 1. IMPORT MODULES
const supabase = require('./database/supabase'); 
const aiModel = require('./ai/gemini'); 
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
        GatewayIntentBits.MessageContent 
    ]
});

// Cooldown trackers for popup engines & admin commands
const supportCooldown = new Set();
const goldCooldown = new Set(); 
const gemCooldown = new Set(); 
const adminCooldown = new Set(); // 👈 Cooldown for server moderation commands

client.once(Events.ClientReady, (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, Banter, & Smart Data.`);
    console.log('----------------------------------------');
    client.user.setActivity('over the !NF!N!TY family 💅', { type: 3 });
});

// 4. MEMORY CLEANUP (Runs every hour)
setInterval(async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    try {
        const { error } = await supabase.from('chat_ram').delete().lt('created_at', threeHoursAgo);
        if (!error) console.log('🧹 Memory Wiped.');
    } catch (err) { console.error('❌ Cleanup Error:', err); }
}, 3600000); 

// ==========================================
// 6. MESSAGE EVENT LISTENER (Core Engines)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // 🧠 6.1: MEMORY LOGIC (Always listening)
    await supabase.from('chat_ram').insert([{
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
            const { data, error } = await supabase
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

            // Sends the logs and STOPS the rest of the file from running
            return message.channel.send(logMessage);

        } catch (err) {
            console.error('[SUPABASE ERROR]', err);
            return message.channel.send("⚠️ I encountered a critical error while trying to connect to my memory banks.");
        }
    }

    // 🤖 6.2: AI RESPONSE LOGIC (Runs ONLY if explicitly tagged)
    if (isExplicitlyTagged) {

        // ==========================================
        // 🛡️ 6.2.1: THE HYBRID INTERCEPTOR (0 API COST)
        // Checks for admin keywords AND a targeted user mention
        // ==========================================
        const isModCommand = lowerText.includes('assign') || lowerText.includes('give') || lowerText.includes('remove') || lowerText.includes('take') || lowerText.includes('kick') || lowerText.includes('ban');
        const targetMember = message.mentions.members.filter(m => m.id !== client.user.id).first();

        // Only run interceptor if an action word is used AND a target is tagged
        if (isModCommand && targetMember) {
            
            // 1. Security Authorization
            const isSakha = message.author.id === '1369404203880939650';
            const isAdmin = message.member.roles.cache.has('1372987132855058504'); // Admin Role
            
            if (!isSakha && !isAdmin) {
                return message.reply("❌ **Access Denied:** You must be my King or a Clan Admin to command me to modify users.");
            }

            // 2. Cooldown Protection
            if (adminCooldown.has(message.author.id)) {
                return message.reply("⏳ Please wait a few seconds before issuing another server command.");
            }
            adminCooldown.add(message.author.id);
            setTimeout(() => adminCooldown.delete(message.author.id), 5000); 

            // 3. KICK LOGIC
            if (lowerText.includes('kick')) {
                try {
                    await targetMember.kick("Requested by Admin/Creator via INF AI");
                    return message.reply(`👢 Consider it done! I have kicked ${targetMember.user.username} from the server.`);
                } catch (err) {
                    return message.reply("❌ I don't have permission to kick this user. Check my role hierarchy!");
                }
            }

            // 4. BAN LOGIC
            if (lowerText.includes('ban')) {
                try {
                    await targetMember.ban({ reason: "Requested by Admin/Creator via INF AI" });
                    return message.reply(`🔨 Handled. ${targetMember.user.username} has been permanently banned.`);
                } catch (err) {
                    return message.reply("❌ I don't have permission to ban this user.");
                }
            }

            // 5. ROLE ASSIGNMENT LOGIC (Bundles & Direct Mentions)
            const roleBundles = {
                'boss': ['1413760143337721936'], // Single Boss Role
                'clan': ['1439158157640339557', '1373179239049859082'], // Both Clan Roles
                'main clan': ['1439158157640339557', '1373179239049859082'] // Alternate phrase for Clan Roles
            };

            let rolesToModify = [];
            
            // A. Grab any roles mentioned directly with an @ ping
            if (message.mentions.roles.size > 0) {
                message.mentions.roles.forEach(role => rolesToModify.push(role.id));
            } 
            
            // B. Grab roles from keywords/bundles
            for (const [bundleName, bundleIds] of Object.entries(roleBundles)) {
                if (lowerText.includes(bundleName)) {
                    rolesToModify = rolesToModify.concat(bundleIds);
                }
            }

            // Execute Role Modification
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

        // ==========================================
        // 🧠 6.2.2: GEMINI API CORE (WITH DEEP MEMORY)
        // ==========================================
        try {
            await message.channel.sendTyping();
            const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            
            if (cleanText.length === 0) {
                await message.reply("Yes, my Beyonder? 🌸");
                return;
            }

            // 🧠 STEP 1: FETCH CONVERSATION HISTORY FROM SUPABASE
            const { data: chatHistory } = await supabase
                .from('chat_ram')
                .select('*')
                .eq('channel_id', message.channel.id)
                .order('created_at', { ascending: false })
                .limit(20); // Fetches the last 20 messages for context

            let historyContext = "";
            if (chatHistory && chatHistory.length > 0) {
                historyContext = "\n[RECENT CONVERSATION HISTORY (Read this for context)]:\n";
                // Reverse to read chronologically (oldest to newest)
                const chronological = chatHistory.reverse();
                chronological.forEach(msg => {
                    historyContext += `- ${msg.player_name}: ${msg.message_content}\n`;
                });
                historyContext += "[END OF HISTORY]\n";
            }

            // ==========================================
            // 👤 SMART MENTION TRANSLATOR LOGIC
            // ==========================================
            let mentionsContext = "";
            const mentionedUsers = message.mentions.users.filter(u => u.id !== client.user.id);
            if (mentionedUsers.size > 0) {
                mentionsContext = `\n[CRITICAL FORMATTING RULE]: The user tagged other people in their message. Here is their data:\n`;
                mentionedUsers.forEach(u => {
                    mentionsContext += `- Name: ${u.username} | Discord Ping Format: <@${u.id}>\n`;
                });
                mentionsContext += `If you mention them in your reply, you MUST use the exact 'Discord Ping Format' (keep the < > brackets). Do NOT just type their numerical ID.\n`;
            }

            let contextData = "";
            
            // 🌐 Smart Context Injection with Math Instructions
            if (cleanText.toLowerCase().includes("gold guide") || cleanText.toLowerCase().includes("gold")) {
                contextData = `
                [SYSTEM RULE]: You are the !NF!N!TY Clan Tactical AI. 
                Below is the FULL official Gold Data. 
                CRITICAL INSTRUCTION: If the player mentions a specific amount of gold, you MUST use the 50-20-10-20 ratio from the Blueprint to calculate EXACTLY how much gold goes into each category. Show them the exact calculated numbers in your response.
                [OFFICIAL FULL GOLD DATA]: 
                ${rawGoldData}
                `;
            } else if (cleanText.toLowerCase().includes("gem guide") || cleanText.toLowerCase().includes("gem") || cleanText.toLowerCase().includes("gems")) {
                contextData = `
                [SYSTEM RULE]: You are the !NF!N!TY Clan Tactical AI. 
                Below is the FULL official Gem Data. 
                CRITICAL INSTRUCTION: If the player mentions a specific amount of gems, you MUST use the 40-20-20-10-10 matrix from the Blueprint to calculate EXACTLY how many gems go into each category. Show them the exact calculated numbers in your response.
                [OFFICIAL FULL GEM DATA]: 
                ${rawGemData}
                `;
            }

            // 🏗️ CONSTRUCT THE FINAL PROMPT WITH MEMORY
            const userPrompt = `
            ${contextData}
            ${historyContext}
            ${mentionsContext}
            [Current Message]
            [Sender ID: ${message.author.id} | Sender Name: ${message.author.username}]: ${cleanText}
            `;

            // 🚀 GENERATE AI RESPONSE
            const result = await aiModel.generateContent(userPrompt);
            const aiReply = result.response.text();
            
            await message.reply(aiReply);

            // 🧠 STEP 2: SAVE THE AI'S REPLY TO MEMORY
            // This ensures she remembers her own output for the next interaction!
            await supabase.from('chat_ram').insert([{
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
    // 🔔 PROACTIVE POPUP ENGINES (Runs ONLY if bot is NOT tagged)
    // =================================================================

    // ⚔️ 6.3: CONTEXTUAL SUPPORT ENGINE (Boss Struggles)
    if (!supportCooldown.has(message.channel.id)) {
        const { data: history } = await supabase
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
        const { data: history } = await supabase
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
        const { data: history } = await supabase
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

// 
// ==========================================
// 7. INTERACTION LISTENER (Buttons)
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
            content: `💎 Here is the Gem Matrix! Spend wisely. 💅`,
            embeds: [getGemGuide()] 
        });
    } 
    else if (interaction.customId === 'btn_no_gem') {
        await interaction.message.edit({ components: [] });
        await interaction.reply({ content: `Alright, keep hoarding those shiny rocks! 💅` });
    }
});

// ==========================================
// 8. HALL OF FAME ENGINE
// ==========================================
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const message = reaction.message;

        // Check conditions: Must be ✅, not a bot, and not already archived
        if (reaction.emoji.name === '✅' && !user.bot && !processedMessages.has(message.id)) {
            
            const hallOfFameChannelId = '1524834362544357457'; 
            const targetChannel = await client.channels.fetch(hallOfFameChannelId);

            if (!targetChannel) return; 

            processedMessages.add(message.id);
            const attachment = message.attachments.first()?.url;

            const embed = {
                color: 0xFFD700,
                author: { 
                    name: message.author.username,
                    iconURL: message.author.displayAvatarURL()
                },
                description: message.content || "✨ Highlighted Moment",
                image: attachment ? { url: attachment } : null,
                footer: { text: `Archived by ${user.username} | ✨ !NF!N!TY Hall of Fame` },
                timestamp: new Date(),
            };

            await targetChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("❌ Hall of Fame Error:", err);
    }
});

client.login(process.env.DISCORD_TOKEN);