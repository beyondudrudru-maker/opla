/**
 * data/facetOverrides.js — CURATED TRUTH for the facet pipeline (edit me; I win over auto-derived data).
 *
 * The facet compiler (engine/facetCompiler.js) first DERIVES a card for every hero/troop from
 * heroes.js / troops.js / synergies.js / strategies.js. Anything written here overrides or extends that card,
 * so a human-verified fact is never lost and never guessed by the model.
 *
 * Fields (all optional):
 *   job          one plain line: what this unit REALLY does (shown to the model instead of a guess)
 *   neverClaim   words the bot must never say about this unit, e.g. ['heal'] (checked on every reply)
 *   boss         { use: 'disabled'|'damage'|'sustain'|'low'|'neutral', why: '...' }   boss-battle verdict
 *   arena        { note: '...' }                                                      Arena / Clan Clash note
 *   placement    { where, why }  ARENA formation placement (player-verified): where in the formation to put the troop
 *   beginner     true if it is a good pick for beginners (shown in Arena answers)
 *   notes        extra verified facts (array of strings)
 *
 * Keys: heroes by id (MORGANA_01), troops by id (tr-night-hunter).
 * Claim words understood by neverClaim: heal, summon, stun, sleep, fear, pull, taunt, silence, tank, aoe.
 */
