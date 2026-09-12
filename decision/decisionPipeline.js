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
 *   🚀 UPGRADE: Aggressive pre-compression applied to gameData to save tokens.
 */

const intentClassifier = require('../classifier/intentClassifier');
const relationshipEngine = require('../relationship/relationshipEngine');
const emotionEngine = require('../emotion/emotionEngine');
const memoryEngine = require('../memory/memoryEngine');
const contextRanker = require('../contextRanker/contextRanker');
const behaviorEngine = require('../behavior/behaviorEngine');
const promptAssembler = require('../promptBuilder/promptAssembler');
const targetResolver = require('./targetResolver');

// 🚀 IMPORT COMPRESSION UTILITIES
const { compressGameData, deepCompress } = require('../promptBuilder/promptAssembler');

const BOT_USER_ID = process.env.BOT_USER_ID;
const DB_TIMEOUT_MS = 2500; // 🛡️ Max time to wait for memory fetches before moving on

// ============================================================
// 🚀 GAME TURN DETECTOR
// ============================================================
function isGameTurn({ gameData = null, intent = null } = {}) {
  const hasValidGameData = gameData !== null && Object.keys(gameData).length > 0;
  if (hasValidGameData) return true;
  return ['STRATEGY', 'CALC', 'FACT', 'GOLD', 'GEM'].includes(intent);
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

      const gameTurn = isGameTurn({ gameData, intent: classification.intent });

      if (gameTurn) {
        // 🚀 AGGRESSIVE DATA COMPRESSION: Shrink the payload before assembly
        let optimizedGameData = null;
        if (gameData) {
            optimizedGameData = deepCompress(compressGameData(gameData));
        }

        const prompt = promptAssembler.assemble({
          leanMode: true,
          relationship,
          gameData: optimizedGameData,
          userMessage: content,
          speakerName: displayName,
        });

        console.log(`[PIPELINE TRACE][decisionPipeline] intent=${classification.intent} layers=[intentClassifier,targetResolver,relationshipEngine,promptAssembler(leanMode)]`);

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
        gameData: null, 
        userMessage: content,
        targetInfo,
        speakerName: displayName,
      });

      console.log(`[PIPELINE TRACE][decisionPipeline] intent=${classification.intent} isCasualChat=${isCasualChat} layers=[intentClassifier,targetResolver,relationshipEngine,emotionEngine${!isCasualChat ? ',memoryEngine,contextRanker' : ''},behaviorEngine,promptAssembler]`);

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
