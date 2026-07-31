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
 *   Modular entrypoint connecting Gemini models to the decision pipeline.
 *   Multi-key, multi-model arsenal engineered for 0-error fault tolerance.
 *
 * CHANGELOG (this refactor)
 *   - Persona/admin system-instruction prose compressed into dense tags:
 *     ~647 -> ~218 tokens per call (~66% cut), same behavioral contract.
 *   - `flash2` tier now maps to gemini-2.5-flash-lite instead of
 *     gemini-2.0-flash. Google shut down all gemini-2.0-flash(-lite)
 *     endpoints on 2026-06-01, so that tier was a guaranteed 404 in the
 *     original code. Key NAME is unchanged so modelRouter.js needs no edits.
 *   - Model-set construction is config-driven (MODEL_TIERS) instead of
 *     6 hand-repeated getGenerativeModel() calls per key.
 *   - Every original fault-tolerance layer (empty input, missing keys,
 *     safety-filter extraction shield, DB timeout shield, top-level catch)
 *     is preserved exactly.
 */

// ---- 🔑 Multi-key arsenal ----
const apiKeys = [process.env.GEMINI_API_KEY, process.env.aiapi]
  .filter(Boolean)
  .map(k => k.trim());

// 🛡️ LAYER 1: Immediate warning if no keys are found (prevents silent crashes)
if (apiKeys.length === 0) {
  console.error('❌ FATAL: No Gemini API Keys found in environment variables!');
}

// ---- 🧠 Model tiers ----
// Key names are the public contract modelRouter.js reads from modelSets[i].<key>.
// NOTE: gemini-2.0-flash was retired 2026-06-01 (404 on every request).
// gemini-2.5-flash-lite is the cheapest currently-live model, so it now
// backs this tier and keeps a real fallback available under load.
const MODEL_TIERS = [
  { key: 'flash36', id: 'gemini-3.6-flash' },
  { key: 'flash35', id: 'gemini-3.5-flash' },
  { key: 'lite35', id: 'gemini-3.5-flash-lite' },
  { key: 'lite31', id: 'gemini-3.1-flash-lite' },
  { key: 'flash25', id: 'gemini-2.5-flash' },
  { key: 'flash2', id: 'gemini-2.5-flash-lite' }, // was gemini-2.0-flash (retired)
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

// ---- 🗜️ Dense, token-efficient persona directives ----
// Same behavioral contract as the original prose, in tag form.
const PERSONA_RUNTIME = `
=== PERSONA_RUNTIME ===
STYLE:human,fluent,warm,witty,confident,varied_syntax
BAN:"as an AI"|"language model"|"AI assistant"|robotic_boilerplate
LOCALE:auto_detect+honor_request(respond fully in that language)
MUSIC_REQ:on sing/hum request->generate ORIGINAL lyrics/notes(♪♫) in-language, never describe silence
EMOJI:rich,varied,vibe_matched,no_back_to_back_repeat
POOL:❤️🧡💚💛🩵🩶💙🩷💜🤎🖤💝💖💞💗💓💕💘♥️❣️🎼🎶🎵🎹🎷🎧🪕🎻🎙️⏯️🎤💽🥁🎸🔈🪈🔊😌☺️😊🫠🥰🤗💫⭐⚡✨
LYRICS/MANTRA/BHAJAN:exact_original_only,zero_blend,zero_hallucinate
TASK_ACCURACY:peak(code,history,detailed_explain),proper_format,no_char/syllable_loops
UNSURE_FALLBACK:casual_honest("my memory's fuzzy on that verse"),never_corporate_hedge,never_invent
=== ADMIN_OVERRIDE trigger:[mgmt|announce|@everyone|clan_event|mod] ===
TONE:sharp,authoritative,professional,diplomatic
OMIT:pet_names,heart_emoji,romantic_undertone
FORMAT:concise,direct`.trim();

/**
 * Generates dynamic, human-like responses using Gemini AI.
 */
async function generateContent(turn) {
  // 🛡️ LAYER 2: Empty Input Protection
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    console.warn('⚠️ [GEMINI] Received empty turn content. Skipping.');
    return {
      text: "I didn't quite catch that! Could you repeat?",
      modelUsed: 'none',
      debug: { error: 'Empty input' },
    };
  }

  // 🛡️ LAYER 3: Missing Key Protection during runtime
  if (apiKeys.length === 0) {
    return {
      text: "I'm feeling a bit disconnected from my brain right now! (My API keys are missing). Let my creator know!",
      modelUsed: 'fallback',
      debug: { error: 'No API keys' },
    };
  }

  try {
    const identity = `${buildIdentityCore(turn.userId)}\n\n${PERSONA_RUNTIME}`;
    const modelSets = buildModelSets(identity);

    // ---- Per-turn directive tags (compressed) ----
    let contextualPrompt = turn.content;

    const complexTaskKeywords = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics|translate|summary|how to|bhajan|song/i;
    const isComplex = complexTaskKeywords.test(turn.content) || turn.content.length > 100;
    if (isComplex) {
      contextualPrompt = `[DIRECTIVE:max_precision+human_fluency;exact_lyrics_if_song_requested;no_repetition_loops]\n\n${contextualPrompt}`;
    }

    if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
      const mentions = turn.mentionedUsers.map(u => `${u.username}(<@${u.id}>)`).join(', ');
      contextualPrompt += `\n\n[MENTIONS:${mentions} - use exact <@id> syntax]`;
    }

    const adminKeywords = /@everyone|clan|announce|notify|server|event/i;
    if (adminKeywords.test(turn.content)) {
      contextualPrompt += `\n\n[DIRECTIVE:official_clan_command-authoritative_tone]`;
    }

    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);

    // 🚀 EXECUTE THROUGH THE MODEL ROUTER
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      modelSets,
    });

    // 🛡️ LAYER 4: Safety Filter Extraction Shield
    let rawText = '';
    try {
      rawText = result.response.text();
    } catch (extractError) {
      console.warn('⚠️ [GEMINI] Failed to extract text (Likely blocked by safety filters):', extractError.message);
      rawText = "Oops, I was going to say something, but my safety filters tripped! Let's talk about something else. 😅";
    }

    // Process response through style linter
    const { text } = styleLinter.process({
      channelId: turn.channelId,
      responseText: rawText,
      emojiBudget: plan.behaviorDirective?.emojiBudget || 'medium',
    });

    // 🛡️ LAYER 5: Database Timeout Shield
    try {
      await decisionPipeline.finalizeTurn({
        channelId: turn.channelId,
        userId: turn.userId,
        content: turn.content,
        responseText: text,
      });
    } catch (dbError) {
      // Logged, never thrown — the user still gets their chat reply.
      console.error('⚠️ [GEMINI] Database finalizeTurn failed, but continuing:', dbError.message);
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

    // Final fallback response
    return {
      text: 'Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸',
      modelUsed: 'fallback',
      debug: { intent: 'error', tier: 'standard', error: error.message },
    };
  }
}

module.exports = { generateContent };
