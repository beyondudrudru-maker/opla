/**
 * decision/decisionPipeline.js
 *
 * PURPOSE
 *   The central nervous system of the bot. Orchestrates the flow of data
 *   between engines to build the prompt, while ensuring maximum CPU
 *   efficiency, parallel database operations, and crash resistance.
 *   🚀 UPGRADE: Parallelized engine execution for ultra-fast response times.
 *   🚀 UPGRADE: Timeout Transparency - `withTimeout` now logs when operations lag.
 *   🚀 UPGRADE: Trigger Word Tracing - Pipeline logs now reveal exact classifier triggers.
 *   🛡️ FIX: Passed `content` to getWorkingMemory to activate Keyword Overlap Pruning.
 */

const intentClassifier = require('../classifier/intentClassifier');
const relationshipEngine = require('../relationship/relationshipEngine');
const emotionEngine = require('../emotion/emotionEngine');
const memoryEngine = require('../memory/memoryEngine');
const contextRanker = require('../contextRanker/contextRanker');
const behaviorEngine = require('../behavior/behaviorEngine');
const promptAssembler = require('../promptBuilder/promptAssembler');
const targetResolver = require('./targetResolver');

const { compressGameData, deepCompress } = require('../promptBuilder/promptAssembler');

const BOT_USER_ID = process.env.BOT_USER_ID;
const DB_TIMEOUT_MS = 2500;

function isGameTurn({ gameData = null, intent = null } = {}) {
  const hasValidGameData = gameData !== null && Object.keys(gameData).length > 0;
  if (hasValidGameData) return true;
  return ['STRATEGY', 'CALC', 'FACT', 'GOLD', 'GEM'].includes(intent);
}

// 🚀 UPGRADE: Enhanced timeout wrapper with visibility logging
function withTimeout(promise, ms, fallbackValue, operationName = 'Operation') {
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(`⚠️ [PIPELINE TIMEOUT] ${operationName} exceeded ${ms}ms. Using fallback.`);
      resolve(fallbackValue);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

async function planTurn({
  userId, displayName, roles = [], channelId, content,
  isGroupContext = false, mentions = { everyone: false, users: [] },
  gameData = null, 
  recentChatLog = null
}) {
  try {
      // 1. Fast Synchronous Operations
      const classification = intentClassifier.classify({ content });
      const targetInfo = targetResolver.resolve({ mentions, botUserId: BOT_USER_ID });
      const gameTurn = isGameTurn({ gameData, intent: classification.intent });

      // 🛡️ FIX: Passed `content` so the memory engine can match keywords!
      const workingMemoryPromise = withTimeout(
        memoryEngine.getWorkingMemory(channelId, content), 
        DB_TIMEOUT_MS, 
        [], 
        'getWorkingMemory'
      );

      // Resolve relationship (needed for emotion engine)
      const relationship = await relationshipEngine.resolve({ userId, displayName, roles }).catch(() => ({}));

      // --- GAME FAST-LANE ---
      if (gameTurn) {
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
          recentChatLog 
        });

        console.log(`[PIPELINE TRACE] intent=${classification.intent} trigger="${classification.triggerWord}" route=GameFastLane`);

        return { prompt, classification, behaviorDirective: null, emotionalState: null, relationship, channelId, userId };
      }

      // --- FULL SOCIAL/BANTER PATH ---
      const isCasualChat = classification.intent === 'banter' || classification.intent === 'social' || classification.intent === 'UNKNOWN';

      // 🚀 UPGRADE: Run Emotion calculation and Long-Term Memory fetch in PARALLEL
      const emotionalStatePromise = emotionEngine.updateState({
        userId,
        intent: classification.intent,
        relationship,
        isModeration: classification.isModeration,
      }).catch(() => ({ current: 'neutral' }));

      // Only search deep long-term memory if it's not casual chat
      const longTermPromise = !isCasualChat 
        ? withTimeout(memoryEngine.getLongTermCandidates(userId), DB_TIMEOUT_MS, [], 'getLongTermCandidates')
        : Promise.resolve([]);

      // Await all parallel promises together
      const [emotionalState, workingMemoryRaw, longTermCandidates] = await Promise.all([
          emotionalStatePromise,
          workingMemoryPromise,
          longTermPromise
      ]);

      // Process and Rank Memories
      const workingMemory = contextRanker.filterWorkingMemory({ turns: workingMemoryRaw, currentUserId: userId, isGroupContext });
      const rankedMemories = !isCasualChat ? contextRanker.rankMemories({ currentMessage: content, candidates: longTermCandidates }).slice(0, 6) : [];

      let chatSummary = "";
      if (!isCasualChat && workingMemoryRaw && workingMemoryRaw.length >= 3) {
          chatSummary = await withTimeout(
              memoryEngine.generateChatSummary(workingMemoryRaw), 
              DB_TIMEOUT_MS, 
              "",
              'generateChatSummary'
          );
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

      const prompt = promptAssembler.assemble({
        emotionalBrief,
        relationship,
        behaviorDirective,
        rankedMemories,
        workingMemory,
        chatSummary,
        gameData: null, 
        userMessage: content,
        targetInfo,
        speakerName: displayName,
        recentChatLog
      });

      // 🚀 UPGRADE: Expose the trigger word to your pipeline logs
      console.log(`[PIPELINE TRACE] intent=${classification.intent} trigger="${classification.triggerWord}" isCasual=${isCasualChat} layers=[classifier,target,relationship,emotion,memory,behavior,assembler]`);

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

module.exports = { planTurn, finalizeTurn, isGameTurn };
