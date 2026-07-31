/**
 * promptBuilder/promptAssembler.js
 */

const { toBrief } = require('../emotion/emotionEngine');

function renderRelationshipFraming(relationship) {
  const tierMap = {
    creator: 'Creator/Partner',
    vip: 'VIP/Sisterly',
    admin: 'Admin/Pro',
    moderator: 'Mod/Pro',
    troublemaker: 'Troublemaker/Reserved',
    regular: 'Regular',
    unknown: 'Unknown/Polite',
  };
  
  const tierTag = tierMap[relationship.tier] || 'Member';
  const famTag = relationship.familiarity > 50 ? 'High' : 'Low';

  return `[REL:${tierTag}|FAM:${famTag}]`;
}

function renderMemoryBlock(rankedMemories) {
  if (!rankedMemories || rankedMemories.length === 0) return '';
  return `[LTM:${rankedMemories.map((m) => m.content).join('|')}]`;
}

function renderWorkingMemory(workingMemory) {
  if (!workingMemory || workingMemory.length === 0) return '';
  const lines = workingMemory.map((t) => `${t.role === 'melody' ? 'M' : 'U'}:${t.content}`).join('|');
  return `[WM:${lines}]`;
}

function renderTargetBlock(targetInfo) {
  if (!targetInfo) return '';
  if (targetInfo.addressingEveryone) return `[TARGET:Group]`;
  if (targetInfo.hasThirdPartyTarget) {
    return `[TARGET:${targetInfo.targets.map((t) => t.name).join(',')}]`;
  }
  return '';
}

function renderTaskDirective(behavior, userMessage) {
  const parts = [
    `LEN:${behavior.targetLength}`,
    `TONE:${behavior.tone.join(',')}`,
    `EMOJI:${behavior.emojiBudget}`,
    behavior.preferReact ? 'REACT:Y' : '',
    behavior.askFollowUp ? 'ASK:Y' : '',
    behavior.forbidTraits && behavior.forbidTraits.length > 0 ? `NO:${behavior.forbidTraits.join(',')}` : ''
  ].filter(Boolean).join('|');

  return `[DIR:${parts}]\n\n[MSG] ${userMessage}`;
}

function assemble({ emotionalState, relationship, behaviorDirective, rankedMemories, workingMemory, userMessage, targetInfo }) {
  const brief = toBrief(emotionalState, relationship); 
  const relFraming = renderRelationshipFraming(relationship);

  return [
    brief,
    relFraming,
    renderMemoryBlock(rankedMemories),
    renderWorkingMemory(workingMemory),
    renderTargetBlock(targetInfo),
    renderTaskDirective(behaviorDirective, userMessage)
  ].filter(Boolean).join('\n');
}

module.exports = { assemble };
