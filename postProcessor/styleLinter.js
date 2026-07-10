const RECENT_REPLY_LIMIT = 8;
const BANNED_OPENERS = /^(oh[,.]?|well[,.]?|hmm[,.]?|honestly[,.]?)\s+/i;
const recentRepliesByChannel = new Map();

function getRecent(channelId) {
  return recentRepliesByChannel.get(channelId) || [];
}
function recordReply(channelId, text) {
  const list = getRecent(channelId);
  list.push(text);
  if (list.length > RECENT_REPLY_LIMIT) list.shift();
  recentRepliesByChannel.set(channelId, list);
}
function openerRepeated(channelId, text) {
  const opener = text.trim().slice(0, 12).toLowerCase();
  return getRecent(channelId).some((r) => r.trim().slice(0, 12).toLowerCase() === opener);
}
function stripBannedOpenerIfRepeated(channelId, text) {
  if (BANNED_OPENERS.test(text) && openerRepeated(channelId, text)) {
    return text.replace(BANNED_OPENERS, '');
  }
  return text;
}
function enforceEmojiBudget(text, budget) {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  let count = 0;
  return text.replace(emojiRegex, (match) => {
    count += 1;
    return count <= budget ? match : '';
  });
}
function process({ channelId, responseText, emojiBudget = 1 }) {
  let text = stripBannedOpenerIfRepeated(channelId, responseText);
  const wasTrimmed = text !== responseText;
  text = enforceEmojiBudget(text, emojiBudget).trim();
  recordReply(channelId, text);
  return { text, wasTrimmed };
}

module.exports = { process, openerRepeated, recordReply };