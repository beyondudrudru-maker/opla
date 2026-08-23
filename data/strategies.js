/**
 * MELODY Game Knowledge Library — strategies.js
 * 
 * PURPOSE:
 * Combines formation strategies, scenario guides, equipment synergies, 
 * arena layouts, and meta/economy guides into a single unified module.
 */

const strategies = {
  version: "1.2.0",
  maxHeroesPerFormation: 2,

  // 0. BOSS BATTLE TROOP META (ranked priority tiers for Boss fights specifically)
  bossTroopMeta: {
    _dataNote: "Priority tiers for troop selection in Boss Battles. Abilities/persistent effects matter more than raw stats for bosses — troop choice should be resistance-aware (e.g., prefer Melee troops vs Ranged-Resistant bosses, and vice versa). IMPORTANT: every boss's protection type (Melee or Ranged) ROTATES each season rather than being fixed — confirm the currently active type (from bosses.js resistance data or the player) before recommending a comp, never assume.",
    legendary: ["Bone Breaker", "Axe Thrower", "Headless", "Stone Golem"],
    epic: {
      tier: ["Alchemist", "Storm Mistress", "Lava Golem", "Paladin"],
      notes: "Alchemist is the highest-priority Epic pick for boss fights. Paladin is strictly for defending/shielding melee troops, not for offensive output."
    },
    rare: {
      tier: ["Imp", "Assassin", "Gravedigger"],
      notes: "Imp is the highly preferred Rare pick for boss fights. Gravedigger is best used for close-combat engagement."
    },
    common: ["Archers", "Bone Sphere Thrower"],
    hardExclusions: {
      heroes: ["Harkon", "Fire Fury Xana", "Pyrotechnician"],
      reason: "These heroes' talents/abilities do not function or are explicitly disabled during Boss battles. Never recommend them for Boss fights."
    }
  },

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
      name: "Elite Boss Burst Squad",
      heroes: ["REMUS_01", "TRISTAN_01", "LIREAL_01", "CALYRA_01"],
      f2pAlternative: {
        replaces: "REMUS_01",
        note: "Remus is a Mythical (premium/spin-wheel) hero. For F2P-accessible players, pair Tristan, Lireal, or Calyra with a more accessible boss-damage hero instead of Remus, and lean on the Legendary/Epic troop tiers (Bone Breaker, Axe Thrower, Headless, Alchemist) to make up the damage gap."
      },
      troopArchetype: "Mixed DPS",
      // 🛠️ FIX: "tr-assassin" was a typo for the real "tr-assassins"; "tr-bone-thrower",
      // "tr-archer", and "tr-paladin" don't exist anywhere in troops.js (verified against
      // the full real troop-id list) and have been removed rather than guessed at.
      recommendedTroops: ["tr-imp", "tr-alchemist", "tr-bonebreaker", "tr-headless", "tr-storm-mistresses", "tr-assassins", "tr-axe-throwers"],
      troopDeploymentNote: "Adapt troop composition to the specific boss's CURRENTLY ACTIVE resistance for this season (it rotates — never assume): deploy Melee troops (Bone Breaker, Headless, Gravedigger) if the boss is Ranged-Resistant this season, and Ranged troops (Axe Thrower, Archer, Bone Sphere Thrower) if it is Melee-Resistant this season.",
      synergyRating: "S",
      reasoning: "For maximum boss damage, stick strictly to the approved roster. Remus provides massive boss-specific damage buffs, and abilities/persistent effects matter far more than raw stats here. Pair him with sustain/utility heroes like Tristan, Lireal, or Calyra. WARNING: Never use Harkon, Fire Fury Xana, or Pyrotechnician in this formation — their talents/abilities do not function in boss battles."
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
    },
    // 🆕 MERGED FROM synergies.js's `formations` array (2026-08-23). That array was
    // never read by gameDomainRouter.js — only this optimalFormations array is — so
    // these 5 curated formations were dead data until now. All hero/troop names below
    // were re-verified against heroes.js/troops.js and normalized to this file's id
    // schema. synergyRating wasn't present on the source objects, so "A" is an assigned
    // default (not sourced from synergies.js) — adjust per-formation if you have an
    // actual tier in mind.
    {
      id: "formation-human-tank-wall",
      name: "Human Tank Wall",
      heroes: ["DRAGON_RIDER_01", "DURAND_01", "TRISTAN_01"],
      troopArchetype: "Human",
      recommendedTroops: ["tr-bonebreaker", "tr-monk", "tr-axe-throwers", "tr-pyrotechnician", "tr-alchemist"],
      synergyRating: "A",
      recommendedGear: "Equip Bonebreaker and Monk with the Devourment Set (Hammer of Devourment + Armor of Devourment). Armor of Devourment cuts the reflected damage this frontline takes; Hammer of Devourment then turns any reflected damage it does take into bonus damage on the tank's (and the units behind it's) next basic attack — see gearData.js gearCatalog for full level-by-level scaling.",
      reasoning: "Bonebreaker and Monk both carry combatLine \"Frontline\" and synergyCategories including \"Human\"/\"Tank\", matching Dragon Rider's supportFocus of \"Human Troops\" (attack buff) and Durand/Tristan's \"All Troops\" buffs — the frontline absorbs hits while Axe Throwers and Pyrotechnician deal Backline-DPS damage behind it."
    },
    {
      id: "formation-mage-backline-bombardment",
      name: "Mage Backline Bombardment",
      heroes: ["ANAVIN_01", "EDELINA_01", "KEYRA_01", "ZAHEER_01", "SIGURD_01", "OPHELIA_01", "LIREAL_01"],
      troopArchetype: "Mages",
      recommendedTroops: ["tr-lava-golem", "tr-magic-archer", "tr-shaman"],
      synergyRating: "A",
      reasoning: "Magic Archer and Shaman both resolve to combatLine \"Backline\" with synergyCategories tagging \"Mages\"/\"Backline-DPS\". Every listed hero except Lirael has supportFocus \"Mage Troops\", so their attack/HP/defense buffs stack directly onto this backline, while Lava Golem (Frontline) tanks hits so the casters stay alive to output damage. Lirael's supportFocus is \"All Troops\" (Song of Courage hits All Allies), but her troop-count-scaling passive and attack/damage-reduction ability still buff this same lineup, adding army-wide burst windows on top of the faction-locked stacking."
    },
    {
      id: "formation-undead-endless-swarm",
      name: "Undead Endless Swarm",
      heroes: ["DRAKE_01", "BONE_DRAGON_01", "MORGRANE_01", "MORGANA_01"],
      troopArchetype: "Undead",
      recommendedTroops: ["tr-immortal", "tr-headless", "tr-steel-revenant", "tr-night-hunter", "tr-gravedigger", "tr-necromancer", "tr-cursed-catapult"],
      synergyRating: "A",
      recommendedGear: "Equip the Devourment Set (Hammer of Devourment + Armor of Devourment) on Immortal, Headless, or Steel Revenant — Steel Revenant is the strongest fit since its own troop ability already reflects damage back at attackers, so Armor of Devourment's reflected-damage reduction stacks with its native kit while Hammer of Devourment converts remaining reflect exposure into offense.",
      reasoning: "Immortal, Headless, and Steel Revenant all share combatLine \"Frontline\" and the \"Undead\"/\"Tank\" synergyCategories. Drake and Bone Dragon both carry supportFocus \"Undead Troops\" (attack buff), directly scaling this wall, while Morgrane and Morgana add Enemy Control and Ally Summons (per their supportFocus extras) to keep Necromancer's skeleton-summon backline continuously reinforced."
    },
    {
      id: "formation-aerial-strike-force",
      name: "Aerial Strike Force",
      heroes: ["ANAVIN_01", "DRAKE_01", "REMUS_01"],
      troopArchetype: "Mixed",
      recommendedTroops: ["tr-phoenix", "tr-imp"],
      synergyRating: "A",
      reasoning: "Phoenix (Mages) and Imp (Undead) are the only two troops with combatLine \"Aerial\" in the dataset. Because they span two factions, no single-faction buffer covers both — Anavin covers Phoenix (supportFocus \"Mage Troops\"), Drake covers Imp (supportFocus \"Undead Troops\"), and Remus's \"All Troops\" buff is the one hero that benefits both simultaneously."
    },
    {
      id: "formation-faction-agnostic-support-core",
      name: "Faction-Agnostic Support Core",
      heroes: ["CALYRA_01", "ATREYA_01", "REMUS_01", "TRISTAN_01", "HARKON_01", "BUMI_01", "DURAND_01"],
      troopArchetype: "Mixed",
      recommendedTroops: [],
      synergyRating: "A",
      reasoning: "These heroes all resolved to a primary supportFocus of \"All Troops\" because their talent/ability targets field is literally [\"All Allies\"], rather than a faction-specific type like \"Mage\" or \"Undead\". That makes them safe defaults when the router cannot confidently resolve which faction formation a request is about. Not a troop lineup on its own — this hero core can be slotted behind any of the faction formations above without losing value."
    }
  ],

  // 2. SCENARIO GUIDES
  scenarioGuides: [
    {
      scenario: "General Boss Fights (Kalidor, Balthazar, Ashira)",
      recommendedHeroes: ["Lireal", "Calyra", "Remus", "Tristan", "Anavin", "Drake", "Dragon Rider", "Bone Dragon"],
      f2pAlternative: "Remus is a premium/spin-wheel Mythical hero. F2P players should lean on Lireal, Calyra, Tristan, Drake, or Bone Dragon for sustain/damage instead, and prioritize the Legendary troop tier (Bone Breaker, Axe Thrower, Headless, Stone Golem) to close the gap.",
      recommendedTroops: ["Imp", "Alchemist", "Bone Breaker", "Headless", "Storm Mistress", "Assassin", "Bone Thrower", "Archer", "Paladin", "Axe Thrower"],
      troopMetaTiers: {
        legendary: ["Bone Breaker", "Axe Thrower", "Headless", "Stone Golem"],
        epic: ["Alchemist (highest priority)", "Storm Mistress", "Lava Golem", "Paladin (melee-defense only)"],
        rare: ["Imp (highly preferred)", "Assassin", "Gravedigger (close combat)"],
        common: ["Archers", "Bone Sphere Thrower"]
      },
      troopDeploymentNote: "Adapt troop choice to the boss's CURRENTLY ACTIVE resistance for this season (it rotates between Melee and Ranged — never assume which one is active): Melee troops if it's Ranged-Resistant this season, Ranged troops if it's Melee-Resistant this season.",
      notes: "For maximum efficiency against bosses, stick strictly to the approved roster above. Heroes like Remus provide massive boss-damage buffs, while Calyra and Tristan provide the necessary sustain. Abilities and persistent effects matter far more than raw stats for boss fights. WARNING: Do not use Harkon, Fire Fury Xana, or Pyrotechnician — their talents/abilities are disabled or non-functional during boss fights."
    },
    {
      scenario: "Kraken Boss / Dagon: Max Score Timings",
      recommendedHeroes: ["Bone Dragon"],
      primaryTroopType: "High Single-Target DPS",
      notes: "CRUCIAL TACTICS:\n1. 🛑 Turn OFF Auto Hero Ability!\n2. 🐉 Place Bone Dragon at the RIGHT of the formation.\n\nFollow these precise target timings for maximum damage:\n\n⏱️ Minute 4\n4:51 Mouth\n4:39 Barrel\n4:24 Tentacles\n4:13 Barrel\n4:03 Tentacles\n\n⏱️ Minute 3\n3:40 Tentacles\n3:21 Tentacles\n3:10 Mouth\n3:00 Tentacles\n\n⏱️ Minute 2\n2:37 Tentacles\n2:18 Tentacles\n2:07 Mouth\n\n⏱️ Minute 1\n1:56 Tentacles\n1:34 Tentacles\n1:15 Tentacles\n1:04 Mouth\n\n⏱️ Minute 0\n0:54 Tentacles\n0:31 Tentacles\n0:21 Mouth\n0:11 Tentacles"
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

  // 4. COUNTER-STRIKE GUIDES (NEW)
  counterGuides: [
    {
      targetOpponent: "Durand",
      targetArchetype: "Heavy Tank / Frontline Protector",
      recommendedHeroes: ["BRUTALLUS_01", "ATREYA_01", "REMUS_01"],
      recommendedTroops: ["tr-assassins", "tr-axe-throwers", "tr-bonebreaker"],
      tacticalAdvice: "Durand provides massive damage reduction to frontline tanks. Do not try to out-sustain him. Instead, use heroes with high burst damage (Brutallus/Atreya) or anti-tank buffs (Remus). Deploy Axe Throwers or Assassins to bypass his frontline shield and strike the backline directly."
    },
    {
      targetOpponent: "Morgana",
      targetArchetype: "Undead Summoner / Swarm",
      recommendedHeroes: ["BUMI_01", "ZAHEER_01", "HARKON_01"],
      recommendedTroops: ["tr-alchemist", "tr-storm-mistresses", "tr-pyrotechnician"],
      tacticalAdvice: "Morgana will attempt to overwhelm your forces with continuous Undead summons. You must counter her with heavy AoE (Area of Effect) damage and crowd control. Use Zaheer to group her summons, or Bumi/Harkon to lay down massive area damage to clear the skeletons before they snowball."
    },
    {
      // Grounded against real troops.js data: Magic Archer is combatLine
      // "Backline", primaryRole "Ranger", analysis.weaknesses = ["Low
      // movement speed"]. It can't reposition once your frontline closes
      // the distance, and it has no way to disengage from a direct strike.
      targetOpponent: "Magic Archer",
      targetArchetype: "Backline Ranger / Piercing-Arrow DPS",
      recommendedHeroes: ["DRAKE_01", "BONE_DRAGON_01", "DRAGON_RIDER_01"],
      recommendedTroops: ["tr-steel-revenant", "tr-assassins", "tr-storm-mistresses"],
      tacticalAdvice: "Magic Archer hits hard at max range but has Low movement speed and no self-peel — once engaged, it cannot reposition to re-open the gap. Send a heavy Frontline Tank (Steel Revenant or Stone Golem) forward to absorb its piercing volleys while closing distance, then route Assassins or Storm Mistresses — this dataset's real infiltration troops, both tagged Trickster/Midline — past the frontline to strike it directly rather than trying to out-range it."
    }
  ],

  // 5. ARENA FORMATIONS
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

  // 6. META & ECONOMY GUIDES
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
