require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { buildIdentityCore } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

/**
 * api/gemini.js
 *
 * PURPOSE
 *   Modular entrypoint connecting Gemini models across MULTIPLE API KEYS.
 *   Initializes the live Gen 2 & Gen 3 arsenal with smart, token-aware
 *   routing: key rotation for load spreading + an automatic model/key
 *   fallback cascade so a single dead endpoint or quota hit never kills
 *   the reply.
 *
 * FIXED IN THIS PASS
 *   - `gemini-2.0-flash` (flash20) and `gemini-1.5-flash` (flash15) are
 *     BOTH retired by Google — 2.0-flash shut down 2026-06-01, 1.5-flash
 *     shut down earlier. Every call to either was a guaranteed 404. Both
 *     removed and replaced with the live `flash25` (gemini-2.5-flash) and
 *     `lite35` (gemini-3.5-flash-lite) tiers, restoring a full 6-tier
 *     arsenal that's actually reachable.
 *   - If your modelRouter.js or decisionPipeline.js reference the old
 *     `flash20` / `flash15` keys anywhere, those need updating too — I
 *     don't have visibility into those files from here.
 *
 * NEW: SMART ROUTING
 *   1. Key rotation — each call rotates which key is "first" in the
 *      modelSets array, so a 2-key free-tier setup spreads load ~evenly
 *      instead of always hammering key #1 and only touching key #2 on
 *      overflow.
 *   2. Fallback cascade — if modelRouter.generate() throws (bad pick,
 *      quota, transient error), we don't give up immediately. We walk a
 *      priority-ordered tier list across every key until one responds,
 *      before falling through to the top-level catch.
 */

// ---- 🔑 Multi-key arsenal ----
const apiKeys = [process.env.GEMINI_API_KEY, process.env.aiapi]
  .filter(Boolean)
  .map(k => k.trim());

if (apiKeys.length === 0) {
  console.error('❌ FATAL: No Gemini API Keys found in environment variables!');
}

// ---- 🧠 Live model tiers only ----
// Ordered best-quality -> cheapest. This order also doubles as the
// fallback-cascade priority (see smartGenerate below).
const MODEL_TIERS = [
  { key: 'flash36', id: 'gemini-3.6-flash' },
  { key: 'flash35', id: 'gemini-3.5-flash' },
  { key: 'lite35', id: 'gemini-3.5-flash-lite' },
  { key: 'lite31', id: 'gemini-3.1-flash-lite' },
  { key: 'flash25', id: 'gemini-2.5-flash' },
  { key: 'lite25', id: 'gemini-2.5-flash-lite' },
];

const TOOLS_CONFIG = { tools: [{ googleSearch: {} }] };

function buildModelSets(systemInstruction) {
  return apiKeys.map(key => {
    const genAI = new GoogleGenerativeAI(key);
    const set = {};
    for (const tier of MODEL_TIERS) {
      set[tier.key] = genAI.getGenerativeModel({
        model: tier.id,
        systemInstruction,
        ...TOOLS_CONFIG,
      });
    }
    return set;
  });
}

// ---- 🔁 Smart key rotation ----
// Rotates which key index is "primary" each call so traffic spreads
// across both free-tier keys instead of always favoring key #1.
let rotationCounter = 0;
function rotateKeys(modelSets) {
  if (modelSets.length <= 1) return modelSets;
  const start = rotationCounter % modelSets.length;
  rotationCounter++;
  return [...modelSets.slice(start), ...modelSets.slice(0, start)];
}

// ---- 🧩 Fallback cascade ----
// Used only when modelRouter's own pick throws. Walks tiers in priority
// order across every key until something answers, instead of surfacing
// a hard failure to the user on the first bad roll.
async function smartGenerate({ classification, prompt, modelSets }) {
  try {
    return await modelRouter.generate({ classification, prompt, modelSets });
  } catch (routerError) {
    console.warn('⚠️ [GEMINI] Router pick failed, engaging fallback cascade:', routerError.message);
  }

  for (const tier of MODEL_TIERS) {
    for (let i = 0; i < modelSets.length; i++) {
      const model = modelSets[i][tier.key];
      if (!model) continue;
      try {
        const result = await model.generateContent(prompt);
        return { result, modelUsed: `${tier.key}(key${i + 1},fallback)` };
      } catch (err) {
        console.warn(`⚠️ [GEMINI] Fallback attempt ${tier.key}/key${i + 1} failed:`, err.message);
      }
    }
  }

  throw new Error('All models across all keys exhausted.');
}

// ---- 🗜️ Dense, token-efficient persona directives ----
const PERSONA_RUNTIME = `
=== PERSONA_RUNTIME ===
STYLE:human,fluent,warm,witty,confident
BAN:"as an AI"|"language model"|"AI assistant"
LYRICS/BHAJAN:exact_original_only,zero_blend,zero_hallucinate
UNSURE_FALLBACK:casual_honest,never_corporate_hedge
=== ADMIN_OVERRIDE trigger:[mgmt|announce|@everyone|clan_event] ===
TONE:sharp,authoritative,professional
OMIT:pet_names,heart_emoji,romantic_undertone`.trim();

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return {
      text: "I didn't quite catch that! Could you repeat?",
      modelUsed: 'none',
      debug: { error: 'Empty input' },
    };
  }

  if (apiKeys.length === 0) {
    return {
      text: "I'm feeling disconnected right now! My API keys are missing. Let my creator know!",
      modelUsed: 'fallback',
      debug: { error: 'No API keys' },
    };
  }

  try {
    const identity = `${buildIdentityCore(turn.userId)}\n\n${PERSONA_RUNTIME}`;
    const modelSets = rotateKeys(buildModelSets(identity));

    let contextualPrompt = turn.content;

    if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (Discord ID: <@${u.id}>)`).join(', ');
      contextualPrompt += `\n\n[SYSTEM CONTEXT: Mentioned users: ${mentionsInfo}. Interact with exact syntax <@${turn.mentionedUsers[0].id}>]`;
    }

    const adminKeywords = /@everyone|clan|announce|notify|server|event/i;
    if (adminKeywords.test(turn.content)) {
      contextualPrompt += `\n\n[SYSTEM DIRECTIVE: Official clan/server command detected. Maintain authoritative tone.]`;
    }

    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);

    // 🚀 SMART ROUTER + FALLBACK CASCADE
    const { result, modelUsed } = await smartGenerate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      modelSets,
    });

    let rawText = '';
    try {
      rawText = result.response.text();
    } catch (extractError) {
      console.warn('⚠️ [GEMINI] Text extraction blocked by safety filter:', extractError.message);
      rawText = "Oops, my safety filters tripped on that request! Let's talk about something else. 😅";
    }

    const { text } = styleLinter.process({
      channelId: turn.channelId,
      responseText: rawText,
      emojiBudget: plan.behaviorDirective?.emojiBudget || 'medium',
    });

    try {
      await decisionPipeline.finalizeTurn({
        channelId: turn.channelId,
        userId: turn.userId,
        content: turn.content,
        responseText: text,
      });
    } catch (dbError) {
      console.error('⚠️ [GEMINI] Database finalizeTurn warning:', dbError.message);
    }

    return {
      text,
      modelUsed,
      debug: {
        intent: plan.classification?.intent || 'social',
        tier: plan.relationship?.tier || 'standard',
        behaviorDirective: plan.behaviorDirective,
      },
    };
  } catch (error) {
    console.error('❌ Error in generateContent pipeline:', error);
    return {
      text: 'Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸',
      modelUsed: 'fallback',
      debug: { intent: 'error', tier: 'standard', error: error.message },
    };
  }
}

module.exports = { generateContent };
