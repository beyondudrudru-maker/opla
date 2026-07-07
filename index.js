require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// 1. IMPORT MODULES
const supabase = require('./database/supabase'); 
const aiModel = require('./ai/gemini'); 
const { triggerScriptedBanter, isPrimeTime } = require('./ai/banter'); 

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

const supportCooldown = new Set();

client.once(Events.ClientReady, (readyClient) => {
    console.log('----------------------------------------');
    console.log(`🌸 System Online: ${readyClient.user.tag} is awake.`);
    console.log(`👁️  Engines Active: Contextual Support, AI, and Banter.`);
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

// 🔄 5. BANTER ENGINE TRIGGER (Drama Module - PAUSED)
/*setInterval(async () => {
    if (isPrimeTime()) {
        // 25% chance to trigger banter every 10 minutes if it's Prime Time
        if (Math.random() < 0.25) {
            const channel = client.channels.cache.get('1414885556017561621'); 
            if (channel) {
                await triggerScriptedBanter(channel);
            }
        }
    }
}, 600000); */

// ==========================================
// 6. MESSAGE EVENT LISTENER (Memory + Support + AI)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // A: MEMORY LOGIC (Always listening and saving data)
    await supabase.from('chat_ram').insert([{
        player_id: message.author.id,
        player_name: message.author.username,
        channel_id: message.channel.id,
        message_content: message.content
    }]);

    // B: CONTEXTUAL SUPPORT ENGINE (Triggered without mentions)
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

    // C: AI RESPONSE LOGIC (Smart Efficiency Management)
    // 🧠 FILTER: Only true if the bot is EXPLICITLY tagged in the text content (ignores auto-reply pings)
    const isExplicitlyTagged = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

    if (isExplicitlyTagged) {
        try {
            await message.channel.sendTyping();
            
            // Clean the tag from the text (handles both <@ID> and <@!ID> formats)
            const cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            
            // Efficiency Rule: If user just tagged without any message
            if (cleanText.length === 0) {
                await message.reply("Yes, my Beyonder? 🌸");
                return;
            }

            const userPrompt = `[Sender ID: ${message.author.id} | Sender Name: ${message.author.username}]: ${cleanText}`;

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
});

client.login(process.env.DISCORD_TOKEN);