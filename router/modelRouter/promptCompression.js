/**
 * router/modelRouter/promptCompression.js
 *
 * TOKEN COMPRESSION & DYNAMIC CONTEXT ROLLING
 * Intelligently shrinks context blocks to fit emergency API limits without 
 * severing words, breaking JSON keys, or destroying conversation flow.
 * 🚀 UPGRADE: Fixed mismatched XML tags (RecentChatLog) and integrated Chat Summary.
 */

'use strict';

let fitGameDataToBudget = null;
try {
  ({ fitGameDataToBudget } = require('../../promptBuilder/promptAssembler'));
} catch (_) {
  fitGameDataToBudget = null;
}

const EMERGENCY_GAMEDATA_CHAR_CAP = 800;
const EMERGENCY_MEMORY_CHAR_CAP = 800;

/**
 * Parses text bottom-up to keep complete sentences/lines intact 
 * instead of a blind character slice that ruins context.
 */
function rollContextDynamically(textBlock, maxChars) {
  const trimmed = textBlock.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const lines = trimmed.split('\n');
  let rolledText = '';
  let currentLength = 0;

  // Iterate from the most recent (bottom) to the oldest (top)
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (currentLength + lineLength > maxChars) {
      rolledText = `...[earlier context rolled for token efficiency]...\n${rolledText}`;
      break;
    }
    rolledText = lines[i] + (rolledText ? '\n' + rolledText : '');
    currentLength += lineLength;
  }
  
  // Fallback if a single continuous line is massive
  return rolledText || trimmed.slice(-maxChars);
}

function compressForEmergency(prompt) {
  if (!prompt) return prompt;
  
  let compressed = prompt;
  
  // 1. Completely strip non-essential historical context
  compressed = compressed.replace(/<LongTermMemory>[\s\S]*?<\/LongTermMemory>/i, '');
  compressed = compressed.replace(/<ChatHistory>[\s\S]*?<\/ChatHistory>/i, '');
  
  // 🚀 NEW: Handle the new PreviousChatSummary tag safely
  compressed = compressed.replace(/<PreviousChatSummary>([\s\S]*?)<\/PreviousChatSummary>/i, (match, inner) => {
    // If the summary is small, keep it. If it's abnormally large, strip it for the emergency.
    if (inner.length > 300) return ''; 
    return match;
  });

  // 2. 🚀 FIX: Changed to <RecentChatLog> to match promptAssembler.js exactly
  compressed = compressed.replace(/<RecentChatLog>([\s\S]*?)<\/RecentChatLog>/i, (match, inner) => {
    const smartMemory = rollContextDynamically(inner, EMERGENCY_MEMORY_CHAR_CAP);
    return `<RecentChatLog>\n${smartMemory}\n</RecentChatLog>`;
  });
  
  // 3. Priority-aware GameData trimmer
  compressed = compressed.replace(/<GameData>([\s\S]*?)<\/GameData>/i, (match, inner) => {
    const trimmedInner = inner.trim();
    if (trimmedInner.length <= EMERGENCY_GAMEDATA_CHAR_CAP) return match;

    let smart = null;
    if (fitGameDataToBudget) {
      try {
        const parsed = JSON.parse(trimmedInner);
        smart = fitGameDataToBudget(parsed, EMERGENCY_GAMEDATA_CHAR_CAP);
      } catch (_) {
        smart = null; 
      }
    }

    if (smart === null) {
      smart = `${trimmedInner.slice(0, EMERGENCY_GAMEDATA_CHAR_CAP)}...[truncated for emergency]`;
    }

    return `<GameData>\n${smart}\n</GameData>`;
  });
  
  // 4. Aggressive Token Scrubbing: Remove excessive whitespace, tabs, and triple newlines
  compressed = compressed.replace(/[ \t]+/g, ' ')
                         .replace(/\n{3,}/g, '\n\n')
                         .trim();
                         
  return compressed;
}

module.exports = { 
  compressForEmergency, 
  rollContextDynamically,
  EMERGENCY_GAMEDATA_CHAR_CAP, 
  EMERGENCY_MEMORY_CHAR_CAP 
};
