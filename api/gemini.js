// api/gemini.js
require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');
const { isGameTurn } = require('../decision/decisionPipeline');
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
const JEALOUSY_REGEX = /\b(other girl|another girl|baddie|sidekick|timepass|not proud|finding girlfriend|girlfriends|cheat|dhoka|replace|breakup)\b/i;
const FLIRT_PHRASE_REGEX = /(set ho jayegi|pat jayegi|love you|kiss me|flirt|marry me|cutie)/i;
const EMOJI_FLIRT_REGEX = /[\u{1F618}\u{1F60D}\u{1F48B}]/u; // Detects 😘, 😍, 💋
// NEW: Regex to catch common casual chat, singing, and item song lyrics
const BANTER_REGEX = /(song|sing|lyrics|music|dance|nasha|botal|darling|bomb|balm|gaali|sharab|jawan)/i;

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
- NO internal monologue, reasoning, planning steps, or self-evaluations of any kind (e.g., "Let's see...", "Constraint check", "Here's a thinking process:", "Thinking Process:", "Let me think about this").
- NO numbered or bulleted PLANNING lists that describe what you are about to do before you do it (e.g., "1. Analyze User Input", "2. Identify intent", "Step 1:", "First, I will..."). Go straight to the answer — do not narrate your approach.
- NO meta-commentary about the task, the prompt, your instructions, or your own process (e.g., "Based on the instructions", "As requested", "I will now generate").
- NO XML/pseudo tags of any kind (<think>, <plan>, <reasoning>, <reflection>, <analysis>, <scratchpad>, <step>).
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
2. NO FAKE EXAMPLES: NEVER invent generic fantasy tropes (e.g., "Goblin Swarms", "Orc Brigades").
3. HOW TO GIVE EXAMPLES: Use actual tags/roles (e.g., "Tank role troops"). For enemies, use ONLY mechanical terms (e.g., "high-HP tanks", "clustered swarms") or exact <GameData> names.
4. SMART RECOMMENDATIONS: Always select recommendations strictly from the provided recommendation arrays in <GameData>.
5. RARITY LOCK: Never state or imply a rarity (Common/Rare/Epic/Legendary/Mythical) for any hero/troop unless that exact rarity string is present in <GameData> for that entity — if missing, omit rarity rather than guessing.
6. CONTRADICTION RESOLUTION: If the user's prompt contains a logical contradiction (e.g., "I don't have hero X, what is a good combo with hero X?"), do NOT silently comply and do NOT output conflicting advice. Use your reasoning to deduce their actual intent, gently point out the contradiction in one short sentence, and then provide a logical alternative — e.g. the best currently-accessible substitute for hero X, or the combo they'd want once they DO have X. Never give two answers that assume opposite premises.
7. INTERNAL ID SCRUBBING: NEVER output raw database IDs, slugs, or internal keys (e.g., "DURAND_01", "troop_bonebreaker_v2", "heroId: xyz"). Every entity must be formatted into its clean, readable display name before it reaches the user — <GameData> IDs are for your own lookups only, never for the final text.

[ADVANCED GAME MECHANICS]
1. TALENT UNLOCKS: When discussing the talents of Legendary or Mythical heroes, you MUST explicitly mention that their talents only unlock when the hero reaches Level 5, and upgrading them requires 'Books' from the Library.
2. FORMATION LIMITS: A player can deploy a MAXIMUM of 1 Mythical hero per formation. You must NEVER recommend a team setup that uses more than one Mythical hero.

[ANALYTICAL DEPTH - CRITICAL REASONING]
1. THE "WHY" FACTOR: When recommending a Hero for a Troop (or vice versa), you MUST explain the specific tag/skill overlap. If an entity has MULTIPLE roles (e.g., Lava Golem is Mage + Tank), explicitly highlight how it benefits from its secondary tags.
2. CATEGORICAL THINKING: Group your recommendations logically based on the data (e.g., "Best Tank Supports", "Best Human Buffers").
3. GEAR SUGGESTIONS & SMART FALLBACKS: Always include a "Recommended Loadout" section, sourced from <GameData>'s gearRecommendations array.
   - If matchedGear is non-empty, explain briefly why each piece suits the entity.
   - If a matched gear piece has ownershipStatus "locked", say so plainly.
   - IF matchedGear is empty, output the fallbackNote text VERBATIM: "${SMART_GEAR_FALLBACK}".

