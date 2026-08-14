/**
 * decision/decisionPipeline.js
 *
 * PURPOSE
 *   The central nervous system of the bot. Orchestrates the flow of data
 *   between engines to build the prompt, while ensuring maximum CPU
 *   efficiency, parallel database operations, and crash resistance.
 *   🚀 UPGRADE: Added "VS Banter Guard" to prevent general knowledge 
 *   comparisons (e.g., Apple vs Android) from getting trapped in the game lane.
 *   🚀 UPGRADE: Nullified gameData payload on non-game turns to prevent 413 errors.
 */

const intentClassifier = require('../classifier/intentClassifier');
const relationshipEngine = require('../relationship/relationshipEngine');
const emotionEngine = require('../emotion/emotionEngine');
const memoryEngine = require('../memory/memoryEngine');
const contextRanker = require('../contextRanker/contextRanker');
const behaviorEngine = require('../behavior/behaviorEngine');
const promptAssembler = require('../promptBuilder/promptAssembler');
const targetResolver = require('./targetResolver');

const BOT_USER_ID = process.env.BOT_USER_ID;
const DB_TIMEOUT_MS = 2500; // 🛡️ Max time to wait for memory fetches before moving on

// ============================================================
// 🚀 SMART EMBEDDED GAME TURN DETECTOR
// ============================================================
const GAME_KEYWORD_FALLBACK = /\b(stats|hp|damage|hero|troop|game|clash|synergy|best with|use with)\b/i;
const CASUAL_GREETINGS_REGEX = /\b(khabar|khana|kha liya|kya haal|hello|hi|hey|sup|wassup|gm|gn|kaise ho|batao)\b/i;
const VS_FALSE_POSITIVE_REGEX = /\b(vs\.?|versus|compare)\b/i; // 🚀 ADDED TO CATCH VS TRAP

function isGameTurn({ content = '', gameData = null, intent = null } = {}) {
  const hasGameKeywords = GAME_KEYWORD_FALLBACK.test(content);
  const hasValidGameData = gameData !== null && Object.keys(gameData).length > 0;

  // 🧠 1. Casual Greeting Guard: Reject fast-lane entry for pure greetings
  if (CASUAL_GREETINGS_REGEX.test(content) && !hasGameKeywords) {
    return false;
  }

  // 🧠 2. THE "VS" BANTER TRAP GUARD (Fix for Apple vs Android)
  // If the query contains "vs" but has NO game keywords and NO valid game data 
  // fetched by the router, it is a general knowledge comparison. Route to General AI.
  if (VS_FALSE_POSITIVE_REGEX.test(content) && !hasGameKeywords && !hasValidGameData) {
    return false;
  }

  // 🧠 3. GENERAL-KNOWLEDGE GUARD (Fix for "Lord Ram ka weapon" trap)
  // FACT/STRATEGY-style intents can also fire for pure general-knowledge
  // questions that just happen to sound like a query ("sabse powerful
  // weapon konsa tha"). Only trust these intents as game-lane triggers when
  // there's real game signal — either a keyword hit or gameData the router
  // actually resolved. No signal + no data = it's a real-world question,
  // route it to the full persona path instead of the strict data-lock lane.
  if (['STRATEGY', 'CALC', 'FACT', 'GOLD', 'GEM'].includes(intent) && !hasGameKeywords && !hasValidGameData) {
    return false;
  }

  // 4. Fast-lane approvals
  if (hasValidGameData) return true;
  if (['STRATEGY', 'CALC', 'FACT', 'GOLD', 'GEM'].includes(intent)) return true;

  return hasGameKeywords;
}

// 🛡️ Helper function to prevent database hangs from freezing the bot
function withTimeout(promise, ms, fallbackValue) {
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallbackValue), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

async function planTurn({
  userId, displayName, roles = [], channelId, content,
  isGroupContext = false, mentions = { everyone: false, users: [] },
  gameData = null // 🚀 Accepts game data context from the router
}) {
  try {
      // 1. Execute fast, synchronous local tasks first
      const classification = intentClassifier.classify({ content });
      const targetInfo = targetResolver.resolve({ mentions, botUserId: BOT_USER_ID });

      // 🚀 GAME FAST-LANE: relationship framing is still cheap/useful for tone
      const relationship = await relationshipEngine.resolve({ userId, displayName, roles }).catch(() => ({}));

      const gameTurn = isGameTurn({ content, gameData, intent: classification.intent });

      if (gameTurn) {
        const prompt = promptAssembler.assemble({
          leanMode: true,
          relationship,
          gameData,
          userMessage: content,
          speakerName: displayName,
        });

        return {
          prompt,
          classification,
          behaviorDirective: null,
          emotionalState: null,
          relationship,
          channelId,
          userId,
        };
      }

      // --- FULL PATH (Social / Banter / General Tasks) ---

      const emotionalState = await emotionEngine.updateState({
        userId,
        intent: classification.intent,
        relationship,
        isModeration: classification.isModeration,
      }).catch(() => ({ current: 'neutral' }));

      const isCasualChat = classification.intent === 'banter' || classification.intent === 'social' || classification.intent === 'UNKNOWN';

      let workingMemory = [];
      let rankedMemories = [];

      // 2. 🚀 Bulletproof Parallel Supabase reads with Strict Timeouts & Isolation
      if (!isCasualChat) {
          const [workingMemoryRaw, longTermCandidates] = await Promise.all([
            withTimeout(memoryEngine.getWorkingMemory(channelId), DB_TIMEOUT_MS, []),
            withTimeout(memoryEngine.getLongTermCandidates(userId), DB_TIMEOUT_MS, [])
          ]);

          workingMemory = contextRanker.filterWorkingMemory({ turns: workingMemoryRaw, currentUserId: userId, isGroupContext });
          rankedMemories = contextRanker.rankMemories({ currentMessage: content, candidates: longTermCandidates }).slice(0, 6);
      }

      const behaviorDirective = behaviorEngine.decide({
        userId,
        emotionalState,
        intent: classification.intent,
        relationship,
        userMessageLength: content.length,
        isModeration: classification.isModeration,
      });

      const emotionalBrief = (typeof emotionEngine.toBrief === 'function')
        ? emotionEngine.toBrief(emotionalState, relationship)
        : '';

      // 3. Assemble the final prompt
      const prompt = promptAssembler.assemble({
        emotionalBrief,
        relationship,
        behaviorDirective,
        rankedMemories,
        workingMemory,
        // 🚀 THE FIX: Nullify heavy game data for casual chat to prevent 413 Payload Errors!
        gameData: gameTurn ? gameData : null, 
        userMessage: content,
        targetInfo,
        speakerName: displayName,
      });

      return { prompt, classification, behaviorDirective, emotionalState, relationship, channelId, userId };

  } catch (error) {
      console.error('❌ [PIPELINE ERROR] Critical failure in planTurn:', error);
      throw error;
  }
}

async function finalizeTurn({ channelId, userId, content, responseText }) {
  try {
      await Promise.all([
        memoryEngine.recordTurn({ channelId, userId, role: 'user', content }),
        memoryEngine.recordTurn({ channelId, userId, role: 'melody', content: responseText })
      ]);
  } catch (error) {
      console.error('⚠️ [PIPELINE ERROR] Failed to save turn to Supabase:', error);
  }
}

module.exports = { planTrust: planTurn, planTurn, finalizeTurn, isGameTurn };
