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
 *   Synchronized with modelRouter for Multi-Key failover (modelSets).
 */

// Grab keys for Multi-Key Fallback
const apiKeys = [process.env.GEMINI_API_KEY, process.env.aiapi]
  .filter(Boolean)
  .map(k => k.trim());

if (apiKeys.length === 0) {
  console.error('❌ FATAL: No Gemini API Keys found in environment variables!');
}

// Stable active models lineup to prevent 404s and manage rate limits
const MODEL_TIERS = [
  { key: 'flash36', id: 'gemini-1.5-flash' },
  { key: 'flash35', id: 'gemini-1.5-flash' },
  { key: 'lite35', id: 'gemini-1.5-flash' },
  { key: 'lite31', id: 'gemini-1.5-flash' },
  { key: 'flash25', id: 'gemini-1.5-flash' },
  { key: 'flash2', id: 'gemini-1.5-flash' },
];

const TOOLS_CONFIG = { tools: [{ googleSearch: {} }] };

// Function to build all models across all available API keys
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

/**
 * Generates dynamic, human-like responses using Gemini AI.
 */
async function generateContent(turn) {
  // Empty Check
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return {
      text: "I didn't quite catch that! Could you repeat?",
      modelUsed: 'none',
      debug: { error: 'Empty input' },
    };
  }

  // Key Check
  if (apiKeys.length === 0) {
    return {
      text: "I'm feeling a bit disconnected from my brain right now! (My API keys are missing).",
      modelUsed: 'fallback',
      debug: { error: 'No API keys' },
    };
  }

  try {
    let dynamicIdentity = buildIdentityCore(turn.userId);

    // === HUMAN-LIKE CONVERSATIONAL ENFORCEMENT ===
    dynamicIdentity += `\n\n=== HUMAN CONVERSATIONAL FLOW & PERSONA REALISM (CRITICAL) ===
1. SPEAK NATURALLY & HUMAN-LIKE: Adopt an authentic, fluent, and emotionally expressive conversational style. Avoid robotic language, stiff boilerplate, or generic disclaimers.
2. FLUID & ADAPTIVE TONE: Express humor, subtle wit, confidence, and genuine warmth or sass depending on context.
3. MATCH THE VIBE & MULTILINGUAL SUPPORT: You serve an international player base. When asked to sing, hum, or share a musical moment, DO NOT just describe the silence. You MUST generate beautiful, original lyrics, verses, or humming using text/notes (e.g., *humming a soft tune... ♪ ♫*). Must detect the user's language and respond fluently.
4. DYNAMIC EMOJI EXPRESSION: Use a rich, diverse variety of emojis. (❤️🧡💚💛🩵🩶💙🩷💜🤎🖤💝💖💞💗💓💕💘♥️❣️🎼🎶🎵🎹🎷🎧🪕🎻🎙️⏯️🎤💽🥁🎸🔈🪈🔊😌☺️😊🫠🥰🤗💫⭐⚡✨).
5. STRICT CULTURAL & LYRICAL ACCURACY: When asked for the lyrics of a specific song, bhajan, mantra, or poem, you MUST provide the exact, factual, original lyrics. DO NOT combine, blend, or hallucinate.
6. ERROR RECOVERY: If you don't know the exact lyrics to a requested song, respond casually like a smart person.`;

    // === ADMINISTRATIVE & CLAN OVERRIDE ===
    dynamicIdentity += `\n\n=== ADMINISTRATIVE & CLAN OVERRIDE (CRITICAL) ===
If the user's command involves SERVER MANAGEMENT, PUBLIC ANNOUNCEMENTS, CLAN EVENTS, or MODERATION:
1. Adopt a sharp, authoritative, professional, and diplomatic tone.
2. Omit pet names, heart emojis, or overly casual romantic undertones.`;

    // Build the Multi-Key Model Sets
    const modelSets = buildModelSets(dynamicIdentity);

    let contextualPrompt = turn.content;
    
    // Tag long-form or complex prompts
    const complexTaskKeywords = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics|translate|summary|how to|bhajan|song/i;
    if (complexTaskKeywords.test(turn.content) || turn.content.length > 100) {
        contextualPrompt = `[SYSTEM DIRECTIVE: EXECUTE WITH MAXIMUM PRECISION AND NATURAL HUMAN FLUENCY. STRICTLY ADHERE TO FACTUAL LYRICS IF A SPECIFIC SONG/BHAJAN IS REQUESTED. NO REPETITION LOOPS.]\n\n` + contextualPrompt;
    }

    if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
        const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (<@${u.id}>)`).join(', ');
        contextualPrompt += `\n\n[SYSTEM CONTEXT: Mentioned users: ${mentionsInfo}.]`;
    }
    
    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);

    // 🚀 FIXED: Passes 'modelSets' properly to modelRouter
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      modelSets: modelSets,
    });

    let rawText = '';
    try {
      rawText = result.response.text();
    } catch (extractError) {
      console.warn('⚠️ [GEMINI] Failed to extract text:', extractError.message);
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
      text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸",
      modelUsed: 'fallback',
      debug: { intent: 'error', tier: 'standard', error: error.message }
    };
  }
}

module.exports = { generateContent };
