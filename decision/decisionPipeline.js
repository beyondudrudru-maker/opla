/**
 * decision/decisionPipeline.js
 *
 * PURPOSE
 *   The central nervous system of the bot. Orchestrates the flow of data 
 *   between engines to build the prompt, while ensuring maximum CPU 
 *   efficiency, parallel database operations, and crash resistance.
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

async function planTurn({
  userId, displayName, roles = [], channelId, content,
  isGroupContext = false, mentions = { everyone: false, users: [] },
}) {
  try {
      // 1. Execute fast, synchronous local tasks first
      const classification = intentClassifier.classify({ content });
      const targetInfo = targetResolver.resolve({ mentions, botUserId: BOT_USER_ID });

      // 2. 🚀 UPGRADE: Fallback safety for State Engines
      const relationship = await relationshipEngine.resolve({ userId, displayName, roles }).catch(() => ({}));
      const emotionalState = await emotionEngine.updateState({
        userId,
        intent: classification.intent,
        relationship,
        isModeration: classification.isModeration,
      }).catch(() => ({ current: 'neutral' })); // Default to neutral if engine fails

      // 3. 🚀 UPGRADE: Bulletproof Parallel Supabase reads
      const [workingMemoryRaw, longTermCandidates] = await Promise.all([
        memoryEngine.getWorkingMemory(channelId).catch(() => []),
        memoryEngine.getLongTermCandidates(userId).catch(() => []),
      ]);

      const workingMemory = contextRanker.filterWorkingMemory({ turns: workingMemoryRaw, currentUserId: userId, isGroupContext });
      
      // Strictly limit to top 6 ranked memories so the prompt never bloats
      const rankedMemories = contextRanker.rankMemories({ currentMessage: content, candidates: longTermCandidates }).slice(0, 6);

      const behaviorDirective = behaviorEngine.decide({
        userId,
        emotionalState,
        intent: classification.intent,
        relationship,
        userMessageLength: content.length,
        isModeration: classification.isModeration,
      });

      // Pre-render the emotion brief so the assembler stays "dumb"
      const emotionalBrief = (typeof emotionEngine.toBrief === 'function') 
        ? emotionEngine.toBrief(emotionalState, relationship) 
        : '';

      const prompt = promptAssembler.assemble({
        emotionalBrief,
        relationship,
        behaviorDirective,
        rankedMemories,
        workingMemory,
        userMessage: content,
        targetInfo,
        speakerName: displayName,
      });

      return { prompt, classification, behaviorDirective, emotionalState, relationship, channelId, userId };
      
  } catch (error) {
      console.error('❌ [PIPELINE ERROR] Critical failure in planTurn:', error);
      throw error; // Bubble up to main event file so it can send a graceful error message to Discord
  }
}

async function finalizeTurn({ channelId, userId, content, responseText }) {
  try {
      // 🚀 UPGRADE: Wrapped in try/catch to ensure saving chat doesn't crash the bot
      await Promise.all([
        memoryEngine.recordTurn({ channelId, userId, role: 'user', content }),
        memoryEngine.recordTurn({ channelId, userId, role: 'melody', content: responseText })
      ]);
  } catch (error) {
      console.error('⚠️ [PIPELINE ERROR] Failed to save turn to Supabase:', error);
  }
}

module.exports = { planTurn, finalizeTurn };
