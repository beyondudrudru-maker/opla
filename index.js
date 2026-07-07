require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// 1. IMPORT MODULES
const supabase = require('./database/supabase'); 
const aiModel = require('./ai/gemini'); 
const { triggerScriptedBanter, isPrimeTime } = require('./ai/banter'); 

// 👈 Importing Both Guides for Buttons + Raw Data for AI
const { getGoldGuide, rawGoldData, getGemGuide, rawGemData } = require('./data/gameData'); 

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

// Cooldown trackers
const supportCooldown = new Set();
const goldCooldown = new Set(); 
const gemCooldown = new Set(); // 👈 NEW: Cooldown for Gem triggers

client.once(Events.ClientReady, (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, Banter, & Smart Data.`);
    console.log('----------------------------------------');
    client.user.setActivity('over the !NF!N!TY family 💅', { type: 3 });
});

// 4. MEMORY CLEANUP
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

    const isExplicitlyTagged = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

    // 🤖 6.2: AI RESPONSE LOGIC (Runs ONLY if explicitly tagged)
    if (isExplicitlyTagged) {
        try {
            await message.channel.sendTyping();
            const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            
            if (cleanText.length === 0) {
                await message.reply("Yes, my Beyonder? 🌸");
                return;
            }

            let contextData = "";
            
            // 🌐 Smart Context Injection with Math Instructions
            if (cleanText.toLowerCase().includes("gold guide") || cleanText.toLowerCase().includes("gold")) {
                contextData = `
                [SYSTEM RULE]: You are the !NF!N!TY Clan Tactical AI. 
                Below is the FULL official Gold Data. 
                CRITICAL INSTRUCTION: If the player mentions a specific amount of gold (e.g., "15 million", "10k", "50000"), you MUST use the 50-20-10-20 ratio from the Blueprint to calculate EXACTLY how much gold goes into each category. Show them the exact calculated numbers in your response.
                [OFFICIAL FULL GOLD DATA]: 
                ${rawGoldData}
                `;
            } else if (cleanText.toLowerCase().includes("gem guide") || cleanText.toLowerCase().includes("gem") || cleanText.toLowerCase().includes("gems")) {
                contextData = `
                [SYSTEM RULE]: You are the !NF!N!TY Clan Tactical AI. 
                Below is the FULL official Gem Data. 
                CRITICAL INSTRUCTION: If the player mentions a specific amount of gems (e.g., "10000", "5k", "2000"), you MUST use the 40-20-20-10-10 matrix from the Blueprint to calculate EXACTLY how many gems go into each category. Show them the exact calculated numbers in your response.
                [OFFICIAL FULL GEM DATA]: 
                ${rawGemData}
                `;
            }

            const userPrompt = `
            ${contextData}
            [Sender ID: ${message.author.id} | Sender Name: ${message.author.username}]: ${cleanText}
            `;

            const result = await aiModel.generateContent(userPrompt);
            await message.reply(result.response.text());

        } catch (error) {
            console.error('❌ AI Error:', error.message);
            try { await message.reply('My cognitive processors are cooling down. Google AI is very busy right now! 🌸'); } 
            catch (e) { await message.channel.send(`<@${message.author.id}>, my cognitive processors are cooling down! 🌸`); }
        }
        return; // 👈 CRITICAL FIX: Agar AI ne reply de diya, toh aage ke Popups check nahi honge!
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
        const isDifficultyConvo = history.length >= 2 && 
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

    // 💰 6.4: PROACTIVE GOLD GUIDE ENGINE
if (!goldCooldown.has(message.channel.id)) {
    const { data: history } = await supabase
        .from('chat_ram')
        .select('message_content')
        .eq('channel_id', message.channel.id)
        .order('created_at', { ascending: false })
        .limit(2);

    // Broader, more robust triggers for Gold
    const goldTriggers = ['gold', 'need gold', 'farm gold', 'how to farm', 'broke', 'no gold', 'out of gold'];
    
    // Check if the latest message or the one before it contains a trigger
    const isGoldConvo = history.length > 0 && 
        history.some(m => goldTriggers.some(t => m.message_content.toLowerCase().includes(t)));

    if (isGoldConvo) {
        goldCooldown.add(message.channel.id);
        // Set cooldown for 5 minutes (300000 ms)
        setTimeout(() => goldCooldown.delete(message.channel.id), 300000); 

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_yes_gold').setLabel('Yes, show me!').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('btn_no_gold').setLabel('No, I am rich.').setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({
            content: `💅 I noticed you guys are talking about farming gold. Do you want me to pull up the Ultimate Gold Blueprint?`,
            components: [row]
        });
    }
}

    // 💎 6.5: PROACTIVE GEM GUIDE ENGINE (NEW)
    if (!gemCooldown.has(message.channel.id)) {
        const { data: history } = await supabase
            .from('chat_ram')
            .select('message_content')
            .eq('channel_id', message.channel.id)
            .order('created_at', { ascending: false })
            .limit(2);

        const gemTriggers = ['need gems', 'low on gems', 'out of gems', 'how to farm gems', 'gem farming'];
        const isGemConvo = history.length > 0 && 
            history.some(m => gemTriggers.some(t => m.message_content.toLowerCase().includes(t)));

        if (isGemConvo) {
            gemCooldown.add(message.channel.id);
            setTimeout(() => gemCooldown.delete(message.channel.id), 300000); 

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_yes_gem').setLabel('Yes, show me!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_no_gem').setLabel('No, I have plenty.').setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({
                content: `💎 I noticed you guys are talking about gems. Do you want me to pull up the Gem Matrix?`,
                components: [row]
            });
        }
    }
});

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

    // --- GEM BUTTONS (NEW) ---
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

client.login(process.env.DISCORD_TOKEN);
