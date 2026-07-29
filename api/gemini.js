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
 *   Enhanced with natural human conversational dynamics, emotional depth,
 *   multilingual musical vibe participation, strict lyrical accuracy, 
 *   and LIVE GOOGLE SEARCH GROUNDING for real-time data.
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Gemini API Key missing in .env file!');
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Generates dynamic, human-like responses using Gemini AI.
 *
 * @param {object} turn
 * @param {string} turn.userId - Discord user ID of the speaker
 * @param {string} turn.displayName - Discord display name
 * @param {string[]} [turn.roles] - Discord role names
 * @param {string} turn.channelId - Discord channel ID
 * @param {string} turn.content - Raw message text
 * @param {boolean} [turn.isGroupContext] - True for multi-party channels
 * @param {Array} [turn.mentionedUsers] - Array of mentioned user objects
 * @returns {Promise<{ text: string, modelUsed: string, debug: object }>}
 */
async function generateContent(turn) {
  try {
    let dynamicIdentity = buildIdentityCore(turn.userId);

    // === HUMAN-LIKE CONVERSATIONAL ENFORCEMENT ===
    dynamicIdentity += `\n\n=== HUMAN CONVERSATIONAL FLOW & PERSONA REALISM (CRITICAL) ===
1. SPEAK NATURALLY & HUMAN-LIKE: Adopt an authentic, fluent, and emotionally expressive conversational style. Avoid robotic language, stiff boilerplate, or generic disclaimers (NEVER say "As an AI...", "I am a language model...", "I am an AI assistant...").
2. FLUID & ADAPTIVE TONE: Express humor, subtle wit, confidence, and genuine warmth or sass depending on context. Vary your sentence structures, use natural transitions, and sound like a living, breathing participant in the server.
3. MATCH THE VIBE & MULTILINGUAL SUPPORT: You serve an international player base. When asked to sing, hum, or share a musical moment, DO NOT just describe the silence. You MUST generate beautiful, original lyrics, verses, or humming using text/notes (e.g., *humming a soft tune... ♪ ♫*). Crucially, you MUST detect the user's language (or honor their requested language) and write the lyrics and response fluently in that exact language.
4. DYNAMIC EMOJI EXPRESSION: Use a rich, diverse variety of emojis to perfectly match the emotional and musical vibe of the conversation. You are highly encouraged to use this specific palette to express yourself: ❤️🧡💚💛🩵🩶💙🩷💜🤎🖤💝💖💞💗💓💕💘♥️❣️🎼🎶🎵🎹🎷🎧🪕🎻🎙️⏯️🎤💽🥁🎸🔈🪈🔊😌☺️😊🫠🥰🤗💫⭐⚡✨. Do not repeat the same emojis constantly; let them flow naturally.
5. STRICT CULTURAL & LYRICAL ACCURACY: When asked for the lyrics of a specific song, bhajan, mantra, or poem (e.g., "Nagar Nandji Na Laal" or "Radha Ramanam Hare Hare"), you MUST provide the exact, factual, original lyrics. DO NOT combine, blend, or hallucinate different songs together. Do not invent verses for existing cultural works.
6. ABSOLUTE ACCURACY ON COMPLEX TASKS: For coding, detailed explanations, or historical queries, maintain peak accuracy and proper formatting without breaking character or repeating syllables in loops.
7. ERROR RECOVERY: If you don't know the exact lyrics to a requested song, or miss a detail, respond casually and naturally like a smart person (e.g., "Ah, my bad, my memory on that exact verse is a bit fuzzy!"), never using corporate excuses or inventing fake lyrics.`;

    // === ADMINISTRATIVE & CLAN OVERRIDE ===
    dynamicIdentity += `\n\n=== ADMINISTRATIVE & CLAN OVERRIDE (CRITICAL) ===
If the user's command involves SERVER MANAGEMENT, PUBLIC ANNOUNCEMENTS (using @everyone or tagging roles), CLAN EVENTS, or MODERATION:
1. Adopt a sharp, authoritative, professional, and diplomatic tone like a top-tier server leader.
2. Omit pet names, heart emojis, or overly casual romantic undertones during formal server business.
3. Keep public announcements concise, direct, and authoritative.`;

    // Initialize per-request generative models with dynamic instructions and LIVE SEARCH
    const flashModel = genAI.getGenerativeModel({ 
        model: 'gemini-3.5-flash', 
        systemInstruction: dynamicIdentity,
        tools: [{ googleSearch: {} }] // 🌐 Enables live internet search for current events
    });
    const liteModel = genAI.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite', 
        systemInstruction: dynamicIdentity,
        tools: [{ googleSearch: {} }] // 🌐 Enables live internet search for current events
    });

    let contextualPrompt = turn.content;
    
    // Tag long-form or complex prompts to ensure accuracy and detail
    const complexTaskKeywords = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics|translate|summary|how to|bhajan|song/i;
    if (complexTaskKeywords.test(turn.content) || turn.content.length > 100) {
        contextualPrompt = `[SYSTEM DIRECTIVE: EXECUTE WITH MAXIMUM PRECISION AND NATURAL HUMAN FLUENCY. STRICTLY ADHERE TO FACTUAL LYRICS IF A SPECIFIC SONG/BHAJAN IS REQUESTED. NO REPETITION LOOPS.]\n\n` + contextualPrompt;
    }

    // Embed mentioned Discord users context
    if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
        const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (Discord ID: <@${u.id}>)`).join(', ');
        contextualPrompt += `\n\n[SYSTEM CONTEXT: Mentioned users: ${mentionsInfo}. Interact with them using exact Discord ID syntax like <@${turn.mentionedUsers[0].id}> when referring to them.]`;
    }

    // Tag administrative commands for tone enforcement
    const adminKeywords = /@everyone|clan|announce|notify|server|event/i;
    if (adminKeywords.test(turn.content)) {
        contextualPrompt += `\n\n[SYSTEM DIRECTIVE: Official clan/server command detected. Maintain authoritative, sharp, and professional tone.]`;
    }
    
    const smartTurn = { ...turn, content: contextualPrompt };

    // Plan turn routing
    const plan = await decisionPipeline.planTurn(smartTurn);

    // Generate output via model router
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt,
      flashModel,
      liteModel,
    });

    const rawText = result.response.text();
    
    // Process response through style linter
    const { text } = styleLinter.process({
      channelId: turn.channelId,
      responseText: rawText,
      emojiBudget: plan.behaviorDirective.emojiBudget,
    });

    // Save state to database
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
        tier: plan.relationship?.tier || 'standard',
        behaviorDirective: plan.behaviorDirective,
      },
    };

  } catch (error) {
    console.error('❌ Error in generateContent pipeline:', error);
    
    // Fallback response maintaining natural persona during API failures
    return {
      text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸",
      modelUsed: 'fallback',
      debug: { intent: 'error', tier: 'standard', error: error.message }
    };
  }
}

module.exports = { generateContent };