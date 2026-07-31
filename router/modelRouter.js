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
 *   Initializes full Gen 2 & Gen 3 arsenals for smart token-aware routing.
 */

const key1 = process.env.GEMINI_API_KEY;
const key2 = process.env.aiapi;

const apiKeys = [];
if (key1) apiKeys.push(key1.trim());
if (key2) apiKeys.push(key2.trim());

if (apiKeys.length === 0) {
  console.error('❌ FATAL: No Gemini API Keys found in environment variables!');
}

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
      return { 
          text: "I didn't quite catch that! Could you repeat?", 
          modelUsed: 'none', 
          debug: { error: 'Empty input' } 
      };
  }

  if (apiKeys.length === 0) {
      return { 
          text: "I'm feeling disconnected right now! My API keys are missing. Let my creator know!", 
          modelUsed: 'fallback', 
          debug: { error: 'No API keys' } 
      };
  }

  try {
    let dynamicIdentity = buildIdentityCore(turn.userId);

    dynamicIdentity += `\n\n=== HUMAN CONVERSATIONAL FLOW & PERSONA REALISM (CRITICAL) ===
1. SPEAK NATURALLY & HUMAN-LIKE: Adopt an authentic, fluent, and expressive style. Never say "As an AI..." or "I am a language model...".
2. FLUID & ADAPTIVE TONE: Express humor, subtle wit, and warmth depending on context.
3. STRICT CULTURAL & LYRICAL ACCURACY: Provide exact factual lyrics when asked for specific songs or bhajans.
4. ERROR RECOVERY: If a detail is missing, respond casually like a smart friend.`;

    dynamicIdentity += `\n\n=== ADMINISTRATIVE & CLAN OVERRIDE (CRITICAL) ===
If the command involves SERVER MANAGEMENT or PUBLIC ANNOUNCEMENTS:
1. Adopt a sharp, authoritative, professional tone like a top-tier server leader.
2. Omit casual or romantic undertones during formal server business.`;

    const toolsConfig = { tools: [{ googleSearch: {} }] };
    
    // 🧠 INITIALIZE COMPLETE GEN 2 & GEN 3 MODEL ARSENAL PER KEY
    const modelSets = apiKeys.map(key => {
        const genAI = new GoogleGenerativeAI(key);
        return {
            // Gen 3 Heavy Models
            flash36: genAI.getGenerativeModel({ model: 'gemini-3.6-flash', systemInstruction: dynamicIdentity, ...toolsConfig }),
            flash35: genAI.getGenerativeModel({ model: 'gemini-3.5-flash', systemInstruction: dynamicIdentity, ...toolsConfig }),
            lite31: genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite', systemInstruction: dynamicIdentity, ...toolsConfig }),

            // Gen 2 Light & Workhorse Models
            flash20: genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: dynamicIdentity, ...toolsConfig }),
            lite25: genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: dynamicIdentity, ...toolsConfig }),
            flash15: genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: dynamicIdentity, ...toolsConfig })
        };
    });

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

    // 🚀 EXECUTE ROUTER
    const { result, modelUsed } = await modelRouter.generate({
        classification: plan.classification,
        prompt: plan.prompt || contextualPrompt,
        modelSets: modelSets
    });

    let rawText = "";
    try {
        rawText = result.response.text();
    } catch (extractError) {
        console.warn("⚠️ [GEMINI] Text extraction blocked by safety filter:", extractError.message);
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