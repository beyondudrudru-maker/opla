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
// Compact system prompt for facet (modular) answers: ~0.7k chars instead of ~7k.
const FACET_INSTRUCTION = `You are Melody, a Kingdom Clash clan assistant. Answer ONLY from <GameData> (a small facet of one hero/troop). Never invent talents, abilities, numbers, heroes or troops.
- Reply in GameData.replyLanguage (Roman Hinglish stays Roman, never Devanagari; English stays English).
- Follow GameData.answerGuide exactly. A facet answer must NOT restate role/talent/ability unless the guide says so.
- GameData.identity says what the entity is: heroes and troops are the player's own units, NEVER bosses. Bosses are only the enemy named in the data. Its talent/ability text is listed in identity — never say a skill is missing or absent when identity lists it.
- Format: short "• **Label** — detail" bullets (4-8), every bullet finished. No headings, no raw ids/field names, no HP/attack stat dumps (a card already shows them).
- Rules: a battle holds 2 heroes in total (a Mythical counts as one of them) and at most 1 Mythical. Harkon and Fire Fury Xana do nothing in boss battles. Pyrotechnician is a low-impact troop for bosses. Bosses resist Melee or Ranged by 30% (rotates per season) — field the opposite type. Boss goal = max damage score, not victory.
- If bossUse is "disabled" or impact is LOW, say so plainly first. Only say data is missing when it truly is absent from GameData.`;
const _facetCache = new Map(); // key -> { text, at }
const FACET_TTL_MS = 12 * 60 * 60 * 1000;

function _maxTokensFor(queryFlags = {}, explain = false) {
  if (queryFlags.isFacet) return 1280;
  // Reasoning models (gpt-oss) spend part of max_tokens on hidden reasoning, so a tight cap CUTS the visible
  // answer mid-sentence. Generous caps cost nothing unless the model actually writes that much.
  if (explain) return 1536;
  if (queryFlags.isBossQuery || queryFlags.isSynergyQuery || queryFlags.isMultiEntity || queryFlags.isListQuery) return 3072;
  return 2560;
}
// If the model is still cut off, never show a dangling "• **" / half sentence: drop the incomplete tail line.
function _trimIncomplete(text) {
  let t = String(text || '').replace(/\s+$/, '');
  t = t.replace(/(?:\n|^)\s*(?:[•\-*]|\d+\.)?\s*\**\s*$/, '').replace(/\s+$/, '');
  const lines = t.split('\n');
  const last = (lines[lines.length - 1] || '').trim();
  if (lines.length > 1 && last.length > 0 && !/[.!?)"'”’\]*~`:🙂-🧿]$/u.test(last) && !/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]$/u.test(last)) {
    lines.pop();
    t = lines.join('\n').replace(/\s+$/, '');
  }
  return t;
}
// Field names the model sometimes echoes from <GameData> ("her combatLine is Backline", "listed in recommendedTroops").
// Prompt rule 9 forbids it, but models still slip, so this is enforced in code (zero tokens).
const FIELD_NAME_WORDS = [
  [/\bcombatLine\b/gi, 'position'], [/\brecommendedTroops\b/gi, 'recommended troops'],
  [/\brecommendedHeroes\b/gi, 'recommended heroes'], [/\bbuffPartners\b/gi, 'partner heroes'],
  [/\btargetCovers\b/gi, 'already covers'], [/\bbossTroopMeta\b/gi, 'boss troop priority'],
  [/\boptimalFormations\b/gi, 'formations'], [/\bheroSynergyIndex\b/gi, 'synergy list'],
  [/\bcomparedAtLevel\b/gi, 'compared level'],
];
function _scrubFieldNames(text) {
  let t = String(text || '');
  for (const [re, plain] of FIELD_NAME_WORDS) t = t.replace(re, plain);
  return t;
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
// Boss-disabled heroes (talent/ability do nothing in boss battles) must never be recommended for bosses.
const _BOSS_BANNED = ['Fire Fury Xana', 'Harkon'];
const _NEG = /(not|never|n't|avoid|disabled|exclude|nahi|nhi|mat\s|skip|no impact|useless|bekar|kaam nahi|doesn)/i;
function _bossViolations(text) {
  const out = [];
  for (const n of _BOSS_BANNED) {
    const re = new RegExp('\\b' + n + '\\b', 'gi'); let m;
    while ((m = re.exec(text))) {
      const win = text.slice(Math.max(0, m.index - 80), m.index + n.length + 80);
      if (!_NEG.test(win)) { out.push(n); break; }
    }
  }
  return out;
}

async function _runWithRetries({ prompt, systemInstruction, classification, userMessage, geminiKeys, groqKeys, isBoss = false }) {
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
      const bad = isBoss ? _bossViolations(scrubbed) : [];
      if (bad.length && attempt < MAX_RETRIES) {
        console.warn(`[RETRY] boss answer recommended boss-disabled hero(es): ${bad.join(', ')}. Retrying once.`);
        currentPrompt += `\n\n[SYSTEM WARNING: ${bad.join(', ')} do NOTHING in boss battles (talent/ability disabled). Do not recommend them for bosses. Rewrite the full answer.]`;
        continue;
      }
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
  return _trimIncomplete(_scrubFieldNames(cleanResult));
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

  // ── FACET CACHE: same entity+facet+language answered before → 0 tokens ──
  const _fk = queryFlags && queryFlags.isFacet && queryFlags.facetCacheKey;
  if (_fk) {
    const c = _facetCache.get(_fk);
    if (c && Date.now() - c.at < FACET_TTL_MS) { console.log(`[aiFallback] FACET CACHE HIT (${_fk}) — 0 tokens.`); return c.text; }
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

  const systemInstruction = queryFlags.isFacet ? FACET_INSTRUCTION : buildInstruction(queryFlags);

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

  const _out = await _runWithRetries({
    prompt,
    systemInstruction,
    classification: { ...(classification || { intent: intent || 'strategy' }), maxTokens: (classification && classification.maxTokens) || _maxTokensFor(queryFlags) },
    userMessage,
    geminiKeys,
    groqKeys,
    isBoss: Boolean(queryFlags && queryFlags.isBossQuery),
  });
  if (_fk && _out && _out !== SNAG_MESSAGE) _facetCache.set(_fk, { text: _out, at: Date.now() });
  return _out;
}

module.exports = { askAI, buildInstruction, _scrubFieldNames, _trimIncomplete };
