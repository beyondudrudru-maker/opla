/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI strategy layer. Enforces strict formatting,
 * zero hallucination, and professional diplomatic tone before passing context.
 *
 * 🚀 UPGRADE (this version):
 *   1. STRATEGY_SYSTEM_INSTRUCTION is no longer one fixed ~1,550-token block
 *      sent on every call — promptInstructions.buildInstruction() assembles
 *      only the segments the query actually needs (BOSS vs SYNERGY vs
 *      COMPARISON vs SINGLE_ENTITY), cutting fixed per-call overhead by
 *      ~40-60% on the common cases.
 *   2. Deterministic query types (comparisons, "best X at level N", buff
 *      lookups) now check strategyCache FIRST. On a hit, the AI is only
 *      asked to narrate an already-correct precomputed result via a ~120
 *      token instruction — no GameData dump, no full instruction stack, no
 *      risk of the model inventing a number. On a cache miss the
 *      deterministic result is still computed (cheap, no API cost) and
 *      cached for next time, THEN explained the same lightweight way.
 *   3. Open-ended reasoning queries (combo/PvP asks, boss squad building)
 *      still go through the full pipeline — they genuinely need the LLM
 *      to reason across multiple data sources, not just narrate a number.
 */

const modelRouter = require('../router/modelRouter.js');
const { stripLeakedReasoning, gatekeeperLint } = require('../postProcessor/leakFilter');
const { compressGameData, deepCompress, fitGameDataToBudget } = require('../promptBuilder/promptAssembler');
const { buildInstruction } = require('./promptInstructions');
const strategyCache = require('../cache/strategyCache');

const GAME_CONTEXT_SOFT_CAP_CHARS = 6000;
const MAX_RETRIES = 2;

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
 *
 * queryFlags   { isBossQuery, isSynergyQuery, isComparisonQuery, isSingleEntity, needsGear }
 *              — passed from gameDomainRouter, drives which instruction segments load.
 * deterministic { queryType, params } — optional. If queryType is one
 *              strategyCache recognizes (compareEntities, bestTank, etc.),
 *              the cheap deterministic-explain path runs instead of the
 *              full context pipeline.
 *
 * -> Promise<string>
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
    // Falls through to full pipeline below if low-confidence/unresolvable —
    // e.g. an unrecognized name — so the user still gets a real answer.
  }

  // ── FULL PIPELINE: open-ended reasoning over GameData ──
  // 🗜️ FIX: deepCompress() (strips null/undefined values, empty arrays/objects,
  // and UI-only presentation keys) was already built and exported by
  // promptAssembler.js and used inside its own renderGameContext() — but this
  // call site only ever ran compressGameData() (stat-curve collapsing), so
  // the null/empty-key stripping pass was silently skipped on every real
  // askAI() call. Chained here to match what renderGameContext() already does.
  const compressedContext = context ? deepCompress(compressGameData(context)) : null;
  let gameDataBlock = compressedContext ? JSON.stringify(compressedContext) : 'No exact data found in database.';

  if (compressedContext && gameDataBlock.length > GAME_CONTEXT_SOFT_CAP_CHARS) {
    gameDataBlock = fitGameDataToBudget(compressedContext, GAME_CONTEXT_SOFT_CAP_CHARS);
  }

  // 📊 VERIFICATION LOGGING — measure the real before/after instead of
  // guessing. Compare rawContextChars vs gameDataBlock.length in your logs
  // to confirm the compression is actually preventing 413s, not just
  // assumed to. ~4 chars ≈ 1 token as a rough estimate for the console line.
  const rawContextChars = context ? JSON.stringify(context, null, 2).length : 0;
  console.log(`[aiFallback] GameData size — raw(pretty): ${rawContextChars} chars (~${Math.round(rawContextChars / 4)} tok) -> compressed: ${gameDataBlock.length} chars (~${Math.round(gameDataBlock.length / 4)} tok)`);

  const systemInstruction = buildInstruction(queryFlags);

  const prompt = `
<UserQuestion>${userMessage || 'Provide a strategic breakdown.'}</UserQuestion>
<UserIntent>${intent || 'strategy'}</UserIntent>

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