module.exports = {
  version: 1,

  heroes: {
    MORGANA_01: {
      job: 'Summoner: buffs ONLY summoned skeletons (from Cursed Catapult, Necromancer or her own Tombstone); Tombstone taunts enemies and stops their abilities for a few seconds.',
      boss: { use: 'low', why: 'Her buff reaches ONLY summoned skeletons, not Undead troops in general. Skeletons and their summoners have low HP and die early, so on a damage-score boss the buff is wasted.' },
      arena: { note: 'Tombstone taunts enemies and they cannot use abilities while the taunt lasts — real crowd-control value against a real lineup.' },
      notes: ['Her talent does NOT buff Bonebreaker, Immortal, Night Hunter or other Undead troops — only summoned skeletons.'],
    },
    SIGURD_01: {
      job: 'Mage HP-buffer: talent adds HP to allied Mage units; ability is a snowball that damages and stuns ENEMIES (it buffs nobody).',
      notes: ['His snowball damage is his own, not an ally buff.'],
    },
    ANAVIN_01: {
      notes: ['Talent boosts Mage units only; her ability buffs ALL allies (attack and defense) and burns enemies.'],
    },
    HARKON_01: { boss: { use: 'disabled', why: 'Talent/ability do not work in boss battles.' } },
    XANA_01: { boss: { use: 'disabled', why: 'Fire Fury Xana skills do not work in boss battles.' } },
  },

  troops: {
    'tr-magic-archer': {
      job: 'Ranged support-damage troop: its arrow pierces, so EVERY enemy troop in the arrow path takes damage — insane damage in a line.',
      arena: { note: 'Very strong in Arena; it is the better ranged pick than Imp there. Large lines of Magic Archers can wipe Cursed Catapults in 1-2 waves.' },
      placement: { where: 'front 2nd row to the middle of the formation', why: 'Its arrows pierce through everything in the path, so it needs a clear line from the middle.' },
    },
    'tr-assassins': {
      job: 'Trickster that dives behind the enemy; placed in front it attracts and chases enemy tanks to the back of the formation, and the tanks following it pull enemy attention away.',
      arena: { note: 'Works as a decoy and disruptor: enemy tanks and troops like Night Hunter get drawn to it.' },
      placement: { where: 'front is fine', why: 'It runs behind the enemy line and pulls the enemy tanks with it.' },
    },
    'tr-gravedigger': {
      job: 'Silent killer: burrows underground at the start and comes out at the enemy backline to disturb and disrupt ranged supporters.',
      arena: { note: 'Best against enemy ranged support in the back.' },
      placement: { where: 'front is fine', why: 'It goes underground and reaches the enemy backline anyway.' },
    },
    'tr-headless': {
      job: 'Tank that mind-controls enemy troops and turns them against their own army; it is fine on its own as long as the enemy troops do not damage it individually.',
      arena: { note: 'Control tank: the mind-controlled enemy units fight for you for a short time.' },
    },
    'tr-stone-golem': {
      job: 'Slow but very high-HP tank that creates copies of itself; best to engage and attract enemy tanks.',
      arena: { note: 'Excellent engager: high HP, good skill, and its slow speed keeps it in the front line holding the enemy.' },
      placement: { where: 'front', why: 'High HP and a good skill; it engages and attracts the enemy tanks while the slow movement keeps it in place.' },
    },
    'tr-lava-golem': {
      job: 'Tank that counters enemy tanks and moves rapidly after half HP (see its ability data in troops.js).',
      arena: { note: 'Good at countering enemy tanks; with Immortal and Stone Golem it engages the enemy so ranged supporters can work.' },
      placement: { where: 'front', why: 'It holds and counters enemy tanks and speeds up once below half HP.' },
    },
    'tr-storm-mistresses': {
      job: 'Trickster that draws Assassins in (or goes in by itself) and then slips between enemy tanks to hold them for a short time.',
      arena: { note: 'Best used together with Stone Golem, Magic Archer and heavy tanks such as Immortal.' },
    },
    'tr-night-hunter': {
      job: 'Crowd-control troop: Nightmare — flies to its prey and releases a fear wave, enemies flee for a few seconds (Lv10: 3s, 6m). It does NOT heal or buff allies; "Support" is only its class tag.',
      neverClaim: ['heal'],
      boss: { use: 'low', why: 'Its value is crowd control (fear), which is not confirmed to work on bosses, and its own damage scaling is weak — little value for a damage score.' },
      arena: { note: 'Its fear skill disrupts everyone around the landing point. Enemy Assassins are drawn to it, so it needs a careful placement.' },
      placement: { where: 'front 2nd row, middle of the formation, or 2nd-last row', why: 'Assassins chase it and its fear disrupts the enemy line, so it must not sit unprotected on the very back or very front.' },
    },
    'tr-necromancer': {
      job: 'Summoner with no direct damage: summons skeletons (Lv10: 4 skeletons, each 4,700 HP / 770 damage). The Necromancer and its skeletons die early.',
      neverClaim: ['heal'],
      boss: { use: 'low', why: 'No direct damage; it and its skeletons die early, so it adds little to a boss damage score.' },
    },
    'tr-cursed-catapult': {
      job: 'Single ranged unit (Lv10: 9,000 HP, the lowest of all troops) that launches skeleton balls which summon skeletons on landing; mostly AoE splash.',
      neverClaim: ['heal'],
      boss: { use: 'low', why: 'AoE-only value on a single-target boss, and it dies early (lowest HP).' },
      arena: { note: 'Good area damage (by its blast diameter) and it summons skeletons, but it has low HP: lines of enemy Magic Archers kill it in 1-2 waves and Edelina\'s thorn ability destroys it. Fine for beginners.' },
      beginner: true,
    },
    'tr-immortal': {
      job: 'Undead tank (frontline class) with strong HP and AoE; great against crowds in Arena.',
      boss: { use: 'low', why: 'A boss is one target, so the AoE adds little.' },
      arena: { note: 'Strong against crowds thanks to AoE.' },
      placement: { where: 'back of the formation', why: 'It is a very sturdy tank, so the usual strategy keeps it behind; the units meant to hold the enemy (Lava Golem, Stone Golem) stand in front.' },
    },
    'tr-pyrotechnician': {
      job: 'Human backline AoE ranged troop; no special ability.',
      boss: { use: 'low', why: 'Backline AoE troop with little boss impact (it is a troop, not a hero, and it is not disabled).' },
    },
    'tr-imp': {
      job: 'Ranged damage dealer with the highest per-unit damage of all troops (Lv10: 3 units, 5,250 damage each); no special ability.',
      arena: { note: 'Hits only ONE enemy at a time, so it is less preferred in Arena (Magic Archer is better there), but it is a good, simple pick for beginners. On bosses it is the best.' },
      beginner: true,
    },
    'tr-alchemist': {
      job: 'Ranged healer: throws healing projectiles at allies — not a big damage dealer but a great supporter; also the highest-priority Epic boss pick.',
      arena: { note: 'Enemy Assassins and Gravediggers hit the back line directly, so it is in danger from them.' },
      placement: { where: 'middle to 2nd-last row', why: 'It is a ranged support healer; the very back is exposed to Assassins and Gravediggers that dive onto the back line.' },
    },
    'tr-undead-mage': {
      job: 'Ranged Undead troop whose blast hits an area (3 m radius); decent in the early stage and the blast tears through skeletons.',
      arena: { note: 'Okay in the early stage because of its area blast damage; it is especially good at breaking enemy skeletons.' },
      placement: { where: 'middle', why: 'It is a ranged troop, and ranged troops mostly stand in the middle of the formation.' },
    },
    'tr-paladin': {
      job: 'Support-class melee troop whose ability Divine Guards gives nearby allies a small defense boost (5%, radius 2 m at Lv1 and 3 m at Lv10).',
      neverClaim: ['heal'],
    },
    'tr-huntress': {
      job: 'Ranged Legendary with a 15 m attack range; Powerful Salvo fires a cone that damages and stuns enemies in front for 1 s (6 m long).',
      neverClaim: ['heal'],
    },
    'tr-giant-toad': {
      job: 'Legendary jumper: Concussive Hop damages and stuns everything where it lands (up to 4 s at Lv10), then eats the strongest nearby unit.',
      neverClaim: ['heal'],
    },
    'tr-steel-revenant': {
      job: 'Legendary single-unit tank; Spiked Armor reflects part of the damage it takes back to attackers (5% at Lv1, 37% at Lv10).',
      neverClaim: ['heal'],
    },
    'tr-explosive-spider': {
      job: 'Fast Undead unit with only 100 HP that explodes when it reaches an enemy or takes lethal damage, hitting a 6 m area.',
    },
    'tr-butcher': {
      job: 'Single-unit melee tank (Lv1: 2,000 HP, 2.25 m reach); no special ability. Lv10 stats are not recorded yet.',
    },
    'tr-catapult': {
      job: 'Single ranged siege unit that hits an area (4 m radius); no special ability, low movement speed.',
    },
    'tr-iron-guards': {
      job: 'Plain melee tank squad (Lv10: 9 units, 85 defense); no special ability.',
    },
    'tr-infantry': {
      job: 'Plain melee foot soldiers (Lv10: 9 units); no special ability.',
    },
    'tr-bombers': {
      job: 'Ranged unit whose bombs hit an area (3 m radius), attack speed 1.4; no special ability. Lv1 stats are not recorded yet.',
    },
    'tr-archers': {
      job: 'Plain ranged archers (Lv10: 9 units); no special ability.',
    },
    'tr-bone-spearthrower': {
      job: 'Undead ranged spear thrower (Lv10: 9 units); no special ability.',
    },
    'tr-sorcerers-apprentice': {
      job: 'Mage ranged unit that fires magic arrows (Lv10: 9 units); no special ability.',
    },
    'tr-battle-golem': {
      job: 'Plain melee golem troop of the Mages family (Lv10: 9 units); no special ability.',
    },
    'tr-bone-warrior': {
      job: 'Plain undead melee soldiers (Lv10: 9 units); no special ability.',
    },
  },
};
