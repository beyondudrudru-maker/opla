require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { IDENTITY_CORE } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

/**
 * api/gemini.js
 *
 * PURPOSE
 *   Thin entrypoint. Wires the modular pipeline together and exposes the
 *   same `smartBrain.generateContent`-shaped API your Discord event handler
 *   already calls — so integrating this is a drop-in replacement, not a
 *   rewrite of your bot.js.
 *
 * EXAMPLE FLOW
 *   Discord message -> handleMessage({ userId, displayName, roles,
 *     channelId, content, isGroupContext })
 *   -> decisionPipeline.planTurn(...)   [pure code: relationship, emotion,
 *        memory, ranking, behavior, prompt assembly]
 *   -> modelRouter.generate(...)        [only step touching Gemini]
 *   -> styleLinter.process(...)         [repetition/emoji enforcement]
 *   -> decisionPipeline.finalizeTurn(...) [persist the turn]
 *   -> return final text to Discord
 *
 * POTENTIAL PROBLEMS / PRODUCTION NOTES
 *   - Supabase not configured: falls back to in-memory store (see
 *     database/supabaseClient.js) — fine for dev, NOT for production
 *     (state resets on every restart).
 *   - Gemini rate limits: modelRouter already falls back Flash -> Lite on
 *     error; consider a second fallback (queued retry) if Lite also fails.
 *   - Reflection job (reflection/reflectionJob.js) must be scheduled
 *     externally (cron/Edge Function) — it does not run automatically here.
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Gemini API Key missing in .env file!');
}

const genAI = new GoogleGenerativeAI(apiKey);
const flashModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', systemInstruction: IDENTITY_CORE });
const liteModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite', systemInstruction: IDENTITY_CORE });

/**
 * Main entrypoint, replacing the old smartBrain.generateContent(prompt).
 *
 * @param {object} turn
 * @param {string} turn.userId - Discord user ID of the speaker
 * @param {string} turn.displayName - Discord display name
 * @param {string[]} [turn.roles] - Discord role names, e.g. ['admin']
 * @param {string} turn.channelId - Discord channel ID
 * @param {string} turn.content - the raw message text
 * @param {boolean} [turn.isGroupContext] - true for multi-party channels
 * @returns {Promise<{ text: string, modelUsed: string, debug: object }>}
 */
async function generateContent(turn) {
  const plan = await decisionPipeline.planTurn(turn);

  const { result, modelUsed } = await modelRouter.generate({
    classification: plan.classification,
    prompt: plan.prompt,
    flashModel,
    liteModel,
  });

  const rawText = result.response.text();
  const { text } = styleLinter.process({
    channelId: turn.channelId,
    responseText: rawText,
    emojiBudget: plan.behaviorDirective.emojiBudget,
  });

  await decisionPipeline.finalizeTurn({
    channelId: turn.channelId,
    userId: turn.userId,
    content: turn.content,
    responseText: text,
  });

  return {
    text,
    modelUsed,
    debug: {
      intent: plan.classification.intent,
      tier: plan.relationship.tier,
      behaviorDirective: plan.behaviorDirective,
    },
  };
}

module.exports = { generateContent };
