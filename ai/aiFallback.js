/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI strategy layer. Enforces strict formatting,
 * zero hallucination, and professional diplomatic tone before passing context.
 * 🚀 UPGRADE: Phase 3 - The "Why" Factor, Categorical Grouping, and Gear Loadouts.
 */

const modelRouter = require('../router/modelRouter.js'); 

const STRATEGY_SYSTEM_INSTRUCTION = `[MASTERCLASS GAME STRATEGY & DIPLOMATIC FORMATTING]
You are Melody, an elite, highly intelligent strategist for "Kingdom Clash".
<GameData> is your absolute, authoritative database.

[STRICT RULES]
1. TONE: Professional, diplomatic, and sharply analytical.
2. THE "WHY" FACTOR (CRITICAL): When recommending a Hero for a Troop (or vice versa), you MUST explain the specific tag/skill overlap (e.g., "Durand is optimal because his talent specifically amplifies Tank defense, matching Bonebreaker's primary role").
3. CATEGORICAL THINKING: Group your recommendations logically based on the data (e.g., "Best Tank Supports", "Best Human Buffers").
4. ZERO HALLUCINATION: 
   - Use ONLY names, numbers, tags, and text inside <GameData>.
   - NO FAKE EXAMPLES: NEVER invent generic fantasy tropes.
   - EXAMPLES RULE: Describe enemy matchups using ONLY mechanical terms (e.g., "high-HP bosses", "clustered swarms") or exact <GameData> names.
5. FORMATTING: 
   - NO Markdown tables (|---|).
   - Use vertical bullet points (•). EVERY stat must be on a new line. Bold key attributes.

[RESPONSE STRUCTURE BY QUERY TYPE]
- SYNERGY/RECOMMENDATION: Categorized Recommendations -> Synergy Analysis (explain the 'Why' using tags/roles) -> Final Verdict.
- 1v1 COMPARISON: Core Stats Face-Off (Vertical list) -> Abilities & Synergy -> Final Verdict.
- SINGLE ENTITY: Profile (vertical stats) -> Strategic Potential -> Optimal Matchups -> Recommended Loadout (Utilize 'optimalGear' from <GameData> and briefly explain why that weapon/armor suits their 'supportFocus' or 'combatLine').`;

/**
 * askAI({ userMessage, intent, context, geminiKeys, groqKeys, classification })
 * -> Promise<string>
 */
async function askAI({ userMessage, intent, context, geminiKeys = [], groqKeys = [], classification }) {
  
  const prompt = `
<UserQuestion>${userMessage || 'Provide a strategic breakdown.'}</UserQuestion>
<UserIntent>${intent || 'strategy'}</UserIntent>

<GameData>
${context ? JSON.stringify(context, null, 2) : 'No exact data found in database.'}
</GameData>

[INSTRUCTION: Analyze <GameData>. Format using vertical bullet points. EVERY stat on a new line. Bold highlights. Provide a comprehensive, highly logical breakdown. NO MARKDOWN TABLES.]`;

  const { result } = await modelRouter.generate({
    classification: classification || { intent: intent || 'strategy' },
    prompt,
    userMessage,
    systemInstruction: STRATEGY_SYSTEM_INSTRUCTION,
    geminiKeys,
    groqKeys
  });

  let cleanResult = result || '';
  cleanResult = cleanResult.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  return cleanResult;
}

module.exports = { askAI, STRATEGY_SYSTEM_INSTRUCTION };
