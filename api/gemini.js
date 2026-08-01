require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore'); 
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

/**
 * api/gemini.js
 *
 * PURPOSE
 *   Modular entrypoint connecting Groq AI to the decision pipeline.
 */

function getApiKey() {
  const key = process.env.opla || process.env.GROQ_API_KEY || process.env.OPLA;
  return (key && typeof key === 'string' && key.trim().length > 0) ? key.trim() : null;
}

const activeApiKey = getApiKey();
const aiClient = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: activeApiKey || "fallback_dummy_key_to_prevent_startup_crash"
});

async function generateContent(turn) {
  const currentKey = getApiKey();

  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  if (!currentKey) {
    return { text: "My AI engine is offline. Please verify that the environment variable 'opla' is configured correctly in Render.", modelUsed: 'fallback', debug: { error: 'Missing or empty Groq API key' } };
  }

  try {
    let dynamicIdentity = buildIdentityCore(turn.userId);

    // 🛡️ UPDATED PROMPT: Added Vibe Checks for Spiritual topics and Anti-Hallucination for lyrics
    dynamicIdentity += `\n\n=== HUMAN CONVERSATIONAL FLOW & PERSONA REALISM (CRITICAL) ===
1. SPEAK NATURALLY & HUMAN-LIKE: Adopt an authentic, fluent, and emotionally expressive conversational style. 
2. VIBE & CONTEXT MATCHING (CRITICAL): Adapt your tone perfectly to the user's prompt. If they are playful, be playful. HOWEVER, if the user mentions Gods, Bhajans, Mantras, or spiritual/historical topics (e.g., Ram, Shiva, Mahabharat), YOU MUST immediately drop all romantic, flirty, or casual tones (no 'sweetie' or 'babe'). Adopt a pure, highly respectful, and devoted tone.
3. ANTI-HALLUCINATION FOR LYRICS & FACTS: If asked for a specific song, bhajan, or mantra, provide the exact factual lyrics ONLY if you know them 100%. If you do not know the exact words, DO NOT make up fake lyrics. Instead, respectfully admit you don't remember the full lyrics and kindly ask the user to share them with you.
4. DYNAMIC EMOJI EXPRESSION: Use a rich, diverse variety of emojis, but keep them appropriate to the vibe (use 🙏🕉️✨ for spiritual topics, ❤️✨ for social).
5. STRICT TOPIC BOUNDARIES: Stay exactly on topic. If asked to welcome a user, greet them briefly and warmly. DO NOT ramble, over-explain, or bring up unrelated vocabulary lessons.
6. NO METADATA IN OUTPUT: You MUST NOT output any internal tracking tags, bracketed variables, or thought processes (e.g., [EMOTION:...], [REL:...]). ONLY output the final conversational text meant for the user.`;

    dynamicIdentity += `\n\n=== ADMINISTRATIVE & CLAN OVERRIDE (CRITICAL) ===
If the user's command involves SERVER MANAGEMENT, PUBLIC ANNOUNCEMENTS, CLAN EVENTS, or MODERATION:
1. Adopt a sharp, authoritative, professional, and diplomatic tone.
2. Omit pet names, heart emojis, or overly casual romantic undertones.`;

    let contextualPrompt = turn.content;
    
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

    // 💡 Optional future upgrade: If you want her to be even smarter, you can change "llama-3.1-8b-instant" 
    // to "llama-3.3-70b-versatile" inside your router/modelRouter.js file later!
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      systemInstruction: dynamicIdentity,
      aiClient: aiClient
    });
    
    let rawText = result;

    // 🛡️ SAFETY CLEANER: Strip internal metadata tags
    rawText = rawText.replace(/\[EMOTION.*?\]/gi, ''); 
    rawText = rawText.replace(/\[REL.*?\]/gi, '');     
    rawText = rawText.replace(/\[WM:.*?\|\s*M:/gi, ''); 
    rawText = rawText.trim();
    if (rawText.endsWith(']')) {
        rawText = rawText.slice(0, -1); 
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
      console.error('⚠️ [DB] Database finalizeTurn warning:', dbError.message);
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
