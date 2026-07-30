/**
 * postProcessor/styleLinter.js
 * 
 * PURPOSE
 *   Cleans and formats the raw AI text before it is sent to Discord.
 *   Enforces emoji limits and prevents repetitive AI conversational loops.
 */

const RECENT_REPLY_LIMIT = 8;
const MAX_TRACKED_CHANNELS = 100; // 🛡️ Memory leak protection limit

// Expanded to catch more common AI-isms
const BANNED_OPENERS = /^(oh[,.]?|well[,.]?|hmm[,.]?|honestly[,.]?|anyway[,.]?|so[,.]?|ah[,.]?)\s+/i;
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
  // 🛡️ Prevent infinite memory growth (Memory Leak fix)
  if (!recentRepliesByChannel.has(channelId) && recentRepliesByChannel.size >= MAX_TRACKED_CHANNELS) {
      // Delete the oldest entry (the first key in the Map)
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
 * Checks if the first 12 characters perfectly match a recent reply.
 */
function openerRepeated(channelId, text) {
  const opener = text.trim().slice(0, 12).toLowerCase();
  return getRecent(channelId).some((r) => r.trim().slice(0, 12).toLowerCase() === opener);
}

/**
 * Strips repetitive conversational crutches if the bot used them recently.
 */
function stripBannedOpenerIfRepeated(channelId, text) {
  if (BANNED_OPENERS.test(text) && openerRepeated(channelId, text)) {
    return text.replace(BANNED_OPENERS, '');
  }
  return text;
}

/**
 * Limits the number of emojis in the text based on the behavior budget.
 */
function enforceEmojiBudget(text, budget) {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  let count = 0;
  return text.replace(emojiRegex, (match) => {
    count += 1;
    return count <= budget ? match : '';
  });
}

/**
 * Main execution function for the style linter.
 */
function process({ channelId, responseText, emojiBudget = 1 }) {
  let text = stripBannedOpenerIfRepeated(channelId, responseText);
  const wasTrimmed = text !== responseText;
  
  text = enforceEmojiBudget(text, emojiBudget).trim();
  recordReply(channelId, text);
  
  return { text, wasTrimmed };
}

module.exports = { process, openerRepeated, recordReply };
