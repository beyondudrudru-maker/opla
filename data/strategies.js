/**
 * MELODY Game Knowledge Library — strategies.js
 * 
 * PURPOSE:
 * Combines formation strategies, scenario guides, equipment synergies, 
 * arena layouts, and meta/economy guides into a single unified module.
 */

const strategies = {
  version: "1.0.0",
  maxHeroesPerFormation: 2,

  // 1. OPTIMAL FORMATIONS
  optimalFormations: [
    {
      id: "form-mage-nuke",
      name: "Mage Backline Nuke",
      heroes: ["ANAVIN_01", "KEYRA_01"],
      troopArchetype: "Mages",
      recommendedTroops: ["tr-phoenix", "tr-shaman", "tr-stone-golem", "tr-magic-archer", "tr-storm-mistresses"],
      synergyRating: "S",
      reasoning: "Anavin's talent (Flaming Heart) and Keyra's talent (Power of Water) both target the 'Mage' tag with stacking attack buffs (2-25% and 3-35% respectively), and neither overlaps with the other's kit. Anavin's ability additionally throws a burst All-Allies attack+defense buff, so the Mage troop line gets a double-stacked attack multiplier plus a periodic defense cushion — turning backline mages into the primary win condition instead of a support line."
    },
    {
      id: "form-undead-legion",
      name: "Undead Legion Snowball",
      heroes: ["DRAKE_01", "BONE_DRAGON_01"],
      troopArchetype: "Undead",
      recommendedTroops: ["tr-immortal", "tr-headless", "tr-imp", "tr-night-hunter", "tr-gravedigger", "tr-steel-revenant", "tr-necromancer"],
      synergyRating: "S",
      reasoning: "Both talents target the 'Undead' tag exclusively: Drake grants a stacking double-damage chance (Boarding Party) while Bone Dragon adds a flat damage-dealt increase (Death Aura). Since one is a proc-chance modifier and the other a flat multiplier, they compound rather than compete — every Undead troop hit has both a higher base damage and a chance to double it."
    },
    {
      id: "form-unkillable-wall",
      name: "Unkillable Tank Wall",
      heroes: ["DURAND_01", "CALYRA_01"],
      troopArchetype: "Tank",
      recommendedTroops: ["tr-immortal", "tr-stone-golem", "tr-bonebreaker", "tr-headless", "tr-monk", "tr-steel-revenant"],
      synergyRating: "S",
      reasoning: "Durand's talent (Immutability) specifically reduces incoming damage and debuff duration for Tank-role troops, while Calyra's talent+ability (Gift of Light / Healing Veil) provide continuous All-Allies HP restoration that persists after her death. Durand shrinks the damage the frontline takes; Calyra refills whatever gets through — the combination makes a Tank line functionally unkillable in prolonged fights."
    },
    {
      id: "form-boss-burst",
      name: "Boss Burst Squad",
      heroes: ["HARKON_01", "REMUS_01"],
      troopArchetype: "Ranged",
      recommendedTroops: ["tr-magic-archer", "tr-cursed-catapult", "tr-axe-throwers", "tr-shaman"],
      synergyRating: "A",
      reasoning: "Both heroes carry the 'Boss-Damage' tag. Remus's Threat of Giants buffs All-Allies damage specifically against tanks and bosses (30-85%), while Harkon's Insatiable Flame grows stronger with every enemy that dies inside his burn zone — in a long single-target boss fight neither effect wastes potential, and Remus's Light Shield absorbs the punishing counter-hits bosses deal back."
    },
    {
      id: "form-swarm-lockdown",
      name: "Swarm Lockdown & Clear",
      heroes: ["BUMI_01", "ZAHEER_01"],
      troopArchetype: "AoE",
      recommendedTroops: ["tr-alchemist", "tr-lava-golem", "tr-pyrotechnician", "tr-cursed-catapult"],
      synergyRating: "A",
      reasoning: "Bumi's Dream puts enemies to sleep in multiple zones while Zaheer's Tornado pulls and immobilizes up to 60 units at once — together they lock down large swarm packs almost continuously since the two crowd-control windows can be staggered on cooldown. Both talents also grant Mage-troop evasion, so whatever AoE troops are clearing take reduced ranged chip damage while the enemy is helpless."
    },
    {
      id: "form-trickster-rush",
      name: "Trickster Fear Rush",
      heroes: ["BRUTALLUS_01", "ATREYA_01"],
      troopArchetype: "Trickster",
      recommendedTroops: ["tr-assassins", "tr-storm-mistresses", "tr-night-hunter", "tr-gravedigger", "tr-axe-throwers"],
      synergyRating: "A",
      reasoning: "Brutallus's Easy Prey makes feared enemies take 45-100% more damage, and Atreya's Smashing Light gives All-Allies a chance to deal double damage on top of a flat damage boost. Feared targets are already taking increased damage before the double-damage proc is even applied, so fast Trickster/Melee-DPS troops can burst down priority targets in one or two hits — ideal for rush-down comps that need to end fights quickly."
    }
  ],

  // 2. SCENARIO GUIDES
  scenarioGuides: [
    {
      scenario: "High-Damage Boss Fight",
      recommendedHeroes: ["HARKON_01", "REMUS_01"],
      primaryTroopType: "Ranged",
      notes: "Prioritize this over Trickster comps for bosses specifically — Remus's Boss-Damage buff and Harkon's snowballing burn zones both reward the longer, single-target nature of boss encounters."
    },
    {
      scenario: "PvP Defense",
      recommendedHeroes: ["DURAND_01", "CALYRA_01"],
      primaryTroopType: "Tank",
      notes: "Durand's tank-specific damage reduction plus Calyra's persistent healing maximizes time-to-break, which is the key defensive metric in PvP base defense."
    },
    {
      scenario: "Swarm Clear",
      recommendedHeroes: ["BUMI_01", "ZAHEER_01"],
      primaryTroopType: "AoE",
      notes: "Stack the two CC windows so one is always active; let AoE troops (Alchemist, Lava Golem, Pyrotechnician) clean up while enemies can't retaliate."
    },
    {
      scenario: "Undead Legion Push (PvE Farming)",
      recommendedHeroes: ["DRAKE_01", "BONE_DRAGON_01"],
      primaryTroopType: "Undead",
      notes: "Best used when your Undead troop roster (Immortal, Headless, Night Hunter, Steel Revenant, Necromancer) is the deepest bench — both buffs are dead weight with any other troop type since they're hard-locked to the Undead tag."
    },
    {
      scenario: "Mage Backline Burst",
      recommendedHeroes: ["ANAVIN_01", "KEYRA_01"],
      primaryTroopType: "Mages",
      notes: "Use when facing high-HP single targets or bunched formations — the stacked attack multipliers reward sustained backline uptime rather than burst windows."
    },
    {
      scenario: "Speed Clear / Fast Rush",
      recommendedHeroes: ["BRUTALLUS_01", "ATREYA_01"],
      primaryTroopType: "Trickster",
      notes: "Best for farming low-resistance stages quickly — fear+crit stacking front-loads damage so fights end before enemy abilities come off cooldown."
    }
  ],

  // 3. EQUIPMENT SYNERGIES
  equipmentSynergies: {
    _dataNote: "The current equipment system in gameKnowledge.js only defines 2 weapons and 2 armors, each granting a flat, role-agnostic mastery bonus (itemLevel * 0.20% per item). There is no stat-typed gear in the source data.",
    availableWeapons: ["Mirage glaive", "Hammer of Devournment"],
    availableArmors: ["armor of devounment", "mirage garment"],
    bonusFormula: "bonusPct = itemLevel * 0.20 per equipped item (0 if slot is 'none'); weaponMasteryBonusPct + armorMasteryBonusPct + heroCollectionBonusPct = totalBonusPct, applied as multiplier = 1 + totalBonusPct/100 to (armyPower + heroPower)",
    roleAllocation: [
      {
        role: "Tank",
        priority: "Level both weapon and armor evenly. Since the bonus is a global power multiplier rather than a stat-specific one, a Tank formation gains identical value from either slot."
      },
      {
        role: "Mage / Ranged DPS",
        priority: "Same flat-multiplier logic applies. There is no current bonus that specifically amplifies attack or cooldown — do not deprioritize armor leveling for DPS formations."
      },
      {
        role: "Support / Healer",
        priority: "Identical treatment — equipment scales total formation power uniformly regardless of hero role."
      }
    ],
    generalRecommendation: "Because both weapon and armor slots contribute additively to the same multiplier, always keep a weapon AND an armor equipped (never 'none') on any active formation."
  },

  // 4. ARENA FORMATIONS
  arena: [
    {
      name: "REGULAR FORM",
      faction: "STABILITY & COUNTER",
      rank: "Beginner Friendly",
      moves: [
        {
          name: "SETUP & GEAR",
          description: "[ HERO REQUIREMENTS ]\n\nPrimary Hero: Tristan (Best Synergy)\n\nSecondary Hero: Flexible (Any legendary with stun capability)\n\n[ TROOP REQUIREMENTS ]\n\n- Immortals: 7x (Lv. 7-10)\n\n- Magic Archers: 7x (Lv. 7-10)\n\n- Cursed Catapults: 8x (Lv. 7-10)\n\n- Necromancers: 2x (Lv. 7-10)\n\n- Alchemists: 4 to 5x (Lv. 7-10)\n\n- Gravediggers: 4 to 5x (Lv. 7-10)\n\n- Undead Mages: 3 to 4x (Lv. 7-10)\n\n- Monks: 2 to 3x (Lv. 7-10)\n\n- Bone Breakers: 2x (Lv. 7-10)\n\n- Shamans: 2x (Lv. 7-10)\n\n- Pyrotechnician: 1x (Lv. 7-10)\n\n► TOTAL CAPACITY: 49 UNITS"
        },
        {
          name: "TACTIC & STRATEGY",
          description: "[ BATTLE DYNAMICS ]\n\nTristan's Core Synergy. This formation is incredibly stable. It delivers high-impact attack and reliable stunning while maintaining excellent healing sustain.\n\n[ HOW IT WORKS ]\n\n1. Damage Absorption & Defense: Immortals and Bone Breakers form a solid frontline.\n\n2. Tactical Positioning: Cursed Catapults are placed on the sides, protecting them from direct damage.\n\n3. Counter-Meta Performance: This formation is highly effective against Skeleton builds and Spider-heavy attacks.\n\n4. Efficiency: With Magic Archers and Catapults providing constant pressure, you can secure wins even when slightly outpowered."
        }
      ]
    }
  ],

  // 5. META & ECONOMY GUIDES
  meta: [
    {
      category: "ECONOMY META",
      title: "The Ultimate Gold Farming & Spending Blueprint",
      summary: "Maximize your gold income in the Arena and learn the strict 50-20-10 reserve blueprint for spending.",
      rules: [
        "Gold is the lifeblood of your army's progression. Mismanaging it will stall your growth.",
        "Part 1: Arena Farming Tactics - For the first 7 days of a new Arena season, set a weak or normal defense formation to farm easy wins.",
        "Part 2: Golden Spending Blueprint - 50% Troop Recruitment, 20% Hero Upgrades, 10% Fusions, 20% Emergency Reserve.",
        "Part 3: Multipliers & Dailies - Run Headhunt sweeps daily and watch ad multipliers."
      ]
    },
    {
      category: "ARENA META",
      title: "The Arena Masterclass: Trophies, Tactics & Psychology",
      summary: "The ultimate guide to Arena domination. Covers the 14-day cycle, trophy math, hidden formations, and hero requirements.",
      rules: [
        "Part 1: 14-Day Season Cycle - First 7 days gold farming, final 7 days trophy pushing.",
        "Part 2: Target Selection & Trophy Math - Maximize gains (+35) and minimize losses (-19).",
        "Part 3: Information Warfare - Hide your best formation on defense; test layouts in clan sparring."
      ]
    },
    {
      category: "ECONOMY META",
      title: "The Premium Gem Matrix: Acquisition & Optimal Spending",
      summary: "Master the secrets of infinite gem farming—including the Library milestone loop—and decode the 40-20-20-10 spending hierarchy.",
      rules: [
        "Part 1: Gem Harvesting - Exploit the Library milestone past 150 books (50 gems per book).",
        "Part 2: Tactical Fusion & Deployment - Use the 10 + 4 + 1 configuration to bypass extreme fusion costs.",
        "Part 3: Clan Gem Budget Matrix - 40% Fusions, 20% Hero Upgrades, 20% Legendary Bundles, 10% Lucky Wheel, 10% Reserves."
      ]
    },
    {
      category: "WARFARE META",
      title: "Operation Clan Clash: Tactical Deployment & Scoring Supremacy",
      summary: "The absolute battlefield manual for the new PvP weekly event.",
      rules: [
        "Part 1: Weekly War Cycle - Thursdays to Sundays.",
        "Part 2: Stage Protocols - Lock defensive formation on Thursday (Preparation Day).",
        "Part 3: Score Formula - [Your Power] + [Enemy Power] + [Defeated Units] = Final Score."
      ]
    },
    {
      category: "TROOPS META",
      title: "The Strategic Army Composition: Baseline Minimum Requirements",
      summary: "The absolute minimum troop quantities and level thresholds required for clan members.",
      rules: [
        "High-Priority Rush: Stone Golem (Lv10), Headless (Lv10).",
        "Core Levels: Lava Golem (3x Lv9), Bone Breaker (1x Lv9), Night Hunter (1x Lv9), Shaman (2x Lv9), Storm Mistress (1x Lv9), Necromancer (2x Lv9), Gravedigger (4x Lv10), Assassins (4x Lv10), Monks (2x Lv10).",
        "Mass Footprint: Magic Archers (6x Lv8), Immortals (6x Lv9), Cursed Catapults (6x), Undead Mages (4x), Alchemists (5x)."
      ]
    }
  ]
};

module.exports = strategies;
