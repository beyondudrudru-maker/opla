/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI strategy layer. Enforces strict formatting,
 * zero hallucination, and professional diplomatic tone before passing context.
 *
 * 🚀 UPGRADE (this version):
 *   1. STRATEGY_SYSTEM_INSTRUCTION is dynamically built to cut overhead.
 *   2. Deterministic query types check strategyCache FIRST.
 *   3. Open-ended reasoning queries go through the full pipeline.
 *   🛡️ FIX: Added XML sanitization to prevent prompt injection in UserQuestion.
 */

const modelRouter = require('../router/modelRouter.js');
const { stripLeakedReasoning, gatekeeperLint } = require('../postProcessor/leakFilter');
const { compressGameData, deepCompress, fitGameDataToBudget } = require('../promptBuilder/promptAssembler');
const { buildInstruction } = require('./promptInstructions');
const strategyCache = require('../cache/strategyCache');

const GAME_CONTEXT_SOFT_CAP_CHARS = 6000;
const MAX_RETRIES = 2;

// 🛡️ SECURITY: Escapes XML tags to prevent prompt injection breakouts
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Shared retry/gatekeeper loop — used by both the deterministic-explain path
 * and the full-reasoning path so retry/error behavior stays identical.
 */
async function _runWithRetries({ prompt, systemInstruction, classification, userMessage, geminiKeys, groqKeys }) {
  let currentPrompt = prompt;
  let cleanResult = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let routerResponse;
    try {
      routerResponse = await modelRouter.generate({
        classification,
        prompt: currentPrompt,
        userMessage,
        systemInstruction,
        geminiKeys,
        groqKeys
      });
    } catch (routerError) {
      console.error('[aiFallback] modelRouter.generate failed:', routerError);
      routerResponse = null;
    }

    const result = routerResponse?.result || '';
    const scrubbed = stripLeakedReasoning(result);

    if (scrubbed !== '' && gatekeeperLint(scrubbed).ok) {
      cleanResult = scrubbed;
      break;
    } else if (attempt < MAX_RETRIES) {
      console.warn(`[RETRY] aiFallback attempt ${attempt} blocked by Gatekeeper. Retrying...`);
      currentPrompt += `\n\n[SYSTEM WARNING: Your previous output leaked internal reasoning/thinking-process text. Output ONLY the final response — no planning steps.]`;
    } else {
      cleanResult = scrubbed;
    }
  }

  if (!cleanResult) {
    cleanResult = 'My strategy engine hit a snag pulling that data together — could you ask again in a moment?';
  }
  return cleanResult;
}

/**
 * askAI({ userMessage, intent, context, geminiKeys, groqKeys, classification, queryFlags, deterministic })
 */
async function askAI({
  userMessage,
  intent,
  context,
  geminiKeys = [],
  groqKeys = [],
  classification,
  queryFlags = {},
  deterministic = null,
}) {

  // ── FAST PATH: deterministic query the game engine can already answer ──
  if (deterministic && deterministic.queryType) {
    const { hit, result, cacheable } = strategyCache.getDeterministicResult(
      deterministic.queryType,
      deterministic.params || {}
    );

    if (cacheable && result && result.confidence !== 'low') {
      const prompt = strategyCache.buildExplainPrompt(userMessage, result);
      const explained = await _runWithRetries({
        prompt,
        systemInstruction: strategyCache.EXPLAIN_ONLY_INSTRUCTION,
        classification: classification || { intent: intent || 'strategy', category: 'deterministicExplain' },
        userMessage,
        geminiKeys,
        groqKeys,
      });
      console.log(`[aiFallback] deterministic path (${deterministic.queryType}) — cache ${hit ? 'HIT' : 'MISS→cached'}, short-instruction explain used.`);
      return explained;
    }
  }

  // ── FULL PIPELINE: open-ended reasoning over GameData ──
  const compressedContext = context ? deepCompress(compressGameData(context)) : null;
  let gameDataBlock = compressedContext ? JSON.stringify(compressedContext) : 'No exact data found in database.';

  if (compressedContext && gameDataBlock.length > GAME_CONTEXT_SOFT_CAP_CHARS) {
    gameDataBlock = fitGameDataToBudget(compressedContext, GAME_CONTEXT_SOFT_CAP_CHARS);
  }

  const rawContextChars = context ? JSON.stringify(context, null, 2).length : 0;
  console.log(`[aiFallback] GameData size — raw(pretty): ${rawContextChars} chars (~${Math.round(rawContextChars / 4)} tok) -> compressed: ${gameDataBlock.length} chars (~${Math.round(gameDataBlock.length / 4)} tok)`);

  const systemInstruction = buildInstruction(queryFlags);

  // 🛡️ SECURITY FIX: userMessage and intent are now strictly sanitized
  const prompt = `
<UserQuestion>${sanitize(userMessage) || 'Provide a strategic breakdown.'}</UserQuestion>
<UserIntent>${sanitize(intent) || 'strategy'}</UserIntent>

<GameData>
${gameDataBlock}
</GameData>

[INSTRUCTION: Analyze <GameData>. Format using vertical bullet points. EVERY stat on a new line. Bold highlights. Provide a comprehensive, highly logical breakdown. NO MARKDOWN TABLES.]`;

  return _runWithRetries({
    prompt,
    systemInstruction,
    classification: classification || { intent: intent || 'strategy' },
    userMessage,
    geminiKeys,
    groqKeys,
  });
}

module.exports = { askAI, buildInstruction };
