/**
 * memory/retention.js
 *
 * PURPOSE
 *   Single source of truth for Melody's retention policy.
 *   Runs at WRITE time (no LLM, no network, ~microseconds):
 *     1. classifyIntent()      -> 'CHAT' | 'STRATEGY' | 'BOSS'   (keyword heuristics)
 *     2. computeExpiresAt()    -> ISO timestamp (created + 24h or 72h)
 *     3. buildRetentionFields()-> { intent, expires_at } merged into the chat_ram row
 *
 *   RETENTION POLICY
 *     CHAT      -> 24h  (casual banter, bot replies)
 *     STRATEGY  -> 72h
 *     BOSS      -> 72h
 *     Permanent data (user_profiles, bot instructions, game_state) lives in other
 *     tables and is never touched by the cleanup job.
 *
 *   False positives are cheap (a banter line lives 48h longer);
 *   false negatives are also cheap (a strategy line lives 24h, which still
 *   covers the daily discussion window). So the heuristics favour simplicity.
 */

'use strict';

const HOUR_MS = 60 * 60 * 1000;

const TTL_MS = Object.freeze({
  CHAT: 24 * HOUR_MS,
  STRATEGY: 72 * HOUR_MS,
  BOSS: 72 * HOUR_MS,
});

const INTENTS = Object.freeze({ CHAT: 'CHAT', STRATEGY: 'STRATEGY', BOSS: 'BOSS' });

// Ignore trivially short lines ("ok", "lol", "boss?") and cap scan cost on huge pastes.
const MIN_CLASSIFY_CHARS = 8;
const MAX_SCAN_CHARS = 1000;

// A "boss" word next to one of these is a boss-fight discussion even with no other game term.
const BOSS_PHRASE =
  /\bboss(?:es)?\s+(?:fight|battle|strat(?:egy)?|team|damage|hp|abilit(?:y|ies)|passive|weakness(?:es)?|resistance|phase|season)\b/i;
const BOSS_WORD = /\bboss(?:es)?\b/i;

// Kingdom Clash / generic RPG strategy vocabulary. Each regex counts ONCE per message.
const GAME_TERMS = [
  /\bheroe?s?\b/i,
  /\btroops?\b/i,
  /\bformations?\b/i,
  /\bsynerg(?:y|ies)\b/i,
  /\btier\s?list\b/i,
  /\bmeta\b/i,
  /\bloadouts?\b/i,
  /\bgear\b/i,
  /\btalents?\b/i,
  /\bmythic(?:al)?\b/i,
  /\blegendary\b/i,
  /\bmelee\b/i,
  /\branged\b/i,
  /\btank(?:s|y)?\b/i,
  /\bdps\b/i,
  /\bbuffs?\b/i,
  /\bnerfs?\b/i,
  /\bpassives?\b/i,
  /\babilit(?:y|ies)\b/i,
  /\brally\b/i,
  /\bpvp\b/i,
  /\barena\b/i,
  /\bresistan(?:ce|t)\b/i,
  /\bweakness(?:es)?\b/i,
  /\benrage\b/i,
  /\blineup\b/i,
  /\bkingdom clash\b/i,
];

// With only ONE game term, a strategy cue is required to count as strategy talk.
const STRATEGY_CUE =
  /\b(?:best|worst|counters?|vs|versus|should i|which|recommend(?:ed)?|worth|priorit(?:y|ize|ise)|setup|beat|defeat|how to|upgrade|stronger|strongest|better)\b/i;

/**
 * @param {string} text   raw message content
 * @param {{isBot?: boolean}} [opts]  bot-authored rows are always CHAT (24h):
 *        long strategy replies from the bot would otherwise bloat the 72h tier.
 * @returns {'CHAT'|'STRATEGY'|'BOSS'}
 */
function classifyIntent(text, { isBot = false } = {}) {
  if (isBot) return INTENTS.CHAT;
  if (typeof text !== 'string') return INTENTS.CHAT;

  const t = text.trim().slice(0, MAX_SCAN_CHARS);
  if (t.length < MIN_CLASSIFY_CHARS) return INTENTS.CHAT;

  if (BOSS_PHRASE.test(t)) return INTENTS.BOSS;

  let termHits = 0;
  for (const re of GAME_TERMS) {
    if (re.test(t)) termHits++;
  }

  // "ok boss" / "hey boss" -> banter. "boss + hero/weakness/..." -> boss strategy.
  if (BOSS_WORD.test(t) && termHits >= 1) return INTENTS.BOSS;

  if (termHits >= 2) return INTENTS.STRATEGY;
  if (termHits === 1 && STRATEGY_CUE.test(t)) return INTENTS.STRATEGY;

  return INTENTS.CHAT;
}

/**
 * @param {'CHAT'|'STRATEGY'|'BOSS'} intent
 * @param {number|Date} [from=Date.now()] creation time
 * @returns {string} ISO timestamp
 */
function computeExpiresAt(intent, from = Date.now()) {
  const base = from instanceof Date ? from.getTime() : Number(from) || Date.now();
  const ttl = TTL_MS[intent] || TTL_MS.CHAT;
  return new Date(base + ttl).toISOString();
}

/**
 * Convenience: everything the DB row needs for retention, computed in-process.
 */
function buildRetentionFields(text, opts = {}) {
  const intent = classifyIntent(text, opts);
  return { intent, expires_at: computeExpiresAt(intent) };
}

module.exports = {
  INTENTS,
  TTL_MS,
  classifyIntent,
  computeExpiresAt,
  buildRetentionFields,
};
