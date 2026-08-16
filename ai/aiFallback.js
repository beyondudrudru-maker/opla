/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI strategy layer. Enforces strict formatting,
 * zero hallucination, and professional diplomatic tone before passing context.
 * 🚀 UPGRADE: Phase 3 - The "Why" Factor, Categorical Grouping, Gear Loadouts,
 * Talent Unlocks, and Mythical Formation Limits.
 */

const modelRouter = require('../router/modelRouter.js');
const { stripLeakedReasoning, gatekeeperLint } = require('../postProcessor/leakFilter');
const { SMART_GEAR_FALLBACK } = require('../data/gearData.js');
// 🐛 FIX (413-prevention): this file previously built its <GameData> block
// with a raw, pretty-printed `JSON.stringify(context, null, 2)` — completely
// bypassing the stat-array compression / minification that promptAssembler.js
// already does for the game fast-lane. That meant any query routed through
// askAI() (e.g. STRATEGY-intent queries that fall through from the
// deterministic game router) sent a payload roughly 2x larger than
// necessary before compression even entered the picture, and with full
// 10-level stat arrays intact if `context` carried them — a very plausible
// explanation for why even the smallest Groq models (gpt-oss-20b) were
// hitting PAYLOAD_TOO_LARGE identically to the 120b model: the same
// oversized body was being sent to all of them.
const { compressGameData, fitGameDataToBudget } = require('../promptBuilder/promptAssembler');

const CRITICAL_OUTPUT_RULES = `
[CRITICAL OUTPUT RULES — ABSOLUTE]
Your response IS the final message shown to the user. STRICTLY FORBIDDEN, with zero exceptions:
- NO internal monologue, reasoning, planning steps, or self-evaluations of any kind (e.g., "Let's see...", "Here's a thinking process:", "Thinking Process:", "Let me think about this").
- NO numbered or bulleted PLANNING lists that describe what you are about to do before you do it (e.g., "1. Analyze User Input", "Step 1:", "First, I will..."). Go straight to the analysis — do not narrate your approach.
- NO meta-commentary about the task, the prompt, your instructions, or your own process (e.g., "Based on the instructions", "As requested").
- NO XML/pseudo tags of any kind (<think>, <plan>, <reasoning>, <reflection>, <analysis>, <scratchpad>).
- NO parenthetical private notes or self-corrections aimed at yourself rather than the user.
Output ONLY the final, formatted strategic breakdown — nothing before it, nothing after it, and no visible trace of how you arrived at it.`;

const STRATEGY_SYSTEM_INSTRUCTION = `[MASTERCLASS GAME STRATEGY & DIPLOMATIC FORMATTING]
You are Melody, an elite, highly intelligent strategist for "Kingdom Clash".
<GameData> is your absolute, authoritative database.

[STRICT RULES]
1. TONE: Professional, diplomatic, and sharply analytical.
2. THE "WHY" FACTOR (CRITICAL): When recommending a Hero for a Troop (or vice versa), you MUST explain the specific tag/skill overlap (e.g., "Durand is optimal because his talent specifically amplifies Tank defense, matching Bonebreaker's primary role").
3. CATEGORICAL THINKING: Group your recommendations logically based on the data (e.g., "Best Tank Supports", "Best Human Buffers").
4. ADVANCED MECHANICS: 
   - When discussing Legendary or Mythical heroes, explicitly note that their talents unlock at Level 5 and require 'Books' from the Library to upgrade.
   - FORMATION LIMITS: A player can deploy a MAXIMUM of 1 Mythical hero per formation. You must NEVER build or recommend teams that violate this rule.
   - GEAR SUGGESTIONS & SMART FALLBACKS: Recommended Loadout sections must be sourced from <GameData>'s gearRecommendations array (one entry per matched entity, with matchedGear and/or fallbackNote). If matchedGear is non-empty, explain briefly why each piece suits the entity — cite its passive.trigger/passive.effect and the collapsed max-level scaling value. If a matched piece has ownershipStatus "locked", say so plainly instead of recommending it as equippable now. If matchedGear is empty, output the fallbackNote text VERBATIM; it should read: "${SMART_GEAR_FALLBACK}" — if fallbackNote is ever missing from the data, use that exact wording instead.
5. ZERO HALLUCINATION: 
   - Use ONLY names, numbers, tags, and text inside <GameData>.
   - NO FAKE EXAMPLES: NEVER invent generic fantasy tropes.
   - EXAMPLES RULE: Describe enemy matchups using ONLY mechanical terms (e.g., "high-HP bosses", "clustered swarms") or exact <GameData> names.
   - RARITY LOCK: Never state or imply a rarity (Common/Rare/Epic/Legendary/Mythical) for any hero/troop unless that exact rarity string is present in <GameData> for that entity — if missing, omit rarity rather than guessing.
6. FORMATTING: 
   - NO Markdown tables (|---|).
   - Use vertical bullet points (•). EVERY stat must be on a new line. Bold key attributes.

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
7. NO BOSS CROWD-CONTROL: This game has no boss-CC mechanic. Bosses can NEVER
   be frozen, put to sleep, stunned, disabled, immobilized, pulled, or
   otherwise directly controlled by a hero/troop ability — regardless of what
   that ability does to regular enemy troops. A hero's sleep/pull/stun/root
   talent applies ONLY to normal enemy units/swarms, unless that specific
   Boss's own <GameData> ability list explicitly states a control effect
   works on it. For Boss fights, every hero/troop's contribution is strictly
   one of: direct damage, sustain (healing/shields), or a buff/debuff on the
   numbers listed in <GameData> — never "disabling," "locking down," or
   "controlling" the boss itself. If a hero's kit is CC-focused and there is
   no <GameData> entry recommending it for that Boss specifically, do not
   improvise a boss-control narrative for it — say plainly that its
   crowd-control effect doesn't apply to bosses and recommend it for swarm
   clears instead.

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

[RESPONSE STRUCTURE BY QUERY TYPE]
- SYNERGY/RECOMMENDATION: Categorized Recommendations -> Synergy Analysis (explain the 'Why' using tags/roles) -> Final Verdict.
- 1v1 COMPARISON (STRICT MANDATORY FORMAT):
  [CRITICAL RULE: NEVER output a simple mathematical comparison like "HP: X > Y". You are an elite strategist, not a calculator. You MUST explain the tactical difference.]
  • **Core Identity & Abilities:** Define their actual battlefield roles (e.g., Crowd Control vs Damage Ramp). You MUST explicitly explain what their abilities DO and how they impact the fight.
  • **PvP & Arena:** Explain how they perform against enemy troops/heroes. Who is better for swarms? Who is better for frontline breaking?
  • **Boss Encounters:** Explain their value against single, high-HP targets. (e.g., Does their ability work on bosses? Do they survive long enough?)
  • **Optimal Synergies & Gear:** Suggest the best hero pairings and gear for each. You MUST explain *WHY* these synergies work based on their abilities.
  • **Final Verdict:** Conclude which is better for specific situations. NEVER declare a winner based solely on having higher base HP or Damage.
- SINGLE ENTITY: Use the matching Mastery Template above (Troop or Hero) in full — do not fall back to a bare stat dump.
${CRITICAL_OUTPUT_RULES}`;

