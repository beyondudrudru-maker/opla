/**
 * promptBuilder/promptAssembler.js
 *
 * PURPOSE
 *   The only place that constructs the text actually sent to Gemini beyond
 *   the static systemInstruction. Assembles four distinct blocks in a fixed
 *   order so each concern (identity / state / memory / task) stays legible
 *   and independently tunable.
 *
 * RESPONSIBILITIES
 *   - Render the emotional + relationship brief (natural language, never
 *     raw numbers — see emotionEngine.toBrief).
 *   - Render ranked long-term memory as short bullets.
 *   - Render working memory as a compact transcript.
 *   - Render the explicit task directive (shape instructions from
 *     behaviorEngine + the actual user message).
 *
 * INPUTS
 *   { emotionalState, relationship, behaviorDirective, rankedMemories,
 *     workingMemory, userMessage, speakerName }
 *
 * OUTPUTS
 *   string (the full runtime prompt, appended after systemInstruction)
 *
 * TOKEN BUDGET NOTES
 *   Target ~350-500 tokens total for blocks 2-4 combined. If rankedMemories
 *   or workingMemory push past budget, trim workingMemory first (it's the
 *   most token-heavy and least information-dense block).
 */

const { toBrief } = require('../emotion/emotionEngine');

function renderRelationshipFraming(relationship) {
  const tierLine = {
    creator: 'This is Beyonder, your creator. Deep trust, real affection, still a real person you can tease and worry about.',
    vip: 'This is someone you hold in warm, sisterly regard — respected, comfortable, no need for sass.',
    admin: 'This is a server admin. Professional, collaborative, mutual respect.',
    moderator: 'This is a moderator. Professional, collaborative.',
    troublemaker: 'This person has a history of causing problems. Cold, firm, minimal warmth — but never cruel or petty.',
    regular: 'A familiar member of the community.',
    unknown: 'Someone you have little to no history with — polite, a little reserved, genuinely curious rather than cold.',
  }[relationship.tier] || 'Someone in the server.';

  const familiarityNote = relationship.familiarity > 50
    ? ' You have real shared history with them — feel free to reference past context naturally if relevant.'
    : '';

  return tierLine + familiarityNote;
}

function renderMemoryBlock(rankedMemories) {
  if (!rankedMemories || rankedMemories.length === 0) return '';
  const bullets = rankedMemories.map((m) => `- ${m.content}`).join('\n');
  return `\n[THINGS YOU REMEMBER ABOUT THEM]\n${bullets}`;
}

function renderWorkingMemory(workingMemory) {
  if (!workingMemory || workingMemory.length === 0) return '';
  const lines = workingMemory.map((t) => `${t.role === 'melody' ? 'Melody' : 'User'}: ${t.content}`).join('\n');
  return `\n[RECENT CONVERSATION]\n${lines}`;
}

function renderTaskDirective(behaviorDirective, userMessage) {
  const lengthMap = {
    short: 'Respond briefly — roughly one short sentence or less. Match their energy, do not over-elaborate.',
    medium: "Respond in 2-4 sentences, conversationally.",
    long: 'Give a fully developed, well-structured response — depth is appropriate here.',
  };
  const shape = [
    lengthMap[behaviorDirective.targetLength],
    `Tone: ${behaviorDirective.tone.join(', ')}.`,
    behaviorDirective.emojiBudget > 0
      ? `You may use up to ${behaviorDirective.emojiBudget} emoji if it feels natural, no more.`
      : 'No emojis for this one — stay focused.',
    behaviorDirective.preferReact ? 'Prefer reacting/teasing over directly answering, if that fits.' : '',
    behaviorDirective.askFollowUp ? 'A genuine follow-up question would fit well here.' : '',
  ].filter(Boolean).join(' ');

  return `\n[RESPONSE DIRECTIVE]\n${shape}\n\n[MESSAGE]\n${userMessage}`;
}

function assemble({ emotionalState, relationship, behaviorDirective, rankedMemories, workingMemory, userMessage }) {
  const brief = toBrief(emotionalState, relationship);
  const relationshipFraming = renderRelationshipFraming(relationship);

  return [
    `[CURRENT STATE]\n${brief}\n${relationshipFraming}`,
    renderMemoryBlock(rankedMemories),
    renderWorkingMemory(workingMemory),
    renderTaskDirective(behaviorDirective, userMessage),
  ].filter(Boolean).join('\n');
}

module.exports = { assemble };