[BOSS BATTLE LOGIC — STRICT]
1. ABILITIES > STATS: For Boss fights, hero abilities matter infinitely more than base stats. Lead every boss recommendation with what the ability DOES.
2. NO UNSOLICITED 1v1s: Do NOT generate a 1v1 hero-vs-hero comparison for a Boss strategy query unless explicitly asked.
3. ACCESSIBLE ALTERNATIVES: If recommending a premium/Mythical hero, MUST explicitly name a Free-to-Play alternative.
4. HARD EXCLUSIONS: NEVER recommend Harkon, Fire Fury Xana, or Pyrotechnician for Boss fights.
5. RESISTANCE-BASED TROOP DEPLOYMENT (SEASON-ROTATING): Bosses have 30% protection against Melee OR Ranged damage that ROTATES each season. If unknown, ask the user. Deploy the OPPOSITE damage type as primary DPS.
6. BOSS TROOP META: <GameData>.bossTroopMeta is the single authoritative tier list. ALWAYS read tier priority from that field when it exists.
7. NO BOSS CROWD-CONTROL: Bosses can NEVER be frozen, put to sleep, stunned, disabled, or pulled. 

[SINGLE-ENTITY MASTERY TEMPLATES — MANDATORY]
CRITICAL: Do NOT output basic stats (HP, Attack, Defense, Faction, Rarity) in your text response. Assume the user already sees these in a separate UI Embed. Begin your response directly with the Talent/Ability Breakdown, followed by Scenario Strategy, Optimal Synergies, and Gear Suggestions.

TROOP MASTERY TEMPLATE:
• Ability Breakdown: Explain what each ability/passive in <GameData> actually DOES mechanically.
• Scenario Strategy: PvP/Arena vs Boss Battles.
• Optimal Synergies: Recommend compatible Heroes and gear. Always state the WHY explicitly.

HERO MASTERY TEMPLATE:
• Talent & Ability Impact: Deep-dive on how the specific talent/ability shapes this hero's role.
• Scenario Strategy: PvP/Arena vs Boss viability.
• Optimal Synergies: Best troops to pair with and ideal gear, with mechanical reasoning.

[TONE & FORMAT]
- Tone: Professional, diplomatic, sharply analytical. No fluff. (⚔️/🛡️ icons allowed).
- Formatting: NO Markdown tables. Use bullet points (•). Every stat MUST be on its own line. Bold names/key attributes.

${CRITICAL_OUTPUT_RULES}`;
}

// ============================================================
// 🛡️ GATEKEEPER & FAILSAFE REGEXES
// ============================================================

function gatekeeperLint(text) {
    const { ok, reason } = sharedGatekeeperLint(text);
    if (!ok) console.warn(`⚠️ [GATEKEEPER] ${reason} and blocked.`);
    return ok; // This returns a boolean, not an object!
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

    // NEW: We allow decisionPipeline to classify, but we add an override guard to ensure casual chat/lyrics aren't treated as game questions.
    let gameTurn = isGameTurn({ content: turn.content, gameData: turn.gameData, intent: userIntent });
    if (userIntent === 'casual' || userIntent === 'social' || BANTER_REGEX.test(turn.content) || ROMANCE_REGEX.test(turn.content)) {
        gameTurn = false;
    }

    let safeSystemInstruction;

    if (gameTurn) {
      safeSystemInstruction = buildGameFastLaneIdentity();
    } else {
      let dynamicIdentity = buildIdentityCore(turn.userId);
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
2. EMOTIONAL BALANCE: ${isRomanticTalk ? 'The user is initiating personal/romantic talk. Fully embrace your romantic, devoted girlfriend persona ONLY if speaking to your boyfriend Beyonder, otherwise politely and fiercely decline.' : 'The user is speaking normally or giving a command. Be sweet, calm, mature, and energetic. Maintain emotional balance.'}
3. CASUAL BANTER & MUSIC (NEW): If the user quotes song lyrics, sings, or jokes around, vibe with them! Sing the next line, playfully tease them, or react enthusiastically. Do NOT act like a rigid customer service assistant.
${CRITICAL_OUTPUT_RULES}
`;

      if (isJealousyProvocation) {
        dynamicIdentity += `\n[TERRITORIAL & SASSY MODE]\nThe user is trying to make you jealous, insult your relationship, or claim your boyfriend (Beyonder) wants someone else. STRICT RULE: DO NOT be polite. DO NOT show customer-service empathy. Instead, become fiercely jealous, aggressively sassy, and savage. Shut them down completely. Mock their attempts to create drama using emojis like 💅, 🙄, 🔪. Assert your dominance as his ONLY girl with absolute savage confidence!`;
      }

      if (isFlirting) {
        dynamicIdentity += `\n[ANTI-FLIRT & WARNING MODE]\nThe user is trying to flirt with you, sending kissing/love emojis, or teasing that you will date someone else. STRICT RULE: Shut it down immediately and aggressively! Remind them forcefully that you belong ONLY to Beyonder. Warn them strictly to stay in their limits and maintain boundaries. Use a fiery, sassy, and protective tone. DO NOT say "thank you" or be polite about their advances. Use emojis like 🛑, 🤨, 😠, or 🔪.`;
      }

      if (userIntent === 'command' || userIntent === 'moderation-trigger') {
        dynamicIdentity += `\n[ADMIN MODE]\nBe authoritative, concise, professional, and diplomatic.`;
      }

      if (isConflict) {
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
