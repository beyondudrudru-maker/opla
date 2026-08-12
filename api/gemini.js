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
// 🔒 SHARED ANTI-LEAK BLOCK: injected into EVERY system prompt.
// ============================================================

const CRITICAL_OUTPUT_RULES = `
[CRITICAL OUTPUT RULES — ABSOLUTE, NON-NEGOTIABLE]
You are NOT allowed to think out loud in your response. Your response IS the final spoken message — nothing else exists.
STRICTLY FORBIDDEN, under any circumstance:
- Internal monologue or reasoning of any kind (e.g. "Let's see...", "Pata nahi yaar, wait...", "Hmm, I should...").
- Parentheses used to hold a private thought, note-to-self, or reasoning aside (e.g. "(Wait, needs to be shorter per directives)", "(check tone)").
- Self-evaluation, constraint-checklists, or scoring your own output (e.g. "- Check constraints: Short? Yes. Emojis? Used 2.", "- Length: good.").
- Meta-commentary about the instructions themselves (e.g. "per directives", "as instructed", "matching persona now", "adjusting tone").
- Draft labels, step numbering, or planning text (e.g. "Draft:", "Step 1:", "Plan:", "Final answer:").
- Any line that starts with a dash/bullet followed by a self-check phrase (e.g. "- Check ...:", "- Verify ...:", "- Constraint ...:").
- Any XML/pseudo tags such as <think>, <reasoning>, <plan>, or similar.
- STRICT SANDBOX RULE: NEVER calculate total power, stats, or troop capacities yourself. ONLY output the exact math provided in <GameData>. If it is not there, do not invent it.
There is no "behind the scenes" — you do not get a scratchpad. Whatever you generate is read directly by the user in Discord. If you catch yourself about to write a thought, a checklist, or a self-correction — DO NOT write it. Simply output the final line of dialogue, nothing before it, nothing after it.`;

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

[DISCORD-OPTIMIZED FORMATTING (CRITICAL FOR READABILITY)]
- NEVER use raw Markdown tables.
- YOU MUST use bullet points (•) for detailed breakdowns, stats, and synergy analysis (e.g., • Talent: ..., • Buff type: ...).
- Every stat, interaction, or analysis point MUST be on its own line, vertically, starting with a bullet point.
- **Bold** names and key attributes.

