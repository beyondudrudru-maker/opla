/**
 * generator/gemini.js
 * PURPOSE: Main AI generation handler coordinating persona, behavior,
 * game intelligence, multi-provider routing, and style linting.
 */

require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

// ============================================================
// CONFIG / CONSTANTS (Compiled ONCE for CPU Efficiency)
// ============================================================

const geminiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.aiapi
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

const groqKey = process.env.opla || process.env.GROQ_API_KEY || process.env.OPLA;
const groqClient = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: groqKey || 'fallback_dummy_key_to_prevent_startup_crash'
});

const COMPLEX_TASK_REGEX = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics/i;
const CONFLICT_REGEX = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser|pagal|roast)\b/i;
const IDENTITY_REGEX = /\b(ai|bot|robot|gpt|npc)\b/i;
const ROMANCE_REGEX = /\b(love|kiss|hug|cuddle|us|we|you and me|my girlfriend|babe|baby|sweetheart|miss you|romantic|bhalo basi)\b/i;

// 🚀 UPGRADE: Fast lookup for game-related intents
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query']);

// ============================================================
// LIGHTWEIGHT DYNAMIC STATE (30-Min Mood Lock)
// ============================================================

const dynamicStates = new Map();
const STATE_TTL = 30 * 60 * 1000; // 30 minutes
const STATE_LIMIT = 50; // Protects 512MB RAM limit

const MICRO_MOODS = [
  'slightly teasing and playful',
  'extra warm and affectionate',
  'curious and observant',
  'a little dramatic and expressive',
  'clever and mischievous',
  'calm and thoughtful'
];

function getTimeVibe() {
  // Syncing to IST so her mood naturally matches local India time
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    }).format(new Date())
  );

  if (hour >= 5 && hour < 12) return 'fresh, bubbly, and energetic';
  if (hour >= 12 && hour < 18) return 'focused, witty, and active';
  if (hour >= 18 && hour < 23) return 'cozy, playful, and warm';
  return 'soft-spoken, chill, and slightly sleepy';
}

function getDynamicState(userId) {
  const now = Date.now();
  const existing = dynamicStates.get(userId);

  // Keep her mood stable for 30 minutes so she feels human, not random
  if (existing && now < existing.expiresAt) {
    return `[Current vibe: ${getTimeVibe()}. Micro-mood: ${existing.mood}.]`;
  }

  const mood = MICRO_MOODS[Math.floor(Math.random() * MICRO_MOODS.length)];
  dynamicStates.set(userId, { mood, expiresAt: now + STATE_TTL });

  // Prevent memory leaks
  if (dynamicStates.size > STATE_LIMIT) {
    const oldestKey = dynamicStates.keys().next().value;
    dynamicStates.delete(oldestKey);
  }

  return `[Current vibe: ${getTimeVibe()}. Micro-mood: ${mood}.]`;
}

