/**
 * data/clanClash.js
 * Authoritative Clan Clash facts for Melody's !event briefing.
 * Source: clan "Meta Blueprint" guide + Beyonder's confirmation.
 * RULE: add facts ONLY when confirmed. The AI is told to say "not in data" for anything missing.
 */
'use strict';

module.exports = {
  name: 'Clan Clash',
  format: {
    cycle: 'Runs 4 consecutive days, Thursday to Sunday. All clans are automatically placed into the bracket.',
    objective: 'Victory is decided purely by points, not trophies. Raw event score is the only metric that matters.',
    sundayPayout: 'On Sunday, personal points convert directly to clan currency. Payouts are currently increased.',
    joinRestriction: 'A recruit who joins while a Clash is active cannot participate in that cycle.'
  },
  stages: {
    prep: {
      day: 'Thursday',
      duration: 'Exactly 24 hours',
      action: 'Manually set and save your defensive formation.',
      ifNotSet: 'The system defaults to your last active Arena layout.',
      lock: 'Formation is strictly locked once Thursday ends.'
    },
    clash: {
      days: 'Friday to Sunday',
      length: '3 days',
      matches: 'Fully auto-fought, max 5 minutes per match.',
      control: 'No manual control over hero abilities.'
    }
  },
  attacks: {
    perDay: 3,
    note: '3 high-value attacks per day per member.',
    failure: 'No points are lost on a failed attack.'
  },
  targeting: [
    'Target players equal to or slightly stronger than your current rating, provided you have the elemental advantage.',
    'Do not waste attacks on low-tier opponents.',
    "Study the opponent's defensive layout and build custom counters before pressing fight."
  ],
  scoring: {
    formulaAsPrinted: '[Your Army Power] + [Enemy Army Power] + [Defeated Units] = Final Points',
    note: 'Guide says points scale exponentially on these three locked variables. Exact weights are NOT in the data.'
  },
  rewards: {
    clanTokensPerBattle: 'About 2,000 clan tokens per battle. The exact amount depends on score and victory; other game factors also apply. Boss battles likewise reward based on score.'
  }
};