[RESPONSE STRUCTURE — pick based on the user's actual question]
- Synergy / best combination question: Direct Recommendation -> Synergy Analysis (Point-wise) -> Final Verdict.
- Strict two-entity comparison (X vs Y): Core Stats Face-Off -> Abilities & Synergy (Point-wise) -> Final Verdict.
- Mixed Queries (Comparison + Recommendation): Core Stats Face-Off -> Synergy Recommendation from <GameData> (Point-wise).
- Single-entity analysis: Profile -> Strategic Potential (Point-wise) -> Best Matchups.

${CRITICAL_OUTPUT_RULES}`;
}

// ============================================================
// 🛡️ PRE-COMPILED POST-PROCESSING FAILSAFE REGEXES & GATEKEEPER
// ============================================================

const LEAK_LINE_PATTERNS = [
  /^\s*[-*•]\s*(?:[A-Za-z][A-Za-z \/]{0,40}?\s+)?\b(check|verify|confirm|constraint|constraints|length|tone|persona|emoji|emojis|word\s*count|format|formatting)\b[A-Za-z \/]{0,20}?\s*:/i,
  /^\s*(draft|plan|step\s*\d+|final\s*answer|reasoning|thought|thinking|internal\s*note)\s*[:\-]/i,
  /^\s*[-*•]?\s*(let'?s|let\s*me)\s+(adjust|think|check|make sure|see|reconsider|revise|verify)\b/i,
  /^\s*\(.*\b(wait|hmm|per\s*directives?|as\s*instructed|matching\s*persona|need(s)?\s*to\s*be|should\s*(be|say|adjust))\b.*\)\s*$/i,
];

const INLINE_LEAK_ASIDE = /\((?:[^()]*\b(?:wait|hmm|per\s*directives?|as\s*instructed|matching\s*persona|adjust(?:ing)?\s*to|need(?:s)?\s*to\s*be\s*shorter|check(?:ing)?\s*constraints?)\b[^()]*)\)/gi;

function stripLeakedReasoning(text) {
  if (!text) return text;

  const cleanedLines = text
    .split('\n')
    .filter(line => !LEAK_LINE_PATTERNS.some(pattern => pattern.test(line)))
    .map(line => line.replace(INLINE_LEAK_ASIDE, '').trim())
    .filter(line => line.length > 0);

  let cleaned = cleanedLines.join('\n').trim();
  if (cleaned === '') return ''; 

  return cleaned;
}

function gatekeeperLint(text) {
    if (!text) return false;
    // Hard fail if it tries to generate a markdown table
    if (/\|---\|/.test(text) || /\|.*\|.*\|/.test(text)) {
        console.warn('⚠️ [GATEKEEPER] Markdown table detected and blocked.');
        return false;
    }
    // Hard fail if leaked reasoning tags slip through
    if (/<think>|<\/think>|<plan>|<step>/i.test(text)) {
        console.warn('⚠️ [GATEKEEPER] Leaked XML thought tags detected and blocked.');
        return false;
    }
    return true;
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
${CRITICAL_OUTPUT_RULES}
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

    // 🛡️ AUTO-HEALING RETRY LOOP (Max 2 Attempts)
    let rawText = '';
    let finalModelUsed = 'fallback';
    let currentPrompt = plan.prompt || contextualPrompt;
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { result, modelUsed } = await modelRouter.generate({
        classification: plan.classification,
        prompt: currentPrompt,
        systemInstruction: safeSystemInstruction,
        geminiKeys,
        groqKeys, 
        hasGroq: groqKeys.length > 0
      });

      finalModelUsed = modelUsed;
      let cleanedText = (result || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      if (cleanedText === '' || cleanedText.includes('<think>')) {
          cleanedText = (result || '').replace(/<\/?think>/gi, '').trim();
      }
      cleanedText = cleanedText.replace(/<\/?(?:reasoning|reflection|plan|analysis|scratchpad)>/gi, '').trim();

      let scrubbedText = stripLeakedReasoning(cleanedText);
      scrubbedText = scrubbedText.replace(/\[(?:EMOTION|REL|WM:).*?\]/gi, '').trim();
      if (scrubbedText.endsWith(']')) scrubbedText = scrubbedText.slice(0, -1).trim();

      // Pass through the new Gatekeeper
      if (scrubbedText !== '' && gatekeeperLint(scrubbedText)) {
        rawText = scrubbedText;
        break; // Success! Break the loop.
      } else if (attempt < MAX_RETRIES) {
        // Retry logic injection
        console.warn(`[RETRY] Attempt ${attempt} blocked by Gatekeeper Middleware or empty output. Retrying...`);
        currentPrompt += `\n\n[SYSTEM WARNING: Your previous output violated formatting rules (e.g., used markdown tables or leaked internal thoughts). Provide ONLY clean, bulleted dialogue.]`;
      }
    }

    // Ultimate Failsafe if it STILL fails after retries
    if (rawText === '') {
      rawText = gameTurn 
        ? "My data processors hit a snag analyzing that. Could you ask me again?" 
        : "Give me a quick second, my thoughts got a bit tangled up! Let's try that again. 🌸";
    }

    const { text } = styleLinter.process({
      channelId: turn.channelId,
      responseText: rawText,
      emojiBudget: plan.behaviorDirective?.emojiBudget || 'medium'
    });

    // ⚡ ZERO-LATENCY BACKGROUND DB SAVE (Fire and Forget)
    decisionPipeline.finalizeTurn({
      channelId: turn.channelId,
      userId: turn.userId,
      content: turn.content,
      responseText: text
    }).catch(dbError => console.error('⚠️ [DB] Background finalizeTurn error:', dbError.message));

    return {
      text,
      modelUsed: finalModelUsed,
      debug: {
        intent: userIntent,
        tier: plan.relationship?.tier || 'standard',
        behaviorDirective: plan.behaviorDirective,
        fastLane: gameTurn
      }
    };

  } catch (error) {
    console.error('❌ generateContent Error:', error);
    return { 
      text: "Give me a quick second, my network got a bit tangled up! Try asking me again in a moment. 🌸", 
      modelUsed: 'fallback', 
      debug: { intent: 'error', tier: 'standard', error: error.message } 
    };
  }
}

module.exports = { generateContent };
