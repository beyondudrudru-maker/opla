require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore'); 
const decisionPipeline = require('../decision/decisionPipeline');
const styleLinter = require('../postProcessor/styleLinter');

/**
 * api/gemini.js (Now Powered by Groq AI)
 *
 * PURPOSE
 *   Modular entrypoint connecting Groq (Llama 3.1) to the decision pipeline.
 *   Replaces the complex Gemini Multi-Key router with a lightning-fast, stable endpoint.
 */

// Initialize the client pointing to Groq's free endpoint
const aiClient = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.opla // 🔑 Using your specific Render environment variable!
});

/**
 * Generates dynamic, human-like responses using Groq AI.
 */
async function generateContent(turn) {
  // 1. Empty Input Check
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return {
      text: "I didn't quite catch that! Could you repeat?",
      modelUsed: 'none',
      debug: { error: 'Empty input' },
    };
  }

  // 2. API Key Check
  if (!process.env.opla) {
    return {
      text: "I'm feeling a bit disconnected from my brain right now! (My Groq API key is missing).",
      modelUsed: 'fallback',
      debug: { error: 'No API keys' },
    };
  }

  try {
    // 3. Build Core Persona Identity
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

    // 4. Smart Context & Tagging
    let contextualPrompt = turn.content;
    
    // Tag long-form or complex prompts
    const complexTaskKeywords = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics|translate|summary|how to|bhajan|song/i;
    if (complexTaskKeywords.test(turn.content) || turn.content.length > 100) {
        contextualPrompt = `[SYSTEM DIRECTIVE: EXECUTE WITH MAXIMUM PRECISION AND NATURAL HUMAN FLUENCY. STRICTLY ADHERE TO FACTUAL LYRICS IF A SPECIFIC SONG/BHAJAN IS REQUESTED. NO REPETITION LOOPS.]\n\n` + contextualPrompt;
    }

    // Embed Mentioned Users
    if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
        const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (<@${u.id}>)`).join(', ');
        contextualPrompt += `\n\n[SYSTEM CONTEXT: Mentioned users: ${mentionsInfo}.]`;
    }
    
    const smartTurn = { ...turn, content: contextualPrompt };
    
    // Plan turn routing
    const plan = await decisionPipeline.planTurn(smartTurn);

    // 🚀 5. Execute API Call to Groq
    const completion = await aiClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: dynamicIdentity },
        { role: "user", content: plan.prompt || contextualPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    let rawText = completion.choices[0].message.content;
    
    // 6. Process response through style linter
    const { text } = styleLinter.process({
      channelId: turn.channelId,
      responseText: rawText,
      emojiBudget: plan.behaviorDirective?.emojiBudget || 'medium',
    });

    // 7. Save state to database
    try {
      await decisionPipeline.finalizeTurn({
        channelId: turn.channelId,
        userId: turn.userId,
        content: turn.content,
        responseText: text,
      });
    } catch (dbError) {
      console.error('⚠️ [DB] Database finalizeTurn warning:', dbError.message);
    }

    return {
      text,
      modelUsed: "Groq-Llama-3.1",
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
