/**
 * data/gloriousHunt.js
 * Event-level facts for the Glorious Boss Hunt (Mon-Wed). Per-boss kits stay in data/bosses.js.
 * Rules below mirror the season rules already written in bosses.js + Beyonder's confirmation.
 * Add facts ONLY when confirmed; the AI says "not in data" for anything missing.
 */
'use strict';

module.exports = {
  name: 'Glorious Boss Hunt',
  window: 'Season lasts 3 days (Monday to Wednesday, IST).',
  attempts: '3 tries per day against the boss.',
  ranking: 'Top players are ranked by total damage dealt over the season.',
  rewards: {
    coins: 'Coins are earned based on damage dealt.',
    clanTokens: 'Clan token rewards depend on score; exact amounts are not in the data.'
  },
  battleRules: [
    'Boss power increases every 30 seconds of battle.',
    "Demo battles don't waste attempts but earn no gold."
  ]
};