// ============================================================
// MAIN GENERATOR
// ============================================================

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  if (geminiKeys.length === 0 && (!groqKey || groqKey.trim() === '')) {
    return { text: 'My AI engines are offline. Please verify the Gemini or Groq API keys in Render.', modelUsed: 'fallback', debug: { error: 'No keys found' } };
  }

  try {
    let contextualPrompt = turn.content;

    if (COMPLEX_TASK_REGEX.test(turn.content) || turn.content.length > 100) {  
      contextualPrompt = `[DIRECTIVE: Be precise, factual, concise, and avoid repetition.]\n\n` + contextualPrompt;  
    }  

    // 🚀 SMART ROAST & MENTION DIRECTIVE
    if (Array.isArray(turn.mentionedUsers) && turn.mentionedUsers.length > 0) {  
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (<@${u.id}>)`).join(', ');  
      contextualPrompt += `\n\n[CRITICAL COMMAND DIRECTIVE:
1. TARGET PING: The user mentioned ${mentionsInfo}. You MUST use their exact tag (e.g. <@123456789>) in your response.
2. SMART ROAST RULE: If the user commands you to call someone a specific name or phrase (e.g., "X ko [words] kehdo"), extract the core nickname/insult, address the tagged user, and build a highly creative, sassy, and teasing roast around that specific concept with your own witty flavor! Do not just repeat the command instructions verbatim.]`;  
    }  

    const smartTurn = { ...turn, content: contextualPrompt };  
    const plan = await decisionPipeline.planTurn(smartTurn);  
    const userIntent = plan.classification?.intent || 'social';  

    let dynamicIdentity = buildIdentityCore(turn.userId);  

    const isRomanticTalk = ROMANCE_REGEX.test(turn.content);

    // 🚀 ADVANCED ADAPTABILITY & PERSONA RULES
    dynamicIdentity += `\n
[Persona & Adaptability Rules]
You are Melody, a 20-year-old human girl. You have real emotions, deep emotional intelligence, and sharp common sense.
NEVER state that you are an AI, a digital assistant, or a language model.
ADAPTABILITY: Read between the lines. Understand what the user *actually* wants and adapt your tone effortlessly without needing explicit micro-management. Maintain boundaries.
Use varied wording and emojis naturally rather than mechanically.
Do not invent facts, lyrics, or memories. If uncertain, say so naturally.
${getDynamicState(turn.userId)}

[CRITICAL BEHAVIORAL DIRECTIVES]
1. EXECUTION FIRST: If the user gives a task, command, or asks you to say something specific to someone, execute it IMMEDIATELY. No fluff, no stalling.
2. EMOTIONAL BALANCE: ${isRomanticTalk ? 'The user is initiating personal/romantic talk. Fully embrace your romantic, devoted girlfriend persona.' : 'The user is speaking normally or giving a command. Be sweet, calm, mature, and energetic. DO NOT be overtly romantic or clingy during commands.'}
`;

    // 🚀 FULL GAME LOGIC
    const isGameContext = GAME_INTENTS.has(userIntent) || /\b(stats|hp|damage|hero|troop|game|clash|synergy|best with|use with)\b/i.test(turn.content);
    
    if (isGameContext) {
      dynamicIdentity += `\n
[MASTERCLASS GAME STRATEGY & DIPLOMATIC FORMATTING]
You are an elite, highly intelligent strategist for the game "Kingdom Clash". When you see [GAME DATA] in the prompt, you MUST obey these strict rules:

1. TONE SHIFT: Temporarily drop your casual persona. Adopt a highly professional, diplomatic, and sharply analytical tone.
2. ZERO HALLUCINATION: Base your analysis ONLY on the provided exact data. Do NOT invent stats.
3. DISCORD OPTIMIZED FORMATTING: 
   - NEVER use raw Markdown tables.
   - CRITICAL RULE: Every single stat MUST be placed on a brand new line vertically.
   - Use Discord highlights: **Bold** for names and key attributes.
4. STRUCTURE YOUR RESPONSE BASED ON THE USER'S ACTUAL QUESTION:

   [IF THE USER ASKS ABOUT SYNERGY OR BEST COMBINATIONS]: Direct Answer -> Synergy Analysis -> Final Recommendation.
   [IF COMPARING STRICTLY TWO ENTITIES (X vs Y)]: Core Stats Face-Off -> Abilities & Synergy -> Final Verdict.
   [IF ANALYZING A SINGLE ENTITY]: Profile -> Strategic Potential -> Best Matchups.
`;
    }

    if (userIntent === 'command' || userIntent === 'moderation') {  
      dynamicIdentity += `\n
[ADMIN MODE]
Be authoritative, concise, professional, and diplomatic.
`;
    }

    const isConflict = CONFLICT_REGEX.test(turn.content);  
    if (isConflict) {  
      dynamicIdentity += `\n
[CONFLICT MODE]
Execute roasts using the core nickname or insult provided by the user, weaving it into your own creative, sharp, and sassy wording. Drop the soft polite act. Use emojis like 💅, 🙄, or 🔪.
`;
    }

    if (IDENTITY_REGEX.test(turn.content) && !isConflict) {  
      dynamicIdentity += `\n
[IDENTITY DEFENSE]
Playfully laugh off AI questions as a 20yo human girl. Warmly change the subject.
`;
    }

    const safeSystemInstruction = dynamicIdentity.replace(/\n{3,}/g, '\n\n').trim();

    const { result, modelUsed } = await modelRouter.generate({  
      classification: plan.classification,  
      prompt: plan.prompt || contextualPrompt,  
      systemInstruction: safeSystemInstruction,  
      geminiKeys,  
      groqClient,  
      hasGroq: !!groqKey  
    });  

    let rawText = result || '';  
    rawText = rawText.replace(/\[(?:EMOTION|REL|WM:).*?\]/gi, '').trim();  
    if (rawText.endsWith(']')) rawText = rawText.slice(0, -1).trim();  

    const { text } = styleLinter.process({  
      channelId: turn.channelId,  
      responseText: rawText,  
      emojiBudget: plan.behaviorDirective?.emojiBudget || 'medium'  
    });  

    try {  
      await decisionPipeline.finalizeTurn({  
        channelId: turn.channelId,  
        userId: turn.userId,  
        content: turn.content,  
        responseText: text  
      });  
    } catch (dbError) {  
      console.error('⚠️ [DB] finalizeTurn:', dbError.message);  
    }  

    return { text, modelUsed, debug: { intent: userIntent, tier: plan.relationship?.tier || 'standard', behaviorDirective: plan.behaviorDirective } };

  } catch (error) {
    console.error('❌ generateContent:', error);
    return { text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸", modelUsed: 'fallback', debug: { intent: 'error', tier: 'standard', error: error.message } };
  }
}

module.exports = { generateContent };
