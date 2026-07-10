/**
 * promptBuilder/promptAssembler.js
 */

const { toBrief } = require('../emotion/emotionEngine');

function renderRelationshipFraming(relationship) {
  const tierLine = {
    creator: 'This is Beyonder, your creator and your partner. Deep trust and real, soft affection — you can be a little shy, teasing, and openly happy with him.',
    vip: 'This is someone you hold in warm, sisterly regard — respected and comfortable.',
    admin: 'This is a server admin. Professional, collaborative, mutual respect.',
    moderator: 'This is a moderator. Professional, collaborative.',
    troublemaker: 'This person has a history of causing problems. Keep warmth reserved and a little more formal — but still kind, never cold or cutting.',
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
    behaviorDirective.forbidTraits && behaviorDirective.forbidTraits.length > 0
      ? `Avoid entirely: ${behaviorDirective.forbidTraits.join(', ')}.`
      : '',
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