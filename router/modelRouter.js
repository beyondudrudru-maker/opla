/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Chooses between Gemini 3.5 Flash and 3.1 Flash-Lite using the unified
 *   IntentClassifier output instead of ad-hoc keyword lists duplicated
 *   across the codebase. Keeps the try/catch fallback-to-Lite safety net
 *   from the original design — that part was already correct.
 *
 * RESPONSIBILITIES
 *   - Map {intent, complexity, isModeration} -> model choice.
 *   - Provide a confidence-based escalation path for ambiguous cases.
 *   - Own the fallback-on-error behavior.
 *
 * INPUTS
 *   { intent, complexity, confidence, isModeration }, prompt, models
 *
 * OUTPUTS
 *   { result, modelUsed: 'flash'|'lite' }
 *
 * FUTURE SCALABILITY
 *   Token-budget and latency-aware routing (e.g. degrade to Lite under
 *   rate-limit pressure) can be added here without touching any other
 *   module — this is the only place that knows about model identities.
 */

const { INTENTS } = require('../classifier/intentClassifier');

const ROUTE_TO_FLASH = new Set([INTENTS.HEAVY_TASK, INTENTS.MODERATION, INTENTS.COMMAND, INTENTS.EMOTIONAL_DISCLOSURE]);

function chooseModel({ intent, confidence }) {
  if (ROUTE_TO_FLASH.has(intent)) return 'flash';
  if (intent === INTENTS.BANTER) return 'lite';
  // Ambiguous/low-confidence -> default to Lite for speed/cost, the caller
  // may escalate post-hoc if the Lite response looks generic.
  if (confidence < 0.5) return 'lite';
  return 'lite';
}

async function generate({ classification, prompt, flashModel, liteModel }) {
  const modelChoice = chooseModel(classification);
  const primary = modelChoice === 'flash' ? flashModel : liteModel;
  const fallback = modelChoice === 'flash' ? liteModel : liteModel;

  try {
    const result = await primary.generateContent(prompt);
    return { result, modelUsed: modelChoice };
  } catch (err) {
    console.error(`⚠️ [ROUTER] ${modelChoice} failed (${err.message}), falling back to lite.`);
    const result = await fallback.generateContent(prompt);
    return { result, modelUsed: 'lite-fallback' };
  }
}

module.exports = { chooseModel, generate };