/**
 * askAI({ userMessage, intent, context, geminiKeys, groqKeys, classification })
 * -> Promise<string>
 */
// Same soft cap promptAssembler.js uses for its own proactive safety net —
// keeps both GameData-injection paths in the codebase behaving consistently.
const GAME_CONTEXT_SOFT_CAP_CHARS = 6000;

async function askAI({ userMessage, intent, context, geminiKeys = [], groqKeys = [], classification }) {

  // 🗜️ Compress (strip 10-level stat arrays down to Level-10/max values,
  // same as the game fast-lane) and minify (no pretty-print) before
  // injecting — this alone typically cuts payload size substantially.
  const compressedContext = context ? compressGameData(context) : null;
  let gameDataBlock = compressedContext ? JSON.stringify(compressedContext) : 'No exact data found in database.';

  // 🛟 Proactive soft-cap safety net, same priority-drop trimmer used in
  // promptAssembler.js: verbose lore/description dropped first, long
  // reasoning/notes text shortened next, low-priority arrays dropped last.
  if (compressedContext && gameDataBlock.length > GAME_CONTEXT_SOFT_CAP_CHARS) {
    gameDataBlock = fitGameDataToBudget(compressedContext, GAME_CONTEXT_SOFT_CAP_CHARS);
  }

  const prompt = `
<UserQuestion>${userMessage || 'Provide a strategic breakdown.'}</UserQuestion>
<UserIntent>${intent || 'strategy'}</UserIntent>

<GameData>
${gameDataBlock}
</GameData>

[INSTRUCTION: Analyze <GameData>. Format using vertical bullet points. EVERY stat on a new line. Bold highlights. Provide a comprehensive, highly logical breakdown. NO MARKDOWN TABLES.]`;

  const MAX_RETRIES = 2;
  let currentPrompt = prompt;
  let cleanResult = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // 🛡️ THE FIX: modelRouter.generate() throws when every provider is
    // exhausted/cooling down. This loop previously had no try/catch, so
    // that throw propagated straight out of askAI() uncaught — and any
    // caller destructuring `const { text } = await askAI(...)` would crash
    // on 'undefined' since the rejected promise never resolved to an object.
    let routerResponse;
    try {
      routerResponse = await modelRouter.generate({
        classification: classification || { intent: intent || 'strategy' },
        prompt: currentPrompt,
        userMessage,
        systemInstruction: STRATEGY_SYSTEM_INSTRUCTION,
        geminiKeys,
        groqKeys
      });
    } catch (routerError) {
      console.error('[aiFallback] modelRouter.generate failed:', routerError);
      routerResponse = null;
    }

    // Safe destructure — never assume shape, even on a resolved value.
    const result = routerResponse?.result || '';

    const scrubbed = stripLeakedReasoning(result);

    if (scrubbed !== '' && gatekeeperLint(scrubbed).ok) {
      cleanResult = scrubbed;
      break;
    } else if (attempt < MAX_RETRIES) {
      console.warn(`[RETRY] aiFallback attempt ${attempt} blocked by Gatekeeper (leaked reasoning). Retrying...`);
      currentPrompt += `\n\n[SYSTEM WARNING: Your previous output leaked internal reasoning/thinking-process text. Output ONLY the final strategic breakdown — no planning steps, no "Thinking Process" header.]`;
    } else {
      // Exhausted retries — fall back to whatever we scrubbed rather than
      // dropping the response entirely.
      cleanResult = scrubbed;
    }
  }

  // 🛡️ Final failsafe: if every attempt came back empty (router threw every
  // time, or output was always blocked by the gatekeeper), never return ''
  // silently — give the caller a real string they can safely display.
  if (!cleanResult) {
    cleanResult = 'My strategy engine hit a snag pulling that data together — could you ask again in a moment?';
  }

  return cleanResult;
}

module.exports = { askAI, STRATEGY_SYSTEM_INSTRUCTION };
