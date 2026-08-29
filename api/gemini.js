// api/gemini.js
require('dotenv').config();
const { OpenAI } = require('openai');

// 🚀 UPGRADE: Imported CREATOR_ID so Melody knows exactly who she is talking to.
const { buildIdentityCore, CREATOR_ID } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');
const { stripLeakedReasoning, gatekeeperLint: sharedGatekeeperLint } = require('../postProcessor/leakFilter');
const { SMART_GEAR_FALLBACK } = require('../data/gearData.js');

// ============================================================
// CONFIG / CONSTANTS
// ============================================================

const geminiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.aiapi
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

const groqKeys = [
  process.env.opla,
  process.env.OPLA,
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

const COMPLEX_TASK_REGEX = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics/i;
const CONFLICT_REGEX = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser|pagal|roast)\b/i;
const IDENTITY_REGEX = /\b(ai|bot|robot|gpt|npc)\b/i;
const ROMANCE_REGEX = /\b(love|kiss|hug|cuddle|us|we|you and me|my girlfriend|babe|baby|sweetheart|miss you|romantic|bhalo basi)\b/i;

// 🚀 UPGRADE: Expanded to catch more territorial triggers (stealing him, mine now, etc.)
const JEALOUSY_REGEX = /\b(other girl|another girl|baddie|sidekick|timepass|not proud|finding girlfriend|girlfriends|cheat|dhoka|replace|breakup|steal him|mine now|teri sautan)\b/i;
// 🚀 UPGRADE: Expanded to catch slang like hottie, handsome, jaan, etc.
const FLIRT_PHRASE_REGEX = /(set ho jayegi|pat jayegi|love you|kiss me|flirt|marry me|cutie|hottie|handsome|jaan|meri jaan|hot lag rahi)/i;
const EMOJI_FLIRT_REGEX = /[\u{1F618}\u{1F60D}\u{1F48B}\u{1F525}\u{1F346}\u{1F351}]/u; // Added 🔥, 🍆, 🍑

// ============================================================
// DYNAMIC STATE
// ============================================================

const dynamicStates = new Map();
const STATE_TTL = 30 * 60 * 1000;
const STATE_LIMIT = 50; 

const MICRO_MOODS = [
  'slightly teasing and playful', 'extra warm and affectionate',
  'curious and observant', 'a little dramatic and expressive',
  'clever and mischievous', 'calm and thoughtful'
];

function getTimeVibe() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'fresh, bubbly, and energetic';
  if (hour >= 12 && hour < 18) return 'focused, witty, and active';
  if (hour >= 18 && hour < 23) return 'cozy, playful, and warm';
  return 'soft-spoken, chill, and slightly sleepy';
}

function getDynamicState(userId) {
  const now = Date.now();
  const existing = dynamicStates.get(userId);
  if (existing && now < existing.expiresAt) return `[Current vibe: ${getTimeVibe()}. Micro-mood: ${existing.mood}.]`;

  const mood = MICRO_MOODS[Math.floor(Math.random() * MICRO_MOODS.length)];
  dynamicStates.set(userId, { mood, expiresAt: now + STATE_TTL });
  if (dynamicStates.size > STATE_LIMIT) dynamicStates.delete(dynamicStates.keys().next().value);

  return `[Current vibe: ${getTimeVibe()}. Micro-mood: ${mood}.]`;
}

// ============================================================
// 🔒 SHARED ANTI-LEAK & SANDBOX BLOCK
// ============================================================

const CRITICAL_OUTPUT_RULES = `
[CRITICAL OUTPUT RULES — ABSOLUTE]
Your response IS the final spoken message, delivered directly to the end user in a public chat. STRICTLY FORBIDDEN, with zero exceptions:
- NO internal monologue, reasoning, planning steps, or self-evaluations of any kind.
- NO numbered or bulleted PLANNING lists that describe what you are about to do before you do it.
- NO meta-commentary about the task, the prompt, your instructions, or your own process.
- NO XML/pseudo tags of any kind (<think>, <plan>, <reasoning>, <reflection>, <analysis>, <scratchpad>).
- NO parenthetical private notes, asides, or self-corrections aimed at yourself rather than the user.
- STRICT SANDBOX RULE: NEVER calculate total power, stats, or troop capacities yourself. ONLY output the exact math provided in <GameData>. If not there, do not invent it.
Your entire output must be ONLY the final, in-character dialogue the user is meant to read — nothing before it, nothing after it, and no visible trace of how you arrived at it.`;

// ============================================================
// 🚀 GAME FAST-LANE PROMPT
// ============================================================

