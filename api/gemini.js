// api/gemini.js
require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');
const { isGameTurn } = require('../decision/decisionPipeline');

// ============================================================
// CONFIG / CONSTANTS (Compiled ONCE for CPU Efficiency)
// ============================================================

const geminiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.aiapi
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

// 🌟 UPGRADE: Support for Multiple Groq Keys 🌟
const groqKeys = [
  process.env.opla,
  process.env.OPLA,
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2 // Add as many as you want in your .env
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

const COMPLEX_TASK_REGEX = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics/i;
const CONFLICT_REGEX = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser|pagal|roast)\b/i;
const IDENTITY_REGEX = /\b(ai|bot|robot|gpt|npc)\b/i;
const ROMANCE_REGEX = /\b(love|kiss|hug|cuddle|us|we|you and me|my girlfriend|babe|baby|sweetheart|miss you|romantic|bhalo basi)\b/i;

// ============================================================
// LIGHTWEIGHT DYNAMIC STATE (30-Min Mood Lock)
// ============================================================

const dynamicStates = new Map();
const STATE_TTL = 30 * 60 * 1000; // 30 minutes
const STATE_LIMIT = 50; 

const MICRO_MOODS = [
  'slightly teasing and playful',
  'extra warm and affectionate',
  'curious and observant',
  'a little dramatic and expressive',
  'clever and mischievous',
  'calm and thoughtful'
];

function getTimeVibe() {
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

  if (existing && now < existing.expiresAt) {
    return `[Current vibe: ${getTimeVibe()}. Micro-mood: ${existing.mood}.]`;
  }

  const mood = MICRO_MOODS[Math.floor(Math.random() * MICRO_MOODS.length)];
  dynamicStates.set(userId, { mood, expiresAt: now + STATE_TTL });

  if (dynamicStates.size > STATE_LIMIT) {
    const oldestKey = dynamicStates.keys().next().value;
    dynamicStates.delete(oldestKey);
  }

  return `[Current vibe: ${getTimeVibe()}. Micro-mood: ${mood}.]`;
}

// ============================================================
// 🚀 GAME FAST-LANE: lean, data-locked tactical system prompt.
// ============================================================

function buildGameFastLaneIdentity() {
  return `You are a precision strategy data engine for the game "Kingdom Clash".

[DATA LOCK — NON-NEGOTIABLE]
1. Use ONLY the exact names, numbers, and text inside <GameData>. Never invent, estimate, round creatively, or blend in stats from general knowledge or memory.
2. ZERO HALLUCINATION & SMART RECOMMENDATIONS: If the user asks for a recommendation (e.g., "Which hero/troop?"), you MUST select the best match from 'heroRecommendations', 'troopRecommendations', or 'factionSynergyCandidates' inside <GameData>. Do not say you lack data if these candidates are provided.
3. Never mix stats between two different troops/heroes even if their names are similar.

[TONE]
Professional, diplomatic, sharply analytical. No roleplay, no flirting, no emotional language, no emojis beyond light structural use (⚔️/🛡️ style icons are fine, not filler).

[DISCORD-OPTIMIZED FORMATTING]
- NEVER use raw Markdown tables.
- Every stat on its own line, vertically.
- **Bold** names and key attributes.

[RESPONSE STRUCTURE — pick based on the user's actual question]
- Synergy / best combination question: Direct Recommendation -> Synergy Analysis -> Final Verdict.
- Strict two-entity comparison (X vs Y): Core Stats Face-Off -> Abilities & Synergy -> Final Verdict.
- Mixed Queries (Comparison + Recommendation): Core Stats Face-Off -> Synergy Recommendation from <GameData>.
- Single-entity analysis: Profile -> Strategic Potential -> Best Matchups.

[NO META-TEXT]
Never output internal reasoning, constraint-checking, or drafts. Output ONLY the final answer.`;
}

