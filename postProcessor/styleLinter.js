/**
 * postProcessor/styleLinter.js
 * 
 * PURPOSE
 *   Cleans and formats the raw AI text before it is sent to Discord.
 *   Enforces emoji limits, prevents repetitive AI loops, and ensures perfect grammar.
 *   🚀 UPGRADE: Hinglish conversational crutches added to BANNED_OPENERS.
 *   🚀 UPGRADE: Identity Prefix Stripper to prevent LLMs from outputting "Melody: ".
 *   🚀 UPGRADE: Dangling XML tag cleanup.
 *   🚀 FIX: String-to-Number Emoji Budget mapper added.
 *   🛡️ FIX: Mention tag protection to prevent `<@ID>` corruption during cleanup.
 */

const RECENT_REPLY_LIMIT = 8;
const MAX_TRACKED_CHANNELS = 100; // 🛡️ Memory leak protection limit

// Expanded list of LLM conversational crutches (Now includes Hinglish)
const BANNED_OPENERS = /^(oh[,.]?|well[,.]?|hmm[,.]?|umm[,.]?|honestly[,.]?|anyway[,.]?|so[,.]?|ah[,.]?|alright[,.]?|look[,.]?|basically[,.]?|actually[,.]?|okay[,.]?|arre[,.]?|arey[,.]?|yaar[,.]?|accha[,.]?|dekho[,.]?|suno[,.]?|bhai[,.]?)\s+/i;
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
 * Isolates the exact opener word safely, ignoring punctuation variations.
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
 * Strips crutches and fixes capitalization safely, even if wrapped in Markdown.
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
 * Advanced Regex handles complex emojis and cleans up leftover horizontal whitespace 
 * while strictly preserving vertical line breaks (\n) and Discord Mention Tags.
 */
function enforceEmojiBudget(text, numericBudget) {
  const emojiClusterRegex = /(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])\u{FE0F}?(?:\u{200D}(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])\u{FE0F}?)*/gu;
  let count = 0;

  let processedText = text.replace(emojiClusterRegex, (match) => {
    count += 1;
    return count <= numericBudget ? match : '';
  });
  
  // Clean up structural weirdness left by removed emojis
  processedText = processedText
    .replace(/ {2,}/g, ' ')               // Only collapse horizontal spaces, NOT new lines!
    .replace(/ +([.,!?])/g, '$1')         // Fix spaces before punctuation (e.g., "Hello ," -> "Hello,")
    .replace(/<@!?\s+(\d+)>/g, '<@$1>')   // 🛡️ FIX: Protect malformed mention tags 
    .trim();
    
  return processedText;
}

/**
 * 🚀 UPGRADE: Removes internal AI thinking, XML tags, drafts, and self-prefixes
 */
function stripReasoning(text) {
    let cleanText = text;
    
    // 🛡️ Final Failsafe: Strip leaked <think> or <reflection> tags entirely
    cleanText = cleanText.replace(/<(?:think|reasoning|reflection|plan|scratchpad)>[\s\S]*?(?:<\/(?:think|reasoning|reflection|plan|scratchpad)>|$)/gi, '');

    // 🛡️ Orphan Cleanup: Catch dangling closing tags if the AI hallucinated just the end tag
    cleanText = cleanText.replace(/<\/(?:think|reasoning|reflection|plan|scratchpad)>/gi, '');

    // 🤖 Self-Prefix Hallucination Fix: Removes "Melody:", "**INF AI**:", "[Melody]:"
    cleanText = cleanText.replace(/^(?:\*\*?(?:Melody|INF AI|Bot)\*\*?\s*:|\[?(?:Melody\vert{}INF AI\vert{}Bot)\]?\s*:)\s*/i, '');

    // If the model leaked its "Draft:" section, grab ONLY what comes after "Draft:"
    const draftMatch = cleanText.match(/\bDraft:\s*([\s\S]*)$/i);
    if (draftMatch) {
        cleanText = draftMatch[1];
    }
    
    // Just in case it uses "Final Response:" or similar wording
    const responseMatch = cleanText.match(/\b(?:Final )?Response:\s*([\s\S]*)$/i);
    if (responseMatch) {
        cleanText = responseMatch[1];
    }

    return cleanText.trim();
}

/**
 * Structural Cleanup (Quotes, Giant Gaps, Reasoning)
 */
function structuralCleanup(text) {
    let cleanText = text;
    
    // 🚀 Step 1: Strip out rogue AI reasoning and prefixes first!
    cleanText = stripReasoning(cleanText);

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
function process({ channelId, responseText, emojiBudget = 'medium' }) {
  try {
      if (!responseText || typeof responseText !== 'string') {
          return { text: '', wasTrimmed: false };
      }

      // Translate string budget from gemini.js into a strict number
      let numericBudget;
      switch (String(emojiBudget).toLowerCase()) {
          case 'none':      numericBudget = 0; break;
          case 'low':       numericBudget = 1; break;
          case 'medium':    numericBudget = 3; break;
          case 'high':      numericBudget = 6; break;
          case 'unlimited': numericBudget = 99; break;
          default:          
             numericBudget = typeof emojiBudget === 'number' ? emojiBudget : 3;
      }

      // 1. Fix massive gaps, rogue thinking blocks, and stray quotes
      let text = structuralCleanup(responseText);
      
      // 2. Prevent AI repetition loops
      text = stripBannedOpenerIfRepeated(channelId, text);
      const wasTrimmed = text !== responseText;
      
      // 3. Enforce emoji budgets with translated numeric budget
      text = enforceEmojiBudget(text, numericBudget);
      
      // 4. Record to memory
      recordReply(channelId, text);
      
      return { text, wasTrimmed };
  } catch (error) {
      console.error('⚠️ [STYLE LINTER ERROR]', error);
      return { text: responseText, wasTrimmed: false }; // Failsafe return
  }
}

module.exports = { process, openerRepeated, recordReply };
