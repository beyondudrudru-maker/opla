/**
 * promptBuilder/promptAssembler.js
 *
 * PURPOSE
 *   Final lightweight prompt composer.
 *   No database access, model calls, ranking, or state mutation.
 *   Acts purely as a "dumb" assembler snapping pre-rendered blocks together.
 */

function renderRelationshipFraming(relationship = {}) {
  const tierMap = {
    creator: 'Creator',
    vip: 'VIP',
    admin: 'Admin',
    moderator: 'Moderator',
    troublemaker: 'Reserved',
    regular: 'Regular',
    unknown: 'Polite',
  };

  const tier = tierMap[relationship.tier] || 'Member';
  const familiarity = relationship.familiarity > 50 ? 'High' : 'Low';

  return `[REL:${tier}|FAM:${familiarity}]`;
}

function renderMemoryBlock(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  const content = memories
    .slice(0, 10)
    .map(m => m?.content)
    .filter(Boolean)
    .join('|');

  // 🛡️ SECURITY: Marked untrusted so user memories can't execute prompt injection
  return content ? `[LTM_UNTRUSTED:${content}]` : '';
}

function renderWorkingMemory(workingMemory) {
  if (!Array.isArray(workingMemory) || workingMemory.length === 0) {
    return '';
  }

  const lines = workingMemory
    .slice(-10)
    .map(t => {
      const role = t.role === 'melody' ? 'M' : 'U';
      return `${role}:${t.content}`;
    })
    .join('|');

  // 🛡️ SECURITY: Marked untrusted to prevent conversational hijacking
  return lines ? `[WM_UNTRUSTED:${lines}]` : '';
}

function renderTargetBlock(targetInfo) {
  if (!targetInfo) return '';

  if (targetInfo.addressingEveryone) {
    return '[TARGET:Group]';
  }

  if (targetInfo.hasThirdPartyTarget) {
    // 🛡️ LIMIT: Cap at 5 targets to prevent token bloat from massive Discord mentions
    const targets = (targetInfo.targets || [])
      .slice(0, 5)
      .map(t => t.name)
      .filter(Boolean)
      .join(',');

    return targets ? `[TARGET:${targets}]` : '';
  }

  return '';
}

function renderTaskDirective(behavior = {}) {
  const parts = [
    behavior.targetLength ? `LEN:${behavior.targetLength}` : '',
    Array.isArray(behavior.tone) && behavior.tone.length
      ? `TONE:${behavior.tone.join(',')}`
      : '',
    behavior.emojiBudget ? `EMOJI:${behavior.emojiBudget}` : '',
    behavior.preferReact ? 'REACT:Y' : '',
    behavior.askFollowUp ? 'ASK:Y' : '',
    Array.isArray(behavior.forbidTraits) && behavior.forbidTraits.length
      ? `NO:${behavior.forbidTraits.join(',')}`
      : '',
  ].filter(Boolean);

  return parts.length ? `[DIR:${parts.join('|')}]` : '';
}

function assemble({
  emotionalBrief, // String pre-calculated in decisionPipeline
  relationship,
  behaviorDirective,
  rankedMemories,
  workingMemory,
  userMessage,
  targetInfo,
}) {
  return [
    emotionalBrief,
    renderRelationshipFraming(relationship),
    renderMemoryBlock(rankedMemories),
    renderWorkingMemory(workingMemory),
    renderTargetBlock(targetInfo),
    renderTaskDirective(behaviorDirective),
    `[MSG] ${userMessage}`,
  ]
    .filter(Boolean) // Instantly removes any empty blocks to save tokens
    .join('\n');
}

module.exports = {
  assemble,
};
