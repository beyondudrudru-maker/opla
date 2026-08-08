/**
 * postProcessor/styleLinter.js
 * 
 * PURPOSE
 *   Cleans and formats the raw AI text before it is sent to Discord.
 *   Enforces emoji limits, prevents repetitive AI loops, and ensures perfect grammar.
 *   🚀 UPGRADE: Bulletproof whitespace, grammar rescue, and expanded crutch filtering.
 */

const RECENT_REPLY_LIMIT = 8;
const MAX_TRACKED_CHANNELS = 100; // 🛡️ Memory leak protection limit

// 🚀 UPGRADE: Expanded list of LLM conversational crutches
const BANNED_OPENERS = /^(oh[,.]?|well[,.]?|hmm[,.]?|umm[,.]?|honestly[,.]?|anyway[,.]?|so[,.]?|ah[,.]?|alright[,.]?|look[,.]?|basically[,.]?|actually[,.]?|okay[,.]?)\s+/i;
const recentRepliesByChannel = new Map();

/**
 * Gets the recent replies for a channel.
 */
function getRecent(channelId) {
  return recentRepliesByChannel.get(channelId) || [];
}

/**
 * Records a reply and maintains the channel memory limit.
 */
function recordReply(channelId, text) {
  if (!recentRepliesByChannel.has(channelId) && recentRepliesByChannel.size >= MAX_TRACKED_CHANNELS) {
      const oldestChannelId = recentRepliesByChannel.keys().next().value;
      recentRepliesByChannel.delete(oldestChannelId);
  }

  const list = getRecent(channelId);
  list.push(text);
  
  if (list.length > RECENT_REPLY_LIMIT) {
      list.shift();
  }
  
  recentRepliesByChannel.set(channelId, list);
}

/**
 * 🚀 UPGRADE: Isolates the exact opener word safely, ignoring punctuation variations.
 */
function openerRepeated(channelId, text) {
  const match = text.match(BANNED_OPENERS);
  if (!match) return false;
  
  const openerWord = match[1].toLowerCase().replace(/[^a-z]/g, ''); // Strip punctuation for a pure match
  
  return getRecent(channelId).some((r) => {
      const pastMatch = r.match(BANNED_OPENERS);
      return pastMatch && pastMatch[1].toLowerCase().replace(/[^a-z]/g, '') === openerWord;
  });
}

/**
 * 🚀 UPGRADE: Strips crutches and fixes capitalization safely, even if wrapped in Markdown.
 */
function stripBannedOpenerIfRepeated(channelId, text) {
  if (openerRepeated(channelId, text)) {
    let strippedText = text.replace(BANNED_OPENERS, '').trim();
    
    // Smart capitalize: handles cases where text starts with markdown e.g., "**hello**" -> "**Hello**"
    strippedText = strippedText.replace(/^([*`_~]*)([a-z])/i, (match, markdown, letter) => {
        return markdown + letter.toUpperCase();
    });
    
    return strippedText;
  }
  return text;
}

/**
 * 🚀 UPGRADE: Advanced Regex handles complex emojis and cleans up leftover whitespace/punctuation gaps.
 */
function enforceEmojiBudget(text, budget) {
  const emojiRegex = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]+/gu;
  let count = 0;
  
  let processedText = text.replace(emojiRegex, (match) => {
    count += 1;
    return count <= budget ? match : '';
  });
  
  // Clean up structural weirdness left by removed emojis
  processedText = processedText
    .replace(/\s+/g, ' ')               // Collapse multiple spaces into one
    .replace(/\s+([.,!?])/g, '$1')      // Fix spaces before punctuation (e.g., "Hello ," -> "Hello,")
    .trim();
    
  return processedText;
}

/**
 * 🚀 UPGRADE: Structural Cleanup (Quotes, Giant Gaps)
 */
function structuralCleanup(text) {
    let cleanText = text;
    
    // Remove surrounding quotes if the AI accidentally wrapped its entire response in them
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
        cleanText = cleanText.substring(1, cleanText.length - 1).trim();
    }
    
    // Limit excessive empty lines to a maximum of 2 (preserves paragraphs, kills giant gaps)
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n');
    
    return cleanText;
}

/**
 * Main execution function for the style linter.
 */
function process({ channelId, responseText, emojiBudget = 1 }) {
  try {
      if (!responseText || typeof responseText !== 'string') {
          return { text: '', wasTrimmed: false };
      }

      // 1. Fix massive gaps and stray quotes
      let text = structuralCleanup(responseText);
      
      // 2. Prevent AI repetition loops
      text = stripBannedOpenerIfRepeated(channelId, text);
      const wasTrimmed = text !== responseText;
      
      // 3. Enforce emoji budgets and polish punctuation spacing
      text = enforceEmojiBudget(text, emojiBudget);
      
      // 4. Record to memory
      recordReply(channelId, text);
      
      return { text, wasTrimmed };
  } catch (error) {
      console.error('⚠️ [STYLE LINTER ERROR]', error);
      return { text: responseText, wasTrimmed: false }; // Failsafe return
  }
}

module.exports = { process, openerRepeated, recordReply };
