/**
 * decision/decisionPipeline.js
 *
 * PURPOSE
 *   The per-turn orchestrator. Implements the reasoning sequence:
 *   Observe -> Identify Speaker -> Classify Intent -> Evaluate Relationship
 *   -> Update Emotion -> Retrieve & Rank Memory -> Decide Behavior ->
 *   Assemble Prompt -> (caller generates) -> Post-process -> Persist.
 *
 *   Every step is deterministic code. Only the "generate" step (owned by
 *   api/gemini.js via router/modelRouter) touches the LLM. This is the
 *   concrete embodiment of "code decides what Melody knows, the LLM
 *   decides how she expresses it."
 *
 * INPUTS
 *   { userId, displayName, roles, channelId, content, isGroupContext }
 *
 * OUTPUTS
 *   { prompt: string, classification, behaviorDirective, emotionalState,
 *     relationship, channelId, userId }
 *   (the caller feeds `prompt` into modelRouter.generate, then calls
 *    finalizeTurn with the resulting text)
 *
 * FUTURE SCALABILITY
 *   This function is intentionally the single choke point for orchestration
 *   logic — new subsystems (e.g. a "topic tracker") should be added as a
 *   step here, not scattered across api/gemini.js.
 */

const intentClassifier = require('../classifier/intentClassifier');
const relationshipEngine = require('../relationship/relationshipEngine');
const emotionEngine = require('../emotion/emotionEngine');
const memoryEngine = require('../memory/memoryEngine');
const contextRanker = require('../contextRanker/contextRanker');
const behaviorEngine = require('../behavior/behaviorEngine');
const promptAssembler = require('../promptBuilder/promptAssembler');

async function planTurn({ userId, displayName, roles = [], channelId, content, isGroupContext = false }) {
  // 1. Observe (content already given) + 2. Identify speaker via relationship resolve
  const relationship = await relationshipEngine.resolve({ userId, displayName, roles });

  // 3. Classify intent
  const classification = intentClassifier.classify({ content });

  // 4/5. Update emotional state (relationship-informed target, time-decayed blend)
  const emotionalState = await emotionEngine.updateState({
    userId,
    intent: classification.intent,
    relationship,
    isModeration: classification.isModeration,
  });

  // 6. Retrieve memory candidates
  const [workingMemoryRaw, longTermCandidates] = await Promise.all([
    memoryEngine.getWorkingMemory(channelId),
    memoryEngine.getLongTermCandidates(userId),
  ]);

  // 7. Rank/filter context (this is the "never send 20 raw messages" fix)
  const workingMemory = contextRanker.filterWorkingMemory({ turns: workingMemoryRaw, currentUserId: userId, isGroupContext });
  const rankedMemories = contextRanker.rankMemories({ currentMessage: content, candidates: longTermCandidates });

  // 8. Behavior selection (emotion -> shape, never emotion -> text directly)
  const behaviorDirective = behaviorEngine.decide({
    emotionalState,
    intent: classification.intent,
    relationship,
    userMessageLength: content.length,
    isModeration: classification.isModeration,
  });

  // 9. Assemble the runtime prompt (identity core is applied separately as systemInstruction)
  const prompt = promptAssembler.assemble({
    emotionalState,
    relationship,
    behaviorDirective,
    rankedMemories,
    workingMemory,
    userMessage: content,
  });

  return { prompt, classification, behaviorDirective, emotionalState, relationship, channelId, userId };
}

async function finalizeTurn({ channelId, userId, content, responseText }) {
  await memoryEngine.recordTurn({ channelId, userId, role: 'user', content });
  await memoryEngine.recordTurn({ channelId, userId, role: 'melody', content: responseText });
}

module.exports = { planTurn, finalizeTurn };
