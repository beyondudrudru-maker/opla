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
  const relationship = await relationshipEngine.resolve({ userId, displayName, roles });
  const classification = intentClassifier.classify({ content });

  const emotionalState = await emotionEngine.updateState({
    userId,
    intent: classification.intent,
    relationship,
    isModeration: classification.isModeration,
  });

  const [workingMemoryRaw, longTermCandidates] = await Promise.all([
    memoryEngine.getWorkingMemory(channelId),
    memoryEngine.getLongTermCandidates(userId),
  ]);

  const workingMemory = contextRanker.filterWorkingMemory({ turns: workingMemoryRaw, currentUserId: userId, isGroupContext });
  const rankedMemories = contextRanker.rankMemories({ currentMessage: content, candidates: longTermCandidates });

  const targetInfo = targetResolver.resolve({ mentions, botUserId: BOT_USER_ID });

  const behaviorDirective = behaviorEngine.decide({
    userId,
    emotionalState,
    intent: classification.intent,
    relationship,
    userMessageLength: content.length,
    isModeration: classification.isModeration,
  });

  const prompt = promptAssembler.assemble({
    emotionalState,
    relationship,
    behaviorDirective,
    rankedMemories,
    workingMemory,
    userMessage: content,
    targetInfo,
    speakerName: displayName,
  });

  return { prompt, classification, behaviorDirective, emotionalState, relationship, channelId, userId };
}

async function finalizeTurn({ channelId, userId, content, responseText }) {
  await memoryEngine.recordTurn({ channelId, userId, role: 'user', content });
  await memoryEngine.recordTurn({ channelId, userId, role: 'melody', content: responseText });
}

module.exports = { planTurn, finalizeTurn };