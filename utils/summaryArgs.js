/**
 * commands/summaryArgs.js
 *
 * PURPOSE
 *   Pure (no Discord, no I/O) argument parser for:
 *       !summary [language] [@user]      (order-independent)
 *
 *   Examples
 *       ""                      -> { targetId: null, language: 'English' }
 *       "hindi"                 -> { targetId: null, language: 'Hindi' }
 *       "spanish <@123>"        -> { targetId: '123', language: 'Spanish' }
 *       "<@123>"                -> { targetId: '123', language: 'English' }
 *       "<@123> hi"             -> { targetId: '123', language: 'Hindi' }
 *
 *   WHY NOT message.mentions.users?
 *     Discord adds the author of a replied-to message to `mentions.users`
 *     whenever the reply pings. Parsing the literal <@id> tokens in the text
 *     means only users the invoker actually typed are treated as the target.
 *
 *   SECURITY
 *     The language token ends up inside the LLM system prompt, so it is
 *     normalised through an alias map or strictly sanitised (letters only,
 *     <= 24 chars). Anything else falls back to English.
 */

'use strict';

const DEFAULT_LANGUAGE = 'English';

const LANGUAGE_ALIASES = {
  English: ['english', 'en', 'eng'],
  Hindi: ['hindi', 'hi', 'हिन्दी', 'हिंदी'],
  Hinglish: ['hinglish'],
  Spanish: ['spanish', 'es', 'español', 'espanol'],
  French: ['french', 'fr', 'français', 'francais'],
  German: ['german', 'de', 'deutsch'],
  Portuguese: ['portuguese', 'pt', 'português', 'portugues'],
  Italian: ['italian', 'italiano'],
  Russian: ['russian', 'ru', 'русский'],
  Arabic: ['arabic', 'ar', 'العربية'],
  Bengali: ['bengali', 'bangla', 'bn', 'বাংলা'],
  Tamil: ['tamil', 'ta', 'தமிழ்'],
  Telugu: ['telugu', 'te', 'తెలుగు'],
  Marathi: ['marathi', 'mr', 'मराठी'],
  Gujarati: ['gujarati', 'gu', 'ગુજરાતી'],
  Punjabi: ['punjabi', 'pa', 'ਪੰਜਾਬੀ'],
  Kannada: ['kannada', 'kn', 'ಕನ್ನಡ'],
  Malayalam: ['malayalam', 'ml', 'മലയാളം'],
  Urdu: ['urdu', 'ur', 'اردو'],
  Japanese: ['japanese', 'ja', 'jp', '日本語'],
  Korean: ['korean', 'ko', 'kr', '한국어'],
  Chinese: ['chinese', 'mandarin', 'zh', 'cn', '中文'],
  Turkish: ['turkish', 'tr', 'türkçe', 'turkce'],
  Indonesian: ['indonesian', 'bahasa'],
  Vietnamese: ['vietnamese', 'vi'],
  Thai: ['thai', 'th'],
  Dutch: ['dutch', 'nl', 'nederlands'],
  Polish: ['polish', 'pl', 'polski'],
  Filipino: ['filipino', 'tagalog', 'fil'],
};

// NOTE: 'it' and 'id' are deliberately NOT ISO aliases — they are common English words.

const ALIAS_MAP = new Map();
for (const [canonical, aliases] of Object.entries(LANGUAGE_ALIASES)) {
  for (const alias of aliases) ALIAS_MAP.set(alias.toLocaleLowerCase(), canonical);
}

// Letters/marks/hyphen only, 2-24 chars. No digits, quotes, braces or newlines.
const SAFE_LANGUAGE_TOKEN = /^[\p{L}\p{M}-]{2,24}$/u;

/**
 * @param {string|undefined} word
 * @returns {string} canonical language name (never empty)
 */
function resolveLanguage(word) {
  if (!word) return DEFAULT_LANGUAGE;

  const cleaned = word.replace(/[.,!?:;]+$/u, '').toLocaleLowerCase();
  if (ALIAS_MAP.has(cleaned)) return ALIAS_MAP.get(cleaned);

  // Unknown word: pass through (the LLM knows far more languages than any alias map)
  // but only if it is a clean, short, letters-only token.
  if (SAFE_LANGUAGE_TOKEN.test(cleaned)) {
    return cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1);
  }
  return DEFAULT_LANGUAGE;
}

/**
 * @param {string} argText  everything after "!summary"
 * @param {{botId?: string}} [opts]  a mention of the bot itself means "whole channel"
 * @returns {{targetId: string|null, language: string}}
 */
function parseSummaryArgs(argText, { botId = null } = {}) {
  let rest = String(argText || '');
  let targetId = null;

  // 1. Pull out the first non-bot user mention; strip ALL user mentions from the text.
  rest = rest.replace(/<@!?(\d+)>/g, (_, id) => {
    if (!targetId && id !== botId) targetId = id;
    return ' ';
  });

  // 2. Strip role/channel mentions and broadcast pings so they are never read as a language.
  rest = rest.replace(/<@&\d+>|<#\d+>|@everyone|@here/g, ' ');

  // 3. First remaining word = language.
  const firstWord = rest.trim().split(/\s+/).filter(Boolean)[0];

  return { targetId, language: resolveLanguage(firstWord) };
}

module.exports = { parseSummaryArgs, resolveLanguage, DEFAULT_LANGUAGE };
