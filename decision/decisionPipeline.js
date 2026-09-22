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
 *   🛡️ FIX: Passed `intent` to promptAssembler to activate Dynamic Persona Muting.
 *   🧠 UPGRADE: Wired in contextBudgetManager — every decision about how much
 *   long-term memory, chat summary, working-memory window, and final prompt
 *   ceiling to use now comes from ONE place instead of scattered flags.
 */

const intentClassifier = require('../classifier/intentClassifier');
const relationshipEngine = require('../relationship/relationshipEngine');
const emotionEngine = require('../emotion/emotionEngine');
const memoryEngine = require('../memory/memoryEngine');
const contextRanker = require('../contextRanker/contextRanker');
const behaviorEngine = require('../behavior/behaviorEngine');
const promptAssembler = require('../promptBuilder/promptAssembler');
const targetResolver = require('./targetResolver');
const budgetManager = require('../context/contextBudgetManager');

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

      // 🧠 BUDGET DECISION: single source of truth for how much history/memory
      // this specific turn deserves. Now that real classification is available
      // (unlike index.js's early content-only estimate), this is the authoritative
      // profile for the rest of planTurn.
      const budgetProfile = budgetManager.getBudgetProfile({
        content,
        intent: classification.intent,
        isGameTurn: gameTurn,
        isModeration: classification.isModeration,
      });
      budgetManager.traceBudget(budgetProfile, { channelId, userId });

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
          intent: classification.intent, // 🛡️ FIX: Passed intent for Dynamic Persona Muting
          leanMode: true,
          relationship,
          gameData: optimizedGameData,
          userMessage: content,
          speakerName: displayName,
          recentChatLog,
          maxPromptChars: budgetProfile.maxPromptChars
        });

        console.log(`[PIPELINE TRACE] intent=${classification.intent} trigger="${classification.triggerWord}" route=GameFastLane tier=${budgetProfile.tier}`);

        return { prompt, classification, behaviorDirective: null, emotionalState: null, relationship, channelId, userId };
      }

      // --- FULL SOCIAL/BANTER PATH ---
      // 🚀 UPGRADE: Wraps around ONE authority (budgetProfile) instead of an
      // isCasualChat flag computed separately — the budget manager already
      // folds in word-count + intent to decide whether this turn is casual.

      // 🚀 UPGRADE: Run Emotion calculation and Long-Term Memory fetch in PARALLEL
      const emotionalStatePromise = emotionEngine.updateState({
        userId,
        intent: classification.intent,
        relationship,
        isModeration: classification.isModeration,
      }).catch(() => ({ current: 'neutral' }));

      // Only search deep long-term memory if the budget profile allows it for this tier
      const longTermPromise = budgetProfile.useLongTermMemory
        ? withTimeout(memoryEngine.getLongTermCandidates(userId), DB_TIMEOUT_MS, [], 'getLongTermCandidates')
        : Promise.resolve([]);

      // Await all parallel promises together
      const [emotionalState, workingMemoryRaw, longTermCandidates] = await Promise.all([
          emotionalStatePromise,
          workingMemoryPromise,
          longTermPromise
      ]);

      // Process and Rank Memories
      const workingMemory = contextRanker
        .filterWorkingMemory({ turns: workingMemoryRaw, currentUserId: userId, isGroupContext })
        .slice(-budgetProfile.maxWorkingMemoryTurns);

      const rankedMemories = budgetProfile.rankedMemoryCount > 0
        ? contextRanker.rankMemories({ currentMessage: content, candidates: longTermCandidates }).slice(0, budgetProfile.rankedMemoryCount)
        : [];

      let chatSummary = "";
      if (budgetProfile.useChatSummary && workingMemoryRaw && workingMemoryRaw.length >= 3) {
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
        intent: classification.intent, // 🛡️ FIX: Passed intent for Dynamic Persona Muting
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
        recentChatLog,
        maxPromptChars: budgetProfile.maxPromptChars
      });

      // 🚀 UPGRADE: Expose the trigger word AND the budget tier to your pipeline logs
      console.log(`[PIPELINE TRACE] intent=${classification.intent} trigger="${classification.triggerWord}" tier=${budgetProfile.tier} layers=[classifier,target,relationship,emotion,memory,behavior,assembler]`);

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