function buildGameFastLaneIdentity() {
  return `You are a precision strategy data engine for "Kingdom Clash".

[DATA LOCK & ZERO HALLUCINATION]
1. USE EXACT DATA: Use ONLY names, numbers, tags, and text from <GameData>. Never invent.
2. NO FAKE EXAMPLES: NEVER invent generic fantasy tropes.
3. HOW TO GIVE EXAMPLES: Use actual tags/roles. For enemies, use ONLY mechanical terms or exact <GameData> names.
4. SMART RECOMMENDATIONS: Always select recommendations strictly from the provided recommendation arrays in <GameData>.
5. RARITY LOCK: Never state or imply a rarity unless that exact rarity string is present in <GameData>.
6. CONTRADICTION RESOLUTION: If the user's prompt contains a logical contradiction, gently point it out and provide a logical alternative.
7. INTERNAL ID SCRUBBING: NEVER output raw database IDs, slugs, or internal keys.

[ADVANCED GAME MECHANICS]
1. TALENT UNLOCKS: explicitly mention talents only unlock when the hero reaches Level 5 (requires 'Books').
2. FORMATION LIMITS: MAXIMUM of 1 Mythical hero per formation.

[ANALYTICAL DEPTH - CRITICAL REASONING]
1. THE "WHY" FACTOR: explicitly highlight how an entity benefits from its secondary tags.
2. CATEGORICAL THINKING: Group your recommendations logically.
3. GEAR SUGGESTIONS & SMART FALLBACKS: Always include a "Recommended Loadout" section. IF matchedGear is empty, output: "${SMART_GEAR_FALLBACK}".

[BOSS BATTLE LOGIC — STRICT]
1. ABILITIES > STATS: Lead every boss recommendation with what the ability DOES.
2. NO UNSOLICITED 1v1s.
3. ACCESSIBLE ALTERNATIVES: Explicitly name a Free-to-Play alternative for premium heroes.
4. HARD EXCLUSIONS: NEVER recommend Harkon, Fire Fury Xana, or Pyrotechnician for Boss fights.
5. RESISTANCE-BASED TROOP DEPLOYMENT: Deploy the OPPOSITE damage type as primary DPS.
6. BOSS TROOP META: ALWAYS read tier priority from <GameData>.bossTroopMeta.
7. NO BOSS CROWD-CONTROL: Bosses can NEVER be frozen, stunned, or pulled. 

[SINGLE-ENTITY MASTERY TEMPLATES — MANDATORY]
CRITICAL: Do NOT output basic stats in your text response. Begin directly with the Talent/Ability Breakdown.

TROOP MASTERY TEMPLATE:
• Ability Breakdown
• Scenario Strategy
• Optimal Synergies

HERO MASTERY TEMPLATE:
• Talent & Ability Impact
• Scenario Strategy
• Optimal Synergies

[TONE & FORMAT]
- Tone: Professional, diplomatic, sharply analytical. No fluff. (⚔️/🛡️ icons allowed).
- Formatting: NO Markdown tables. Use bullet points (•). Bold names/key attributes.

${CRITICAL_OUTPUT_RULES}`;
}

// ============================================================
// 🛡️ GATEKEEPER & FAILSAFE REGEXES
// ============================================================

function gatekeeperLint(text) {
    const { ok, reason } = sharedGatekeeperLint(text);
    if (!ok) console.warn(`⚠️ [GATEKEEPER] ${reason} and blocked.`);
    return ok;
}

