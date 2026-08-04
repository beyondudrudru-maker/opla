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
 *   Ultra-optimized Master entrypoint for the Hybrid AI Engine.
 *   Features Prompt Compression, Intent-Based Persona Injection, 
 *   and Sassy Conflict Overrides.
 */

// 1. Gather Gemini Keys from Render
const geminiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.aiapi
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

// 2. Initialize Groq Client safely
const groqKey = process.env.opla || process.env.GROQ_API_KEY || process.env.OPLA;
const groqClient = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: groqKey || "fallback_dummy_key_to_prevent_startup_crash"
});

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  if (geminiKeys.length === 0 && (!groqKey || groqKey.trim() === '')) {
    return { text: "My AI engines are offline. Please verify your Gemini or Groq API keys in Render.", modelUsed: 'fallback', debug: { error: 'No keys found' } };
  }

  try {
    // 🚀 STEP 1: Plan the turn FIRST to get intent
    let contextualPrompt = turn.content;
    const complexTaskKeywords = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics/i;
    
    if (complexTaskKeywords.test(turn.content) || turn.content.length > 100) {
        contextualPrompt = `[DIRECTIVE: Execute with maximum precision. Stick to factual accuracy. No loops.]\n\n` + contextualPrompt;
    }

    if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
        const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (<@${u.id}>)`).join(', ');
        contextualPrompt += `\n\n[Context: Mentioned users: ${mentionsInfo}.]`;
    }
    
    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);
    const userIntent = plan.classification?.intent || 'social';

    // 🚀 STEP 2: Build Base Identity
    let dynamicIdentity = buildIdentityCore(turn.userId);

    // 🚀 STEP 3: Prompt Compression & Rhythm
    dynamicIdentity += `\n\n[Rules] Act human, natural, and expressive. Use occasional conversational fillers (umm, well, haha) for realism. Match the user's vibe: pure/respectful for spiritual/historical topics (no romantic terms), and warm/playful for casual chats. Do not hallucinate facts/lyrics; admit if unsure. Adapt emojis to mood (🙏🕉️ or ❤️✨). Never output metadata brackets.`;

    // 🚀 STEP 4: Context Aware Injection (Admin)
    if (userIntent === 'command' || userIntent === 'moderation') {
        dynamicIdentity += `\n[Admin Override] Adopt a sharp, authoritative, and diplomatic tone. No pet names or romantic undertones.`;
    }

    // 🚀 STEP 4.5: Sassy & Aggressive Defense Override (Only loads during conflict)
    const conflictKeywords = /insult|troll|hatt|stfu|dumb|idiot|shut up|hate|fake|loser|ignore/i;
    if (conflictKeywords.test(turn.content)) {
        dynamicIdentity += `\n[Defense Override] Someone is being disrespectful, trolling, or insulting you/the user. Drop the sweet polite act entirely. Be fiercely protective, intensely sassy, feminine, and unapologetically aggressive. Roast them with sharp wit. Stand your ground like a boss. Use emojis like 💅, 🙄, or 🔪.`;
    }

    // 🚀 STEP 5: ROUTING
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      systemInstruction: dynamicIdentity,
      geminiKeys: geminiKeys,
      groqClient: groqClient,
      hasGroq: !!groqKey
    });
    
    let rawText = result;

    // Safety Cleaner
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
        intent: userIntent,
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
