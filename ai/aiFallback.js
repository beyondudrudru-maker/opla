/**
 * ai/aiFallback.js
 *
 * The ONLY place in the game-intelligence pipeline that calls the AI.
 * Reuses the existing router/modelRouter.js (key rotation, circuit
 * breakers, cascading fallback) untouched — this file just builds the
 * strategic-interpretation prompt and system instruction.
 */

const modelRouter = require('../router/modelRouter.js'); // existing infra, not rewritten

const STRATEGY_SYSTEM_INSTRUCTION = `You are the strategic interpretation layer.

The supplied JSON is the authoritative game data for this request.

Do not invent missing stats.
Do not estimate unknown mechanics.
Do not contradict the supplied numbers.
Do not perform calculations that should have been performed by the JS engine.
Explain strategy using only the supplied facts.

If a requested mechanic is not present, clearly say that the available data does not define it.`;

/**
 * askAI({ userMessage, intent, context, geminiKeys, groqClient, hasGroq, classification })
 * -> Promise<string>
 */
async function askAI({ userMessage, intent, context, geminiKeys = [], groqClient, hasGroq, classification }) {
  const prompt = `<UserQuestion>${userMessage}</UserQuestion>\n<GameData>${JSON.stringify(context)}</GameData>`;

  const { result } = await modelRouter.generate({
    classification: classification || { intent: 'strategy' },
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
