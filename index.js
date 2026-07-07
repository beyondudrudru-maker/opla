require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// 1. IMPORT MODULES
const supabase = require('./database/supabase'); 
const aiModel = require('./ai/gemini'); 
const { triggerScriptedBanter, isPrimeTime } = require('./ai/banter'); 

// 👈 Fetching all external data from gameData.js
const { getGuideMenu, getGoldGuide, rawGoldData } = require('./data/gameData'); 

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

client.once(Events.ClientReady, (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, Banter, & Guide Data.`);
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

    const msgContent = message.content.toLowerCase().trim();

    // 🎯 6.1: LOCAL STATIC COMMANDS (Zero API Cost)
    if (msgContent === '!guide') {
        await message.reply({ embeds: [getGuideMenu()] });
        return; 
    } 
    else if (msgContent === '!guide gold') {
        await message.reply({ embeds: [getGoldGuide()] });
        return; 
    }

    // 🧠 6.2: MEMORY LOGIC 
    await supabase.from('chat_ram').insert([{
        player_id: message.author.id,
        player_name: message.author.username,
        channel_id: message.channel.id,
        message_content: message.content
    }]);

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

        const goldTriggers = ['gold', 'farm', 'broke', 'coins', 'not enough gold'];
        const isGoldConvo = history.length > 0 && 
            history.some(m => goldTriggers.some(t => m.message_content.toLowerCase().includes(t)));

        if (isGoldConvo) {
            goldCooldown.add(message.channel.id);
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

    // 🤖 6.5: AI RESPONSE LOGIC & TRANSLATION
    const isExplicitlyTagged = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

    if (isExplicitlyTagged) {
        try {
            await message.channel.sendTyping();
            const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            
            if (cleanText.length === 0) {
                await message.reply("Yes, my Beyonder? 🌸");
                return;
            }

            let contextData = "";
            
            // 🌐 AI Context Injection (Strictly fetching from rawGoldData)
            if (cleanText.toLowerCase().includes("gold guide") || cleanText.toLowerCase().includes("gold")) {
                contextData = `
                [SYSTEM RULE]: You are the !NF!N!TY Clan Guide. The player is asking about the Gold Guide. 
                Below is the FULL official data. Answer their specific question or perfectly translate this entire text into the language they requested.
                [OFFICIAL FULL GOLD DATA]: 
                ${rawGoldData}
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
    else if (interaction.customId === 'btn_yes_gold') {
        await interaction.message.edit({ components: [] });
        await interaction.reply({
            content: `💰 Here is the official blueprint! Read it carefully. 💅`,
            embeds: [getGoldGuide()] 
        });
    } 
    else if (interaction.customId === 'btn_no_gold') {
        await interaction.message.edit({ components: [] });
        await interaction.reply({ content: `Alright, keep hoarding that wealth! 💅` });
    }
});

client.login(process.env.DISCORD_TOKEN);
