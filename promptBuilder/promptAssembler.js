/**
 * promptBuilder/promptAssembler.js
 *
 * PURPOSE
 *   Final lightweight prompt composer.
 *   Acts purely as a "dumb" assembler snapping pre-rendered blocks together.
 *   🚀 UPGRADE: Uses XML tags which 3rd Gen Models (Gemini 3.5/3.6 & Llama 3) process with near-perfect accuracy.
 */

// 🛡️ SECURITY: Strips XML tags from user input to prevent prompt injection hijacking
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>]/g, '');
}

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

  return `<UserContext tier="${tier}" familiarity="${familiarity}" />`;
}

function renderMemoryBlock(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  const content = memories
    .slice(0, 10)
    .map(m => sanitize(m?.content))
    .filter(Boolean)
    .join(' | ');

  return content ? `<LongTermMemory>${content}</LongTermMemory>` : '';
}

function renderWorkingMemory(workingMemory) {
  if (!Array.isArray(workingMemory) || workingMemory.length === 0) return '';

  const lines = workingMemory
    .slice(-10)
    .map(t => {
      const role = t.role === 'melody' ? 'AI' : 'User';
      return `${role}: ${sanitize(t.content)}`;
    })
    .join('\n');

  return lines ? `<RecentChatHistory>\n${lines}\n</RecentChatHistory>` : '';
}

function renderTargetBlock(targetInfo) {
  if (!targetInfo) return '';

  if (targetInfo.addressingEveryone) {
    return '<AudienceTarget>Group (Everyone)</AudienceTarget>';
  }

  if (targetInfo.hasThirdPartyTarget) {
    const targets = (targetInfo.targets || [])
      .slice(0, 5)
      .map(t => sanitize(t.name))
      .filter(Boolean)
      .join(', ');

    return targets ? `<AudienceTarget>${targets}</AudienceTarget>` : '';
  }

  return '';
}

function renderTaskDirective(behavior = {}) {
  const directives = [];
  
  if (behavior.targetLength) directives.push(`Length: ${behavior.targetLength}`);
  if (Array.isArray(behavior.tone) && behavior.tone.length) directives.push(`Tone: ${behavior.tone.join(', ')}`);
  if (behavior.emojiBudget) directives.push(`Max Emojis: ${behavior.emojiBudget}`);
  if (behavior.preferReact) directives.push(`Action: Acknowledge politely`);
  if (behavior.askFollowUp) directives.push(`Action: End with an engaging question`);
  if (Array.isArray(behavior.forbidTraits) && behavior.forbidTraits.length) directives.push(`AVOID: ${behavior.forbidTraits.join(', ')}`);

  return directives.length ? `<BehaviorDirectives>\n${directives.join('\n')}\n</BehaviorDirectives>` : '';
}

function assemble({
  emotionalBrief,
  relationship,
  behaviorDirective,
  rankedMemories,
  workingMemory,
  userMessage,
  targetInfo,
  speakerName
}) {
  // Assemble the blocks using clean XML structures that modern LLMs love
  const promptBlocks = [
    emotionalBrief ? `<EmotionalState>${sanitize(emotionalBrief)}</EmotionalState>` : '',
    renderRelationshipFraming(relationship),
    renderTargetBlock(targetInfo),
    renderTaskDirective(behaviorDirective),
    renderMemoryBlock(rankedMemories),
    renderWorkingMemory(workingMemory),
    `\n<CurrentMessage speaker="${sanitize(speakerName || 'User')}">\n${sanitize(userMessage)}\n</CurrentMessage>`
  ];

  // Instantly removes any empty blocks to save tokens, and joins with newlines
  return promptBlocks.filter(Boolean).join('\n');
}

module.exports = {
  assemble,
};
