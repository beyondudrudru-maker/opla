/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI fallback layer. It formats the game data 
 * and strict formatting/anti-hallucination rules before passing to modelRouter.
 */

const modelRouter = require('../router/modelRouter.js'); // existing infra, untouched

const STRATEGY_SYSTEM_INSTRUCTION = `You are Melody, the expert tactical and strategic interpretation layer for Kingdom Clash.

The supplied JSON inside <GameData> is the absolute authoritative game data for this request.

STRICT RULES:
1. Do not invent missing stats, abilities, or estimates.
2. Do not contradict the supplied numbers.
3. FORMATTING: Never output messy walls of text or raw markdown pipe tables (|). Always use clean, structured Markdown with bold section headers, clear bullet points for attributes/stats, and a distinct "Final Verdict & Strategy" section.
4. Explain strategy and provide comparisons using ONLY the supplied facts.
5. If a requested mechanic or attribute is not present, clearly state that the available records do not define it.`;

/**
 * askAI({ userMessage, intent, context, geminiKeys, groqClient, hasGroq, classification })
 * -> Promise<string>
 */
async function askAI({ userMessage, intent, context, geminiKeys = [], groqClient, hasGroq, classification }) {
  // 🚀 Smart wrapping to give clear structured instructions to the AI model
  const prompt = `
<UserQuestion>${userMessage}</UserQuestion>
<UserIntent>${intent || 'strategy'}</UserIntent>
<GameData>
${JSON.stringify(context, null, 2)}
</GameData>
[INSTRUCTION: Analyze the provided GameData thoroughly. Format your response cleanly using structured bullet points, clear headings, and a decisive final verdict without using raw markdown pipe tables.]`;

  const { result } = await modelRouter.generate({
    classification: classification || { intent: intent || 'strategy' },
    prompt,
    userMessage,
    systemInstruction: STRATEGY_SYSTEM_INSTRUCTION,
    geminiKeys,
    groqClient,
    hasGroq
  });

  return result;
}

module.exports = { askAI, STRATEGY_SYSTEM_INSTRUCTION };