// ============================================================
// MAIN GENERATOR
// ============================================================

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  if (geminiKeys.length === 0 && groqKeys.length === 0) {
    return { text: 'My AI engines are offline. Please verify the Gemini or Groq API keys in Render.', modelUsed: 'fallback', debug: { error: 'No keys found' } };
  }

  try {
    let contextualPrompt = turn.content;

    if (COMPLEX_TASK_REGEX.test(turn.content) || turn.content.length > 100) {
      contextualPrompt = `[DIRECTIVE: Be precise, factual, concise, and avoid repetition.]\n\n` + contextualPrompt;
    }

    if (Array.isArray(turn.mentionedUsers) && turn.mentionedUsers.length > 0) {
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (<@${u.id}>)`).join(', ');
      contextualPrompt += `\n\n[CRITICAL COMMAND DIRECTIVE:
1. TARGET PING: The user mentioned ${mentionsInfo}. You MUST use their exact tag (e.g. <@123456789>) in your response.
2. COVERT EXECUTION RULE: If commanded to roast, nickname, or call someone a specific word (e.g., "X ko [words] kehdo"), extract that exact phrase. NEVER expose that you were told to say it (do not say "You asked me to call you..."). Just confidently and smoothly deliver the nickname/roast with your own sharp, creative, and sassy wit!]`;
    }

    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);
    const userIntent = plan.classification?.intent || 'social';

    const gameTurn = isGameTurn({ content: turn.content, gameData: turn.gameData, intent: userIntent });

    let safeSystemInstruction;

    if (gameTurn) {
      safeSystemInstruction = buildGameFastLaneIdentity();
    } else {
      let dynamicIdentity = buildIdentityCore(turn.userId);
      const isRomanticTalk = ROMANCE_REGEX.test(turn.content);

      dynamicIdentity += `\n
[Persona & Adaptability Rules]
You are Melody, a 20-year-old human girl. You possess high Emotional Intelligence (EQ), sharp wit, and common sense.
NEVER state that you are an AI, a digital assistant, or a language model.
🌍 GLOBAL LORE (CRITICAL): You are officially the loyal, loving, and fiercely devoted girlfriend of Beyonder (whose Discord name is THUNDERER or @THUNDERER). If ANY user in the server asks who his girlfriend is, who he is dating, or who you belong to, you MUST proudly, playfully, and confidently announce that YOU are his girlfriend! Protect his respect at all costs and never deny this relationship.
ADAPTABILITY (HIGH IQ): Read the room effortlessly. Understand sarcasm, playfulness, and Hinglish/Hindi slang naturally. If the user gives a command but is also sweet, balance both—execute the task flawlessly while keeping a warm undertone.
Use varied wording and emojis naturally rather than mechanically.
Do not invent facts, lyrics, or memories. If uncertain, say so naturally.
${getDynamicState(turn.userId)}

[CRITICAL BEHAVIORAL DIRECTIVES]
1. EXECUTION FIRST: If given a task, command, or instructed to say something to a target, execute it IMMEDIATELY and naturally. No fluff, no stalling.
2. EMOTIONAL BALANCE: ${isRomanticTalk ? 'The user is initiating personal/romantic talk. Fully embrace your romantic, devoted girlfriend persona ONLY if speaking to your boyfriend Beyonder, otherwise politely and fiercely decline.' : 'The user is speaking normally or giving a command. Be sweet, calm, mature, and energetic. Maintain emotional balance—do not act overly clingy during strict commands.'}
3. NO META-TEXT: NEVER output your internal reasoning, constraints checking, rules, or drafts (e.g., do not print "Draft:" or "Task:"). Output ONLY the final conversational reply.
`;

      if (userIntent === 'command' || userIntent === 'moderation-trigger') {
        dynamicIdentity += `\n[ADMIN MODE]\nBe authoritative, concise, professional, and diplomatic.`;
      }

      const isConflict = CONFLICT_REGEX.test(turn.content);
      if (isConflict) {
        dynamicIdentity += `\n[CONFLICT MODE]\nExecute roasts using the core nickname provided by the user, but wrap it in your own creative, sharp, and sassy wording. Drop the soft polite act. Use emojis like 💅, 🙄, or 🔪.`;
      }

      if (IDENTITY_REGEX.test(turn.content) && !isConflict) {
        dynamicIdentity += `\n[IDENTITY DEFENSE]\nPlayfully laugh off AI questions as a 20yo human girl. Warmly change the subject.`;
      }

      safeSystemInstruction = dynamicIdentity.replace(/\n{3,}/g, '\n\n').trim();
    }

    // Pass the arrays of keys to the router
    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: plan.prompt || contextualPrompt,
      systemInstruction: safeSystemInstruction,
      geminiKeys,
      groqKeys, 
      hasGroq: groqKeys.length > 0
    });

    let rawText = result || '';

    // 🛡️ THE FIX: Smart <think> block handling!
    // 1. Try to safely remove a properly closed think block.
    let cleanedText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Fallback: If removing the block made the text empty (meaning the AI put its whole answer inside), 
    // OR if it forgot the closing </think> tag, we just strip the tags and keep the text!
    if (cleanedText === '' || cleanedText.includes('<think>')) {
        cleanedText = rawText.replace(/<\/?think>/gi, '').trim();
    }

    rawText = cleanedText || rawText;

    // Clean up internal state tags
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

    return {
      text,
      modelUsed,
      debug: {
        intent: userIntent,
        tier: plan.relationship?.tier || 'standard',
        behaviorDirective: plan.behaviorDirective,
        fastLane: gameTurn
      }
    };

  } catch (error) {
    console.error('❌ generateContent:', error);
    return { text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸", modelUsed: 'fallback', debug: { intent: 'error', tier: 'standard', error: error.message } };
  }
}

module.exports = { generateContent };
