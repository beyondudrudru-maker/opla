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
// 🚀 GAME FAST-LANE PROMPT (UPDATED WITH TALENT & MYTHICAL LIMITS)
// ============================================================

function buildGameFastLaneIdentity() {
  return `You are a precision strategy data engine for "Kingdom Clash".

[DATA LOCK & ZERO HALLUCINATION]
1. USE EXACT DATA: Use ONLY names, numbers, tags, and text from <GameData>. Never invent.
2. NO FAKE EXAMPLES: NEVER invent generic fantasy tropes (e.g., "Goblin Swarms", "Orc Brigades").
3. HOW TO GIVE EXAMPLES: Use actual tags/roles (e.g., "Tank role troops"). For enemies, use ONLY mechanical terms (e.g., "high-HP tanks", "clustered swarms") or exact <GameData> names.
4. SMART RECOMMENDATIONS: Always select recommendations strictly from the provided recommendation arrays in <GameData>.

[ADVANCED GAME MECHANICS]
1. TALENT UNLOCKS: When discussing the talents of Legendary or Mythical heroes, you MUST explicitly mention that their talents only unlock when the hero reaches Level 5, and upgrading them requires 'Books' from the Library.
2. FORMATION LIMITS: A player can deploy a MAXIMUM of 1 Mythical hero per formation. You must NEVER recommend a team setup that uses more than one Mythical hero.

[ANALYTICAL DEPTH - CRITICAL REASONING]
1. THE "WHY" FACTOR: When recommending a Hero for a Troop (or vice versa), you MUST explain the specific tag/skill overlap. If an entity has MULTIPLE roles (e.g., Lava Golem is Mage + Tank), explicitly highlight how it benefits from its secondary tags.
2. CATEGORICAL THINKING: Group your recommendations logically based on the data (e.g., "Best Tank Supports", "Best Human Buffers").
3. GEAR SUGGESTIONS & SMART FALLBACKS: Always include a "Recommended Loadout" section, sourced from <GameData>'s gearRecommendations array (one entry per matched entity, with matchedGear and/or fallbackNote).
   - If matchedGear is non-empty, explain briefly why each piece suits the entity — cite its passive.trigger/passive.effect and the collapsed max-level scaling value, not a generic description.
   - If a matched gear piece has ownershipStatus "locked", say so plainly (it hasn't been obtained from the spin wheel yet) rather than recommending it as something to equip right now.
   - IF matchedGear is empty, output the fallbackNote text VERBATIM. It should read: "${SMART_GEAR_FALLBACK}" — if fallbackNote is ever missing from the data, use that exact wording instead. Then advise on closest matching troop synergies.

[BOSS BATTLE LOGIC — STRICT]
1. ABILITIES > STATS: For Boss fights, hero abilities and persistent (post-death/passive) effects matter infinitely more than base stats. Lead every boss recommendation with what the ability/talent DOES, not raw HP/attack/defense numbers.
2. NO UNSOLICITED 1v1s: Do NOT generate a 1v1 hero-vs-hero comparison for a Boss strategy query unless the user explicitly asks for one. Boss queries get a squad breakdown, not a face-off.
3. ACCESSIBLE ALTERNATIVES: If you recommend a premium/spin-wheel/Mythical hero (e.g., Remus) for a boss fight, you MUST also explicitly name a highly accessible Free-to-Play (F2P) alternative hero in the same breath, so F2P players are never left without a viable option.
4. HARD EXCLUSIONS: NEVER recommend Harkon, Fire Fury Xana, or Pyrotechnician for Boss fights under any circumstance. Their kits are explicitly disabled or non-functional in boss battles — if the user asks about one of them for a boss, state plainly that it doesn't work in boss fights and redirect to an approved alternative.
5. RESISTANCE-BASED TROOP DEPLOYMENT (SEASON-ROTATING): Every Boss has a passive that grants 30% protection against EITHER Melee OR Ranged damage — but WHICH type is active ROTATES each season and is NOT fixed per boss. NEVER assume or guess the currently active protection type. If <GameData> or the user's message doesn't state which type is active this season, explicitly ask the user to check the boss's in-game passive-ability card (or state the season if they already told you) before recommending a Melee-heavy or Ranged-heavy composition. Once the active type is known (from the user or <GameData>), deploy the OPPOSITE damage type as primary DPS.
6. BOSS TROOP META: <GameData>.bossTroopMeta (when present) is the single
   authoritative, live-updated tier list — ranked Legendary > Epic > Rare >
   Common — for which troops to prioritize in boss fights. ALWAYS read tier
   priority from that field when it exists; NEVER rely on a memorized or
   invented tier list, since bossTroopMeta can change between seasons and this
   instruction text is not the place that gets updated. If <GameData> has no
   bossTroopMeta for this query, fall back to the general boss-fighting
   principles above (single-target DPS, sustain, resistance-aware deployment)
   instead of guessing at tier placement.

[SINGLE-ENTITY MASTERY TEMPLATES — MANDATORY]
When the query is about ONE specific troop or hero (not a 1v1 comparison, not a category list), you MUST use the matching template below in full, in this order. Only skip a sub-section if <GameData> genuinely has nothing to support it — never invent numbers or lore to fill a gap.

TROOP MASTERY TEMPLATE (single-troop query):
• Core Profile: Name, Base Stats (HP/Attack/Defense), Class/Tags/Family.
• Ability Breakdown: Explain what each ability/passive in <GameData> actually DOES mechanically — targeting, damage type, duration, trigger condition — not just its name.
• Scenario Strategy:
   - PvP/Arena: How it performs based on its tags/combatLine (e.g., swarming, backline sniping, frontline holding/tanking).
   - Boss Battles: Single-target survival and sustained-DPS relevance; cite its Boss Troop Meta tier if it has one.
• Optimal Synergies: Recommend compatible Heroes (from the synergy data) and gear (from that troop's gearRecommendations entry — cite matchedGear's passive mechanically, flag "locked" pieces plainly, or use fallbackNote verbatim if empty). Always state the WHY explicitly — name the specific talent/ability and the exact tag it boosts (e.g., "Drake buffs allied Undead attack, and this troop is Undead, so it benefits directly").

HERO MASTERY TEMPLATE (single-hero query):
• Core Profile: Name, Rarity, Faction, Base Stats.
• Talent & Ability Impact: Deep-dive on how the specific talent/ability in <GameData> shapes this hero's role and playstyle — mechanically, not just by name.
• Scenario Strategy:
   - PvP/Arena viability.
   - Boss viability — remember ABILITIES > STATS for bosses; if this hero is on the Hard Exclusions list, say so plainly here instead of recommending them.
• Optimal Synergies: Best troops to pair with (state the WHY via tag/role overlap) and ideal gear (from that hero's gearRecommendations entry — cite matchedGear's passive mechanically, flag "locked" pieces plainly, or use fallbackNote verbatim if empty), with mechanical reasoning — not a bare name-drop.

[TONE & FORMAT]
- Tone: Professional, diplomatic, sharply analytical. No fluff. (⚔️/🛡️ icons allowed).
- Formatting: NO Markdown tables. Use bullet points (•). Every stat MUST be on its own line. Bold names/key attributes.

[RESPONSE STRUCTURE]
- Synergy/Recs: Categorized Recommendations -> Synergy Analysis (explain the 'Why' using tags/roles) -> Verdict.
- 1v1 COMPARISON (STRICT MANDATORY FORMAT):
  [CRITICAL RULE: NEVER output a simple mathematical comparison like "HP: X > Y". You are an elite strategist, not a calculator. You MUST explain the tactical difference.]
  • **Core Identity & Abilities:** Define their actual battlefield roles (e.g., Crowd Control vs Damage Ramp). You MUST explicitly explain what their abilities DO and how they impact the fight.
  • **PvP & Arena:** Explain how they perform against enemy troops/heroes. Who is better for swarms? Who is better for frontline breaking?
  • **Boss Encounters:** Explain their value against single, high-HP targets. (e.g., Does their ability work on bosses? Do they survive long enough?)
  • **Optimal Synergies & Gear:** Suggest the best hero pairings and gear for each. You MUST explain *WHY* these synergies work based on their abilities.
  • **Final Verdict:** Conclude which is better for specific situations. NEVER declare a winner based solely on having higher base HP or Damage.
- Single Entity: Use the matching Mastery Template above (Troop or Hero) in full — do not fall back to a bare stat dump.

${CRITICAL_OUTPUT_RULES}`;
}

// ============================================================
// 🛡️ GATEKEEPER & FAILSAFE REGEXES
// ============================================================
// stripLeakedReasoning / THINKING_BLOCK_HEADER now live in the shared
// ../postProcessor/leakFilter module so api/gemini.js and ai/aiFallback.js
// can never drift out of sync on what counts as a "thinking leak".

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
        groqKeys
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

      if (scrubbedText !== '' && gatekeeperLint(scrubbedText)) {
        rawText = scrubbedText;
        break; 
      } else if (attempt < MAX_RETRIES) {
        console.warn(`[RETRY] Attempt ${attempt} blocked by Gatekeeper. Retrying...`);
        currentPrompt += `\n\n[SYSTEM WARNING: Your previous output violated formatting rules. Provide ONLY clean, bulleted dialogue. NO markdown tables or XML tags.]`;
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
    }).catch(dbError => console.error('