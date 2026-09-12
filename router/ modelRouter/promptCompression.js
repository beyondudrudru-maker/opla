/**
 * router/modelRouter/promptCompression.js
 *
 * TOKEN COMPRESSION (Emergency Tier) — used both mid-candidate-list (when a
 * live PAYLOAD_TOO_LARGE comes back from a provider) and in the final
 * emergency-fallback tier in ../modelRouter.js's generate().
 *
 * 🐛 BUG FIX — `EMERGENCY_MEMORY_CHAR_CAP` was referenced twice inside the
 * `<RecentChatHistory>` compression branch below but was NEVER DECLARED
 * anywhere in the original monolithic file (confirmed via a full-file
 * grep — no `const EMERGENCY_MEMORY_CHAR_CAP` existed). Any emergency
 * compression pass that actually hit a `<RecentChatHistory>` block longer
 * than the (undefined) cap would throw `ReferenceError:
 * EMERGENCY_MEMORY_CHAR_CAP is not defined` — silently killing the
 * emergency-fallback request instead of shrinking it. Declared here at a
 * sensible value (same order of magnitude as EMERGENCY_GAMEDATA_CHAR_CAP)
 * so the emergency path can no longer crash on this.
 */

// Reuse promptAssembler's priority-aware GameData trimmer for the
// emergency-fallback path below, instead of a blind character slice.
// Guarded require — a missing/renamed file just falls back to the old
// naive-slice behavior rather than crashing the router.
let fitGameDataToBudget = null;
try {
  ({ fitGameDataToBudget } = require('../../promptBuilder/promptAssembler'));
} catch (_) {
  fitGameDataToBudget = null;
}

const EMERGENCY_GAMEDATA_CHAR_CAP = 800;

// 🆕 BUG FIX (see file header) — this constant was missing entirely.
const EMERGENCY_MEMORY_CHAR_CAP = 800;

function compressForEmergency(prompt) {
  if (!prompt) return prompt;
  let compressed = prompt;
  compressed = compressed.replace(/<LongTermMemory>[\s\S]*?<\/LongTermMemory>/i, '');
  compressed = compressed.replace(/<ChatHistory>[\s\S]*?<\/ChatHistory>/i, '');
  compressed = compressed.replace(/<RecentChatHistory>([\s\S]*?)<\/RecentChatHistory>/i, (match, inner) => {
    if (inner.length <= EMERGENCY_MEMORY_CHAR_CAP) return match;
    const truncated = inner.slice(-EMERGENCY_MEMORY_CHAR_CAP);
    return `<RecentChatHistory>\n...[truncated for emergency]...\n${truncated}\n</RecentChatHistory>`;
  });
  // GameData is now frequently the largest block (full hero/troop stat
  // sets, formations, boss records). It's already minified JSON by the time
  // it reaches here.
  // 🐛 FIX (pre-existing, kept from original): this used to be a blind
  // `.slice(0, CAP)` on the serialized JSON, which chops mid-object —
  // whichever field happened to be serialized last (often
  // `bossModifiers`/`matchedBosses`, the exact fields that disambiguate
  // "this hero's CC is for swarms, not bosses") would get cut off entirely,
  // leaving the model with an incomplete picture and room to invent. Now it
  // parses the JSON and reuses promptAssembler's priority-aware trimmer —
  // verbose lore/description dropped first, long reasoning/notes text
  // shortened next, low-priority arrays dropped last — so the fields the
  // model needs most to stay factually grounded are the last thing cut.
  // Falls back to the old naive-slice behavior if parsing fails or the
  // trimmer module isn't available (e.g. a path/require mismatch).
  compressed = compressed.replace(/<GameData>([\s\S]*?)<\/GameData>/i, (match, inner) => {
    const trimmedInner = inner.trim();
    if (trimmedInner.length <= EMERGENCY_GAMEDATA_CHAR_CAP) return match;

    let smart = null;
    if (fitGameDataToBudget) {
      try {
        const parsed = JSON.parse(trimmedInner);
        smart = fitGameDataToBudget(parsed, EMERGENCY_GAMEDATA_CHAR_CAP);
      } catch (_) {
        smart = null; // not valid JSON (already partially truncated elsewhere, or a plain string) — fall back below
      }
    }

    if (smart === null) {
      smart = `${trimmedInner.slice(0, EMERGENCY_GAMEDATA_CHAR_CAP)}...[truncated for emergency]`;
    }

    return `<GameData>\n${smart}\n</GameData>`;
  });
  compressed = compressed.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return compressed;
}

module.exports = { compressForEmergency, EMERGENCY_GAMEDATA_CHAR_CAP, EMERGENCY_MEMORY_CHAR_CAP };
