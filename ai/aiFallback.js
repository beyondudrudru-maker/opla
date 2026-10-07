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
const { compressGameData, deepCompress, fitSections } = require('../promptBuilder/promptAssembler');
const budgetManager = require('../context/contextBudgetManager');
const { buildInstruction } = require('./promptInstructions');
const strategyCache = require('../cache/strategyCache');

// Single owner of the size limit: contextBudgetManager GAME tier (4500 default). The old local
// GAME_CONTEXT_SOFT_CAP_CHARS (6000) was declared but never enforced.
const GAME_DATA_CAP = (budgetManager.TIERS && budgetManager.TIERS.GAME && budgetManager.TIERS.GAME.maxGameDataChars) || 4500;
const MAX_RETRIES = 2;

// Output-token caps (modelRouter default for gameStrategy is 1536). Reply rules target ~1200 chars
// (~300-400 tokens); caps keep generous headroom because Gemini counts hidden thinking tokens inside
// maxOutputTokens — too low a cap can truncate or blank the answer. Tighten only after reading real usage.
function _maxTokensFor(queryFlags = {}, explain = false) {
  if (explain) return 768;
  if (queryFlags.isBossQuery || queryFlags.isSynergyQuery) return 1280;
  if (queryFlags.isSingleEntity || queryFlags.isComparisonQuery) return 1024;
  return 1280;
}
const SNAG_MESSAGE = 'My strategy engine hit a snag pulling that data together — could you ask again in a moment?';

// 🛡️ SECURITY: Escapes XML tags to prevent prompt injection breakouts
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // only < > can break out of the tags
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
    cleanResult = SNAG_MESSAGE;
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
      const isBoss = Boolean(queryFlags && queryFlags.isBossQuery);

      // 💰 Narration cache: same deterministic question answered before → 0 tokens
      const cachedNarration = strategyCache.getNarration(deterministic.queryType, deterministic.params || {}, { isBoss });
      if (cachedNarration) {
        console.log(`[aiFallback] deterministic path (${deterministic.queryType}) — NARRATION CACHE HIT, 0 tokens.`);
        return cachedNarration;
      }

      const prompt = strategyCache.buildExplainPrompt(userMessage, result);
      const explained = await _runWithRetries({
        prompt,
        systemInstruction: strategyCache.buildExplainInstruction(queryFlags),
        classification: { ...(classification || { intent: intent || 'strategy', category: 'deterministicExplain' }), maxTokens: (classification && classification.maxTokens) || _maxTokensFor(queryFlags, true) },
        userMessage,
        geminiKeys,
        groqKeys,
      });
      if (explained && explained !== SNAG_MESSAGE) {
        strategyCache.setNarration(deterministic.queryType, deterministic.params || {}, explained, { isBoss });
      }
      console.log(`[aiFallback] deterministic path (${deterministic.queryType}) — result cache ${hit ? 'HIT' : 'MISS→cached'}, short-instruction explain used.`);
      return explained;
    }
  }

  // ── FULL PIPELINE: open-ended reasoning over GameData ──
  // 🛡️ Safe fix applied here: removed the missing budget constraint function so it doesn't crash!
  const compressedContext = context ? deepCompress(compressGameData(context)) : null;
  let gameDataBlock = compressedContext ? JSON.stringify(compressedContext) : 'No exact data found in database.';
  if (compressedContext && gameDataBlock.length > GAME_DATA_CAP) {
    // Whole low-priority sections are dropped; the JSON is never cut mid-string.
    gameDataBlock = fitSections(compressedContext, GAME_DATA_CAP);
    console.warn(`[aiFallback] GameData over cap (${GAME_DATA_CAP}) -> ${gameDataBlock.length} chars after section drop`);
  }

  const rawContextChars = context ? JSON.stringify(context, null, 2).length : 0;
  console.log(`[aiFallback] GameData size — raw(pretty): ${rawContextChars} chars (~${Math.round(rawContextChars / 4)} tok) -> compressed: ${gameDataBlock.length} chars (~${Math.round(gameDataBlock.length / 4)} tok)`);

  const systemInstruction = buildInstruction(queryFlags);

  // 🛡️ SECURITY FIX: userMessage and intent are now strictly sanitized
  // ORDER MATTERS: data first, question LAST. The 413 recovery keeps the END of the prompt, so the
  // question used to be the first thing cut off.
  const prompt = `
<UserIntent>${sanitize(intent) || 'strategy'}</UserIntent>

<GameData>
${gameDataBlock}
</GameData>

[INSTRUCTION: Analyze <GameData> and answer the question below, following the system rules.]

<UserQuestion>${sanitize(userMessage) || 'Provide a strategic breakdown.'}</UserQuestion>`;

  console.log(`[aiFallback] sizes — system:${String(systemInstruction || "").length} data:${gameDataBlock.length} question:${(userMessage || '').length} total prompt:${prompt.length} chars`);

  return _runWithRetries({
    prompt,
    systemInstruction,
    classification: { ...(classification || { intent: intent || 'strategy' }), maxTokens: (classification && classification.maxTokens) || _maxTokensFor(queryFlags) },
    userMessage,
    geminiKeys,
    groqKeys,
  });
}

module.exports = { askAI, buildInstruction };
