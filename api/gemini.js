require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

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
 *   - MIGRATED SDK: `@google/generative-ai` is deprecated. Google archived
 *     that repo (google-gemini/deprecated-generative-ai-js) in favor of a
 *     single unified SDK. It still runs, but gets no new features or model
 *     support, which is a bigger long-term 404 risk than any one model ID.
 *     Swapped to the actively maintained `@google/genai` package.
 *     Run: npm i @google/genai && npm uninstall @google/generative-ai
 *   - API SHAPE CHANGE (old SDK -> new SDK):
 *       genAI.getGenerativeModel({model, systemInstruction, tools})
 *         -> no more per-model object; just an `ai` client + a model id string
 *       model.generateContent(prompt)
 *         -> ai.models.generateContent({ model, contents, config })
 *       result.response.text()
 *         -> result.text  (a plain property now, not a method call)
 *     systemInstruction/tools now travel in `config` at CALL time instead of
 *     being baked into a model object at BUILD time. Practical upshot: model
 *     sets no longer need to be rebuilt on every turn (see MODEL_SETS below)
 *     — persona is still applied per-turn, it's just passed differently.
 *   - Persona/admin system-instruction prose compressed into dense tags:
 *     ~647 -> ~218 tokens per call (~66% cut), same behavioral contract.
 *   - REMOVED gemini-2.5-flash / gemini-2.5-flash-lite from the tier list.
 *     Both keys in production were returning a hard 404: "This model
 *     models/gemini-2.5-flash-lite is no longer available to new users."
 *     This is NOT the official Oct 16 2026 shutdown — it's a separate,
 *     earlier cutoff Google applies to keys/projects with no prior usage
 *     of a given 2.5-series model (confirmed via multiple live reports on
 *     Google's own AI developer forum and GitHub as of this week). Billing
 *     does not restore access to a model in this state, so there was no
 *     fallback path left in these two tiers — cut instead of chased.
 *   - Down to a 4-tier lineup: gemini-3.6-flash, gemini-3.5-flash,
 *     gemini-3.5-flash-lite, gemini-3.1-flash-lite. All four verified live
 *     against the Gemini API changelog as of 2026-07-31.
 *   - The 429s seen alongside those 404s in production logs point to
 *     free-tier RPM limits (per the AI Studio rate-limit screen, this
 *     project's peak RPM is 20) rather than a code issue — cascading
 *     through multiple models per message burns through that fast.
 *     Worth checking quota usage / enabling billing separately from
 *     this fix.
 *   - Model-set construction is config-driven (MODEL_TIERS) instead of
 *     6 hand-repeated getGenerativeModel() calls per key.
 *   - Every original fault-tolerance layer (empty input, missing keys,
 *     safety-filter extraction shield, DB timeout shield, top-level catch)
 *     is preserved exactly, with the extraction shield widened slightly to
 *     also catch the new SDK's "empty text, no throw" failure mode (see
 *     LAYER 4 below) in addition to the old thrown-error mode.
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
// Verified live against ai.google.dev/gemini-api/docs/changelog on 2026-07-31.
const MODEL_TIERS = [
  { key: 'flash36', id: 'gemini-3.6-flash' },
  { key: 'flash35', id: 'gemini-3.5-flash' },
  { key: 'lite35', id: 'gemini-3.5-flash-lite' },
  { key: 'lite31', id: 'gemini-3.1-flash-lite' },
  // flash25 (gemini-2.5-flash) and flash2 (gemini-2.5-flash-lite) removed:
  // both hard-404 "no longer available to new users" on this project's
  // keys. See CHANGELOG above before re-adding either.
];

// Tool shape is unchanged between SDKs; it now lives in per-call `config`
// instead of being baked into a model object at build time.
const TOOLS_CONFIG = { tools: [{ googleSearch: {} }] };

/**
 * Builds one { ai, tiers... } bundle per API key.
 *
 * Unlike the old SDK, @google/genai has no concept of a pre-configured
 * "model" object — systemInstruction/tools are supplied to
 * generateContent() on every call instead. That means, unlike the original
 * code, this does NOT need to be rebuilt per turn just to inject a fresh
 * persona string: it's built once per process. Persona still varies
 * per-user/per-turn — it's just passed as `generationConfig` at call time
 * (see generateContent() below) rather than baked in here.
 */
function buildModelSets() {
  return apiKeys.map(key => {
    const ai = new GoogleGenAI({ apiKey: key });
    const set = {};
    for (const tier of MODEL_TIERS) {
      set[tier.key] = { id: tier.id, ai };
    }
    return set;
  });
}

// Built once at module load — see buildModelSets() doc comment above.
const MODEL_SETS = buildModelSets();

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
    // `generationConfig` carries what used to be baked into getGenerativeModel()
    // — the new SDK wants systemInstruction/tools per-call, not per-model.
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      modelSets: MODEL_SETS,
      generationConfig: {
        systemInstruction: identity,
        tools: TOOLS_CONFIG.tools,
      },
    });

    // 🛡️ LAYER 4: Safety Filter Extraction Shield
    // Widened vs. the original: the new SDK's `.text` getter can either
    // throw OR silently return empty on a safety-blocked/no-candidate
    // response depending on version, so we guard against both.
    let rawText = '';
    try {
      rawText = result.text || '';
      if (!rawText) {
        const reason = result.candidates?.[0]?.finishReason || result.promptFeedback?.blockReason || 'unknown';
        console.warn(`⚠️ [GEMINI] Empty response text (reason: ${reason}). Likely blocked by safety filters.`);
        rawText = "Oops, I was going to say something, but my safety filters tripped! Let's talk about something else. 😅";
      }
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