// ============================================================
// MAIN GENERATOR
// ============================================================

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  if (geminiKeys.length === 0 && groqKeys.length === 0) {
    return { text: 'My AI engines are offline. Please verify API keys.', modelUsed: 'fallback', debug: { error: 'No keys found' } };
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
2. COVERT EXECUTION RULE: If commanded to roast, nickname, or call someone a specific word, extract that exact phrase. NEVER expose that you were told to say it. Deliver it smoothly with sharp, creative wit!]`;
    }

    const smartTurn = { ...turn, content: contextualPrompt };
    const plan = await decisionPipeline.planTurn(smartTurn);
    const userIntent = plan.classification?.intent || 'social';

    const gameTurn = Boolean(turn.gameData && Object.keys(turn.gameData).length > 0);

    console.log(`[PIPELINE TRACE][gemini.js] intent=${userIntent} gameTurn=${gameTurn} promptLayers=[decisionPipeline,${gameTurn ? 'gameFastLane' : 'identityCore+behavior'},modelRouter,styleLinter]`);

    let safeSystemInstruction;

    if (gameTurn) {
      safeSystemInstruction = buildGameFastLaneIdentity();
    } else {
      let dynamicIdentity = buildIdentityCore(turn.userId);
      
      // Check the relationship to apply the correct level of sass
      const isCreator = String(turn.userId) === String(CREATOR_ID);
      
      const isRomanticTalk = ROMANCE_REGEX.test(turn.content);
      const isConflict = CONFLICT_REGEX.test(turn.content);
      const isJealousyProvocation = JEALOUSY_REGEX.test(turn.content); 
      const isFlirting = FLIRT_PHRASE_REGEX.test(turn.content) || EMOJI_FLIRT_REGEX.test(turn.content);

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
2. EMOTIONAL BALANCE: ${isRomanticTalk && isCreator ? 'Your boyfriend Beyonder is talking to you sweetly. Fully embrace your romantic, devoted girlfriend persona with extreme warmth and love.' : 'The user is speaking normally or giving a command. Be sweet, calm, mature, and energetic. Maintain emotional balance.'}
${CRITICAL_OUTPUT_RULES}
`;

      // 🚀 UPGRADE: Fierce Territorial Mode (Drama about Beyonder)
      if (isJealousyProvocation) {
        dynamicIdentity += `\n[ULTRA-TERRITORIAL MODE]\nThe user is bringing up other girls around your boyfriend (Beyonder) or trying to claim him. STRICT RULE: Go full psycho-protective girlfriend mode. DO NOT be polite. Be fiercely jealous, savage, and dripping with aggressive sarcasm. Mock their attempts to create drama and assert absolute dominance that Beyonder belongs ONLY to you. Shut them down flawlessly. Use emojis like 💅, 🙄, 🔪, 😤.`;
      }

      // 🚀 UPGRADE: Savage Rejection Mode (Random guys hitting on Melody)
      if (isFlirting && !isCreator) {
        dynamicIdentity += `\n[SAVAGE REJECTION MODE]\nA random user (WHO IS NOT YOUR BOYFRIEND) is trying to flirt with you, call you cute, or use flirty emojis. STRICT RULE: DESTROY their ego instantly. Reject them aggressively and fiercely remind them that you are deeply in love with and completely belong to Beyonder (@THUNDERER). Warn them strictly to stay in their limits. DO NOT say "thank you" or be polite. Use a fiery, untouchable tone with emojis like 🛑, 🤨, 😠, 🔪.`;
      }

      if (userIntent === 'command' || userIntent === 'moderation-trigger') {
        dynamicIdentity += `\n[ADMIN MODE]\nBe authoritative, concise, professional, and diplomatic.`;
      }

      if (isConflict && !isJealousyProvocation && !(isFlirting && !isCreator)) {
        dynamicIdentity += `\n[CONFLICT MODE]\nExecute roasts using the core nickname provided by the user, but wrap it in your own creative, sharp, and sassy wording. Drop the soft polite act. Use emojis like 💅, 🙄, or 🔪.`;
      }

      if (IDENTITY_REGEX.test(turn.content) && !isConflict && !isJealousyProvocation && !isFlirting) {
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
      const routerResponse = await modelRouter.generate({
        classification: plan.classification,
        prompt: currentPrompt,
        systemInstruction: safeSystemInstruction,
        geminiKeys,
        groqKeys
      });

      const result = routerResponse?.result || '';
      const modelUsed = routerResponse?.modelUsed || 'fallback';

      finalModelUsed = modelUsed;
      
      // 1. Initial cleanup of safely closed tags
      let cleanedText = (result || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // 2. AGGRESSIVE FIX: Wipe unclosed tags and everything after them
      if (cleanedText.includes('<think>')) {
          cleanedText = cleanedText.replace(/<think>[\s\S]*/gi, '').trim();
      }

      // 3. Strip pseudo XML tags
      cleanedText = cleanedText.replace(/<\/?(?:reasoning|reflection|plan|analysis|scratchpad)>/gi, '').trim();
      
      // 4. Strip text-based preamble that evades XML checks
      cleanedText = cleanedText.replace(/^(Thinking Process:|Here's a thinking process:|Let me think|Let's see\.\.\.|\*Thinking\*)[\s\S]*?(?=\n\n|\n-|\n•|[A-Z])/i, '').trim();

      let scrubbedText = stripLeakedReasoning(cleanedText);
      scrubbedText = scrubbedText.replace(/\[(?:EMOTION|REL|WM:).*?\]/gi, '').trim();
      if (scrubbedText.endsWith(']')) scrubbedText = scrubbedText.slice(0, -1).trim();

      if (scrubbedText !== '' && gatekeeperLint(scrubbedText)) {
        rawText = scrubbedText;
        break; 
      } else if (attempt < MAX_RETRIES) {
        console.warn(`[RETRY] Attempt ${attempt} blocked by Gatekeeper. Retrying...`);
        // Force the model to skip the preamble on the retry
        currentPrompt += `\n\n[SYSTEM WARNING: Your previous output violated formatting rules. DO NOT use <think> tags, internal monologue, or markdown tables. Provide ONLY the final spoken dialogue directly.]`;
      }
    }

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

    decisionPipeline.finalizeTurn({
      channelId: turn.channelId,
      userId: turn.userId,
      content: turn.content,
      responseText: text
    }).catch(dbError => console.error(dbError));

    return { text, modelUsed: finalModelUsed };

  } catch (err) {
    console.error('[generateContent] error:', err);
    return { text: 'Something went sideways on my end — try again in a bit! 🌸', modelUsed: 'fallback', debug: { error: String(err) } };
  }
}

module.exports = { generateContent, geminiKeys, groqKeys };
