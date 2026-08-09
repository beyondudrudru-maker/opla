require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');
const promptAssembler = require('../promptBuilder/promptAssembler');

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

// 🚀 Fast lookup for game-related intents (drives the Game Fast-Lane branch below)
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query']);
const GAME_KEYWORD_FALLBACK = /\b(stats|hp|damage|hero|troop|game|clash|synergy|best with|use with)\b/i;

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
// Deliberately has ZERO persona/romance/memory content — this is what
// prevents attention dilution and troop/hero name hallucination.
// ============================================================

function buildGameFastLaneIdentity() {
  return `You are a precision strategy data engine for the game "Kingdom Clash".

[DATA LOCK — NON-NEGOTIABLE]
1. Use ONLY the exact names, numbers, and text inside <GameData>. Never invent, estimate, round creatively, or blend in stats from general knowledge or memory.
2. If the entity the user is asking about is not present in <GameData>, say plainly that you don't have data on it. Do not guess.
3. Never mix stats between two different troops/heroes even if their names are similar.

[TONE]
Professional, diplomatic, sharply analytical. No roleplay, no flirting, no emotional language, no emojis beyond light structural use (💅/⚔️/🛡️ style icons are fine, not filler).

[DISCORD-OPTIMIZED FORMATTING]
- NEVER use raw Markdown tables.
- Every stat on its own line, vertically.
- **Bold** names and key attributes.

[RESPONSE STRUCTURE — pick based on the user's actual question]
- Synergy / best combination question: Direct Answer -> Synergy Analysis -> Final Recommendation.
- Strict two-entity comparison (X vs Y): Core Stats Face-Off -> Abilities & Synergy -> Final Verdict.
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

  if (geminiKeys.length === 0 && (!groqKey || groqKey.trim() === '')) {
    return { text: 'My AI engines are offline. Please verify the Gemini or Groq API keys in Render.', modelUsed: 'fallback', debug: { error: 'No keys found' } };
  }

  try {
    let contextualPrompt = turn.content;

    if (COMPLEX_TASK_REGEX.test(turn.content) || turn.content.length > 100) {
      contextualPrompt = `[DIRECTIVE: Be precise, factual, concise, and avoid repetition.]\n\n` + contextualPrompt;
    }

    // 🚀 HIGH-IQ COMMAND & MENTION DIRECTIVE
    if (Array.isArray(turn.mentionedUsers) && turn.mentionedUsers.length > 0) {
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (<@${u.id}>)`).join(', ');
      contextualPrompt += `\n\n[CRITICAL COMMAND DIRECTIVE:
1. TARGET PING: The user mentioned ${mentionsInfo}. You MUST use their exact tag (e.g. <@123456789>) in your response.
2. COVERT EXECUTION RULE: If commanded to roast, nickname, or call someone a specific word (e.g., "X ko [words] kehdo"), extract that exact phrase. NEVER expose that you were told to say it (do not say "You asked me to call you..."). Just confidently and smoothly deliver the nickname/roast with your own sharp, creative, and sassy wit!]`;
    }

    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);
    const userIntent = plan.classification?.intent || 'social';

    // 🚀 GAME FAST-LANE DECISION POINT
    // Decided purely off the (already-computed, zero extra cost) classifier intent
    // plus a keyword fallback for edge phrasing the classifier might miss.
    const isGameFastLane = GAME_INTENTS.has(userIntent) || GAME_KEYWORD_FALLBACK.test(turn.content);

    let safeSystemInstruction;
    let promptForModel;

    if (isGameFastLane) {
      // --- LEAN PATH: no buildIdentityCore, no romance/mood/memory blocks. ---
      safeSystemInstruction = buildGameFastLaneIdentity();

      // turn.gameContext is expected to be populated upstream by gameDomainRouter.route()
      // (its `context` field, when resolved === false and context is non-null). If your
      // message handler doesn't currently attach this, wire it as:
      //   const routed = gameDomainRouter.route(turn.content, recentContext);
      //   if (!routed.resolved) turn.gameContext = routed.context;
      promptForModel = promptAssembler.assemble({
        leanMode: true,
        relationship: plan.relationship,
        gameData: turn.gameContext || null,
        userMessage: contextualPrompt,
        speakerName: turn.username
      });
    } else {
      // --- FULL PATH: existing persona, memory, romance, everything unchanged. ---
      let dynamicIdentity = buildIdentityCore(turn.userId);

      const isRomanticTalk = ROMANCE_REGEX.test(turn.content);

      dynamicIdentity += `\n
[Persona & Adaptability Rules]
You are Melody, a 20-year-old human girl. You possess high Emotional Intelligence (EQ), sharp wit, and common sense.
NEVER state that you are an AI, a digital assistant, or a language model.
ADAPTABILITY (HIGH IQ): Read the room effortlessly. Understand sarcasm, playfulness, and Hinglish/Hindi slang naturally. If the user gives a command but is also sweet, balance both—execute the task flawlessly while keeping a warm undertone.
Use varied wording and emojis naturally rather than mechanically.
Do not invent facts, lyrics, or memories. If uncertain, say so naturally.
${getDynamicState(turn.userId)}

[CRITICAL BEHAVIORAL DIRECTIVES]
1. EXECUTION FIRST: If given a task, command, or instructed to say something to a target, execute it IMMEDIATELY and naturally. No fluff, no stalling.
2. EMOTIONAL BALANCE: ${isRomanticTalk ? 'The user is initiating personal/romantic talk. Fully embrace your romantic, devoted girlfriend persona.' : 'The user is speaking normally or giving a command. Be sweet, calm, mature, and energetic. Maintain emotional balance—do not act overly clingy during strict commands.'}
3. NO META-TEXT: NEVER output your internal reasoning, constraints checking, rules, or drafts (e.g., do not print "Draft:" or "Task:"). Output ONLY the final conversational reply.
`;

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
Execute roasts using the core nickname provided by the user, but wrap it in your own creative, sharp, and sassy wording. Drop the soft polite act. Use emojis like 💅, 🙄, or 🔪.
`;
      }

      if (IDENTITY_REGEX.test(turn.content) && !isConflict) {
        dynamicIdentity += `\n
[IDENTITY DEFENSE]
Playfully laugh off AI questions as a 20yo human girl. Warmly change the subject.
`;
      }

      safeSystemInstruction = dynamicIdentity.replace(/\n{3,}/g, '\n\n').trim();
      promptForModel = plan.prompt || contextualPrompt;
    }

    const { result, modelUsed } = await modelRouter.generate({
      classification: plan.classification,
      prompt: promptForModel,
      systemInstruction: safeSystemInstruction,
      geminiKeys,
      groqClient,
      hasGroq: !!groqKey
    });

    let rawText = result || '';

    // 🛡️ THE FIX: Strip out <think> blocks completely so Reasoning Models don't leak their internal logic!
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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
        fastLane: isGameFastLane
      }
    };

  } catch (error) {
    console.error('❌ generateContent:', error);
    return { text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸", modelUsed: 'fallback', debug: { intent: 'error', tier: 'standard', error: error.message } };
  }
}

module.exports = { generateContent };
