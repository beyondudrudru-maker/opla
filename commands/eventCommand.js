/**
 * commands/eventCommand.js  —  !event
 * Heavy AI path (aiFallback.askAI). Bypasses decisionPipeline: no relationship, emotion, memory, chat history.
 * Sends ONLY the active boss record (+bossTroopMeta) or ONLY the Clan Clash data.
 */
'use strict';
const { askAI } = require('../ai/aiFallback');
const { replyChunked } = require('../utils/replyChunked');
const { bossLabel } = require('./commandConfig');
const eventState = require('./eventState');
const bossCommand = require('./bossCommand');
const clanClash = require('../data/clanClash');
const gloriousHunt = require('../data/gloriousHunt');

// 'STRATEGY' (uppercase) is in classification.js GAME_INTENTS -> category gameStrategy (heavy models).
// maxTokens/temp are honored by the 2-line modelRouter.js override (default gameStrategy cap is 1536).
const HEAVY_CLASSIFICATION = { intent: 'STRATEGY', maxTokens: 3072, temp: 0.5 };
// Emergency fallback (gpt-oss-20b) is capped at 384 tokens (~1.5k chars): never cache those short outputs.
const MIN_CACHE_CHARS = 1700;
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map(); // key -> { text, at }

async function handle({ message, melody, requestQueue }) {
    const { event, kind, boss } = await eventState.resolve();

    if (kind === 'boss' && !boss) {
        return message.reply(`🐉 Glorious Boss Hunt is live, but no boss is set yet. An admin needs to run \`${bossLabel} set <name>\`, then ask me again.`).catch(() => {});
    }

    const key = `${kind}:${boss ? boss.id : 'clash'}`;
    const hit = cache.get(key);
    let text = hit && Date.now() - hit.at < TTL_MS ? hit.text : null;

    if (!text) {
        let context, userMessage, queryFlags;
        if (kind === 'boss') {
            context = { gloriousHunt, bossRecords: [bossCommand.buildPayload(boss)] };
            const meta = bossCommand.getBossTroopMeta();
            if (meta) context.bossTroopMeta = meta;
            userMessage = `Full event briefing for the ${event}. Current boss: ${boss.name}.`;
            queryFlags = { isBossQuery: true, isEventBriefing: true };
        } else {
            context = { clanClash, phase: kind === 'prep' ? 'Prep Day (Thursday)' : 'PvP phase (Friday to Sunday)' };
            userMessage = `Strategic briefing for today's event: ${event}.`;
            queryFlags = { isClashEvent: true, isEventBriefing: true };
        }

        await message.channel.sendTyping().catch(() => {});
        const out = await requestQueue.enqueue(() => askAI({
            userMessage,
            intent: 'STRATEGY',
            context,
            geminiKeys: melody.geminiKeys,
            groqKeys: melody.groqKeys,
            classification: HEAVY_CLASSIFICATION,
            queryFlags
        }));
        text = typeof out === 'string' ? out.trim() : (out?.text || '').trim();
        if (!text) return message.reply('⚠️ Strategy engine is busy. Try again in a bit.').catch(() => {});
        if (text.length >= MIN_CACHE_CHARS && !text.startsWith('My strategy engine hit a snag')) cache.set(key, { text, at: Date.now() });
    }

    const header = kind === 'boss' ? `🛡️ **${event}** — current boss: **${boss.name}**` : `⚔️ **${event}**`;
    return replyChunked(message, `${header}\n\n${text}`);
}

module.exports = { handle };
