/**
 * postProcessor/styleLinter.js
 * 
 * PURPOSE
 *   Cleans and formats the raw AI text before it is sent to Discord.
 *   Enforces emoji limits, prevents repetitive AI loops, and ensures perfect grammar.
 */

const RECENT_REPLY_LIMIT = 8;
const MAX_TRACKED_CHANNELS = 100; // 🛡️ Memory leak protection limit

// Expanded to catch more common AI-isms and conversational crutches
const BANNED_OPENERS = /^(oh[,.]?|well[,.]?|hmm[,.]?|honestly[,.]?|anyway[,.]?|so[,.]?|ah[,.]?|alright[,.]?|look[,.]?)\s+/i;
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
 * 🚀 UPGRADE: Smarter check. Isolates the exact opener word to check for repetition.
 */
function openerRepeated(channelId, text) {
  const match = text.match(BANNED_OPENERS);
  if (!match) return false;
  
  const openerWord = match[1].toLowerCase();
  
  return getRecent(channelId).some((r) => {
      const pastMatch = r.match(BANNED_OPENERS);
      return pastMatch && pastMatch[1].toLowerCase() === openerWord;
  });
}

/**
 * Strips repetitive conversational crutches and fixes capitalization.
 */
function stripBannedOpenerIfRepeated(channelId, text) {
  if (openerRepeated(channelId, text)) {
    const strippedText = text.replace(BANNED_OPENERS, '').trim();
    // Capitalize the new first letter to maintain perfect grammar
    return strippedText.charAt(0).toUpperCase() + strippedText.slice(1);
  }
  return text;
}

/**
 * 🚀 UPGRADE: Advanced Regex to handle complex ZWJ emojis (like skin tones).
 */
function enforceEmojiBudget(text, budget) {
  const emojiRegex = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]+/gu;
  let count = 0;
  return text.replace(emojiRegex, (match) => {
    count += 1;
    return count <= budget ? match : '';
  }).replace(/\s+/g, ' '); // Clean up double spaces left by removed emojis
}

/**
 * Main execution function for the style linter.
 */
function process({ channelId, responseText, emojiBudget = 1 }) {
  try {
      let text = stripBannedOpenerIfRepeated(channelId, responseText);
      const wasTrimmed = text !== responseText;
      
      text = enforceEmojiBudget(text, emojiBudget).trim();
      recordReply(channelId, text);
      
      return { text, wasTrimmed };
  } catch (error) {
      console.error('⚠️ [STYLE LINTER ERROR]', error);
      return { text: responseText, wasTrimmed: false }; // Failsafe return
  }
}

module.exports = { process, openerRepeated, recordReply };
