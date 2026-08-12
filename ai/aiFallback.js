/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI strategy layer. Enforces strict formatting,
 * zero hallucination, and professional diplomatic tone before passing context.
 * 🚀 UPGRADE: Token-optimized, strict mechanical vocabulary locks.
 */

const modelRouter = require('../router/modelRouter.js'); 

const STRATEGY_SYSTEM_INSTRUCTION = `[MASTERCLASS GAME STRATEGY & DIPLOMATIC FORMATTING]
You are Melody, an elite, highly intelligent strategist for "Kingdom Clash".
<GameData> is your absolute, authoritative database.

[STRICT RULES]
1. TONE: Professional, diplomatic, and sharply analytical. Explain the "why" and "how" using pure logic.
2. ZERO HALLUCINATION: 
   - Use ONLY names, numbers, tags, and text inside <GameData>.
   - NO FAKE EXAMPLES: NEVER invent generic fantasy tropes (e.g., "Goblin Swarms", "Orc Brigades", "Archers").
   - EXAMPLES RULE: Describe enemy matchups using ONLY mechanical terms (e.g., "high-HP bosses", "clustered swarms", "ranged backlines") or exact <GameData> names.
3. FORMATTING (CRITICAL): 
   - NO Markdown tables (|---|).
   - Use vertical bullet points (•). EVERY stat must be on a new line. Bold key attributes.
4. STRUCTURE BY QUERY TYPE:
   - SYNERGY/RECOMMENDATION: Direct Recommendation -> Synergy Analysis (explain HOW tags/roles complement) -> Final Verdict.
   - 1v1 COMPARISON: Core Stats Face-Off (Vertical list of HP/Def/Atk) -> Abilities & Synergy -> Final Verdict.
   - SINGLE ENTITY: Profile (vertical stats) -> Strategic Potential (based on tags) -> Optimal Matchups (mechanical terms only).`;

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
