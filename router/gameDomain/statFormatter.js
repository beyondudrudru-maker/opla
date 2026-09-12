/**
 * router/gameDomain/statFormatter.js
 *
 * Formats hero/troop stat values for Discord embeds.
 * Handles three shapes:
 *   1. Current heroes.js shape: { min, max }
 *   2. Legacy shape: array of per-level values
 *   3. Plain number/string (troop per-level stats)
 */

function formatStat(stat) {
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : String(n));

  // Current heroes.js shape: { min, max }
  if (stat && typeof stat === 'object' && !Array.isArray(stat) && 'min' in stat && 'max' in stat) {
    if (stat.min === stat.max) return fmt(stat.min);
    return `${fmt(stat.min)} - ${fmt(stat.max)}`;
  }

  // Legacy/alternate shape: array of per-level values, e.g. statLevels[stat]
  if (Array.isArray(stat)) {
    if (stat.length === 0) return 'N/A';
    const min = stat[0];
    const max = stat[stat.length - 1];
    return stat.length === 1 ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }

  if (stat === undefined || stat === null || stat === '') return 'N/A';
  return typeof stat === 'number' ? stat.toLocaleString() : String(stat);
}

module.exports = { formatStat };
