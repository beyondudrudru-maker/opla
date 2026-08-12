/**
 * MELODY Game Knowledge Library — Troops
 * Each troop includes standardized faction/type fields plus tags[],
 * analysis{}, and full level scaling data (levels.hp/damage/defense/units).
 *
 * SCHEMA ADDITIONS (Data Architecture Overhaul, Phase 1)
 * ────────────────────────────────────────────────────────
 *  - combatLine: "Frontline" | "Midline" | "Backline" | "Aerial"
 *      Positional role in a formation. Derived from tags (Frontline /
 *      Backline-DPS) plus manual verification against unit descriptions
 *      for the two airborne units (Phoenix, Imp) whose tags didn't already
 *      encode flight.
 *  - synergyCategories: string[]
 *      Broad synergy tags for router matching — the troop's existing
 *      tags[], deduped, plus an optional data-driven "High-HP"/"Low-HP"
 *      tier computed from level-10 per-unit HP relative to same-role peers.
 *  - recommendedHeroes: string[]
 *      Hero short-names known to buff this troop, pulled directly from the
 *      already-curated synergies.js troopHeroSynergy reasoning (not
 *      re-derived) so the two files can never drift out of sync.
 *  - optimalGear: { weapons: string[], armors: string[] }
 *      Placeholder gear recommendations — no gear system exists yet in the
 *      source game data, so these are invented but follow a deterministic
 *      faction+role naming template (see router/gearTemplates in
 *      strategyContextBuilder-adjacent tooling) rather than being ad hoc.
 */
const troops = [
  {
    "id": "tr-immortal",
    "name": "Immortal",
    "rarity": "epic",
    "categories": [
      "Undead",
      "Tank"
    ],
    "description": "One swing of his sword sows death and panic in the enemy's army.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1.6,
      "attackRange": "1.7 m",
      "aoeRadius": "3 m"
    },
    "ability": null,
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        2600,
        3300,
        4800,
        6500,
        12400,
        17300,
        21200,
        26500,
        46700,
        52440
      ],
      "damage": [
        200,
        260,
        350,
        410,
        470,
        530,
        590,
        650,
        1100,
        1360
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Undead",
      "Tank",
      "Melee",
      "AoE",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Undead"
      ],
      "strengths": [
        "Strong frontline durability"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Undead",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Undead",
      "Tank",
      "Melee",
      "AoE",
      "Frontline",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Bone Warhammer",
        "Grave Bulwark Mace"
      ],
      "armors": [
        "Wraith Plate",
        "Ashen Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-phoenix",
    "name": "Phoenix",
    "rarity": "legendary",
    "categories": [
      "Mages",
      "Ranger",
      "Tank"
    ],
    "description": "A legendary fire bird that can be reborn from the ashes.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1.2,
      "attackRange": "Max.",
      "aoeRadius": "3 m"
    },
    "ability": {
      "name": "Rebirth",
      "description": "Upon taking fatal damage, the Phoenix turns into a burning egg that explodes and deals damage to enemies. After the explosion, the Phoenix is reborn.",
      "levelStats": {
        "Rebirths Number": [
          1,
          1,
          1,
          1,
          2,
          2,
          2,
          3,
          3,
          3
        ],
        "Damage": [
          300,
          350,
          350,
          400,
          450,
          450,
          500,
          500,
          500,
          600
        ],
        "AOE Radius": [
          "3 m",
          "3 m",
          "3.5 m",
          "3.5 m",
          "3.5 m",
          "4 m",
          "4 m",
          "4 m",
          "4.5 m",
          "5 m"
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        1500,
        3000,
        5250,
        7500,
        10500,
        13500,
        16500,
        19500,
        37500,
        45000
      ],
      "damage": [
        150,
        185,
        220,
        255,
        290,
        325,
        360,
        395,
        430,
        465
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Mages",
      "Ranger",
      "Tank",
      "Ranged",
      "AoE",
      "Low-HP Scaling",
      "Revival",
      "Frontline",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Mages",
        "Ranger"
      ],
      "strengths": [
        "Long-range attacker",
        "Strong frontline durability"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Mages",
    "type": "Tank",
    "combatLine": "Aerial",
    "synergyCategories": [
      "Mages",
      "Ranger",
      "Tank",
      "Ranged",
      "AoE",
      "Low-HP Scaling",
      "Revival",
      "Frontline",
      "Backline-DPS",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Anavin",
      "Edelina",
      "Keyra",
      "Zaheer",
      "Sigurd",
      "Ophelia"
    ],
    "optimalGear": {
      "weapons": [
        "Runic Talons",
        "Ether Wingblades"
      ],
      "armors": [
        "Starforged Windrider Harness",
        "Mystic Scale Mail"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-alchemist",
    "name": "Alchemist",
    "rarity": "epic",
    "categories": [
      "Human",
      "Support"
    ],
    "description": "Her potions are as good at healing as they are killing.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1,
      "attackRange": "Max.",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Meds Jar",
      "description": "Throws a healing projectile at an ally.",
      "levelStats": {
        "AOE Radius": [
          "5 m",
          "5 m",
          "5 m",
          "5 m",
          "5 m",
          "5 m",
          "5 m",
          "5 m",
          "5 m",
          "5 m"
        ],
        "Healing": [
          150,
          175,
          200,
          225,
          250,
          275,
          300,
          325,
          350,
          400
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        5,
        7,
        9,
        9,
        9,
        9,
        9,
        9,
        9
      ],
      "hp": [
        1200,
        1500,
        2200,
        3500,
        5400,
        7300,
        9200,
        11100,
        19425,
        23700
      ],
      "damage": [
        200,
        240,
        320,
        440,
        520,
        600,
        680,
        960,
        1330,
        1630
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Human",
      "Support",
      "Ranged",
      "AoE",
      "Healer"
    ],
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Human"
      ],
      "strengths": [
        "Long-range attacker",
        "Utility/support value"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Human",
    "type": "Support",
    "combatLine": "Backline",
    "synergyCategories": [
      "Human",
      "Support",
      "Ranged",
      "AoE",
      "Healer",
      "High-HP"
    ],
    "recommendedHeroes": [
      "Dragon Rider"
    ],
    "optimalGear": {
      "weapons": [
        "Kingsguard Scepter",
        "Forged Ritual Wand"
      ],
      "armors": [
        "Valorous Vestments",
        "Militia Ward Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Support",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Support role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  },
  {
    "id": "tr-lava-golem",
    "name": "Lava Golem",
    "rarity": "epic",
    "categories": [
      "Mages",
      "Tank"
    ],
    "description": "A clump of magma. If disturbed, can easily turn into a furious flaming creature that incinerates everything it touches.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1.1,
      "attackRange": "1.4 m",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Fire Form",
      "description": "The Lava Golem sheds its armor when its HP is less than half, increasing its attack and movement speeds. When it dies, it deals damage to all surrounding enemies.",
      "levelStats": {
        "Damage": [
          300,
          400,
          500,
          600,
          700,
          800,
          900,
          1000,
          1100,
          1200
        ],
        "AOE Radius": [
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m",
          "4.5 m"
        ],
        "Attack Speed Multiplier": [
          0.8,
          0.7,
          0.7,
          0.7,
          0.6,
          0.6,
          0.6,
          0.5,
          0.5,
          0.4
        ],
        "Movement Speed Multiplier": [
          1.4,
          1.5,
          1.5,
          1.6,
          1.6,
          1.7,
          1.7,
          1.8,
          1.8,
          1.9
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        3300,
        4200,
        5700,
        9500,
        14800,
        20500,
        24800,
        30400,
        55750,
        64345
      ],
      "damage": [
        270,
        390,
        540,
        660,
        740,
        860,
        940,
        1020,
        1910,
        2340
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Mages",
      "Tank",
      "Melee",
      "AoE",
      "Low-HP Scaling",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Mages"
      ],
      "strengths": [
        "High HP",
        "High Damage",
        "Strong frontline durability"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Mages",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Mages",
      "Tank",
      "Melee",
      "AoE",
      "Low-HP Scaling",
      "Frontline"
    ],
    "recommendedHeroes": [
      "Anavin",
      "Edelina",
      "Keyra",
      "Zaheer",
      "Sigurd",
      "Ophelia"
    ],
    "optimalGear": {
      "weapons": [
        "Starforged Warhammer",
        "Mystic Bulwark Mace"
      ],
      "armors": [
        "Sorcerous Plate",
        "Arcane Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-shaman",
    "name": "Shaman",
    "rarity": "legendary",
    "categories": [
      "Mages",
      "Ranger",
      "Support"
    ],
    "description": "Two options: he'll either save the village from drought or not. Shaman attacks six enemies at once with chain lightning.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1,
      "attackRange": "Max.",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Hex",
      "description": "Turns an enemy into a harmless beastie, blocking all their abilities.",
      "levelStats": {
        "Duration": [
          "2 s",
          "2 s",
          "2 s",
          "2 s",
          "2 s",
          "2 s",
          "2 s",
          "2 s",
          "2 s",
          "2 s"
        ],
        "Enemies Amount": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        2000,
        4000,
        7000,
        10000,
        14000,
        18000,
        22000,
        26000,
        45500,
        65000
      ],
      "damage": [
        120,
        165,
        210,
        250,
        290,
        330,
        365,
        400,
        435,
        470
      ],
      "defense": [
        10,
        16,
        25,
        34,
        43,
        52,
        61,
        70,
        79,
        88
      ]
    },
    "tags": [
      "Mages",
      "Ranger",
      "Support",
      "Ranged",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Mages",
        "Ranger"
      ],
      "strengths": [
        "High HP",
        "Long-range attacker",
        "Utility/support value"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Mages",
    "type": "Support",
    "combatLine": "Backline",
    "synergyCategories": [
      "Mages",
      "Ranger",
      "Support",
      "Ranged",
      "Backline-DPS",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Anavin",
      "Edelina",
      "Keyra",
      "Zaheer",
      "Sigurd",
      "Ophelia"
    ],
    "optimalGear": {
      "weapons": [
        "Mystic Scepter",
        "Sorcerous Ritual Wand"
      ],
      "armors": [
        "Arcane Vestments",
        "Runic Ward Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Support",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Support role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  },
  {
    "id": "tr-stone-golem",
    "name": "Stone Golem",
    "rarity": "legendary",
    "categories": [
      "Mages",
      "Support",
      "Tank"
    ],
    "description": "A slow but destructive stone elemental summoned by mages to hold back enemy onslaughts. Sometimes throws surprise boulders at enemies.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1,
      "attackRange": "1.2 m",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Rockfall",
      "description": "The stone golem picks up stones from the ground and flings them forward. All enemy units in its path are damaged, and the boulders split into two small copies of the golem.",
      "levelStats": {
        "Number": [
          2,
          2,
          2,
          2,
          2,
          2,
          2,
          2,
          2,
          2
        ],
        "Damage": [
          350,
          400,
          450,
          500,
          550,
          600,
          650,
          700,
          750,
          800
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        4000,
        7000,
        11000,
        16000,
        22000,
        29000,
        37000,
        46000,
        63500,
        91500
      ],
      "damage": [
        270,
        320,
        370,
        420,
        470,
        520,
        570,
        620,
        1250,
        1630
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Mages",
      "Support",
      "Tank",
      "Melee",
      "Summoner",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Mages",
        "Support"
      ],
      "strengths": [
        "High HP",
        "Strong frontline durability",
        "Utility/support value"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "summon": {
      "id": "tr-stone-golem:summon",
      "name": "Small Golem",
      "description": "A deadly little elemental.",
      "baseStats": {
        "speed": "Low",
        "attackSpeed": 1,
        "attackRange": "0.5 m",
        "aoeRadius": "-"
      },
      "levels": {
        "level": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "units": [
          2,
          2,
          2,
          2,
          2,
          2,
          2,
          2,
          2,
          2
        ],
        "hp": [
          2000,
          3500,
          5500,
          8000,
          11000,
          14500,
          18500,
          23000,
          31750,
          45750
        ],
        "damage": [
          135,
          160,
          185,
          210,
          235,
          260,
          285,
          310,
          625,
          815
        ],
        "defense": [
          20,
          25,
          30,
          35,
          40,
          45,
          50,
          55,
          60,
          65
        ]
      }
    },
    "faction": "Mages",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Mages",
      "Support",
      "Tank",
      "Melee",
      "Summoner",
      "Frontline",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Anavin",
      "Edelina",
      "Keyra",
      "Zaheer",
      "Sigurd",
      "Ophelia"
    ],
    "optimalGear": {
      "weapons": [
        "Sorcerous Warhammer",
        "Arcane Bulwark Mace"
      ],
      "armors": [
        "Runic Plate",
        "Ether Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-bonebreaker",
    "name": "Bonebreaker",
    "rarity": "legendary",
    "categories": [
      "Human",
      "Trickster",
      "Tank"
    ],
    "description": "Bonebreakers always hold back their rage. Only battles help them realize their full potential!",
    "baseStats": {
      "speed": "High",
      "attackSpeed": 1.2,
      "attackRange": "1.2 m"
    },
    "ability": {
      "name": "Beast Rage",
      "description": "With every third hit, bonebreakers increase in size and deal more damage.",
      "levelStats": {
        "Damage Increase per Effect": [
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%"
        ],
        "Maximum Effects": [
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        5,
        7,
        9,
        9,
        9,
        9,
        9,
        9,
        9
      ],
      "hp": [
        1800,
        2100,
        3050,
        4500,
        8400,
        12300,
        16200,
        20400,
        35700,
        42840
      ],
      "damage": [
        150,
        170,
        210,
        260,
        320,
        385,
        450,
        520,
        950,
        1420
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ],
      "evasion": [
        "0.5%",
        "1%",
        "1.5%",
        "2%",
        "2.5%",
        "3%",
        "3.5%",
        "4%",
        "4.5%",
        "5%"
      ]
    },
    "tags": [
      "Human",
      "Trickster",
      "Tank",
      "Melee",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Human",
        "Trickster"
      ],
      "strengths": [
        "Strong frontline durability"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Human",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Human",
      "Trickster",
      "Tank",
      "Melee",
      "Frontline",
      "High-HP"
    ],
    "recommendedHeroes": [
      "Dragon Rider"
    ],
    "optimalGear": {
      "weapons": [
        "Iron Warhammer",
        "Steel Bulwark Mace"
      ],
      "armors": [
        "Kingsguard Plate",
        "Forged Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-headless",
    "name": "Headless",
    "rarity": "legendary",
    "categories": [
      "Undead",
      "Support",
      "Tank"
    ],
    "description": "The human army commanders, once executed for treason long ago. After death, they became the elite of the undead army.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1.4,
      "attackRange": "1.4 m",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Mind Control",
      "description": "Headless take control of enemy units temporarily. After 2 seconds of control, the ability is interrupted once they receive damage.",
      "levelStats": {
        "Duration": [
          "3 s",
          "3 s",
          "3 s",
          "4 s",
          "4 s",
          "4 s",
          "5 s",
          "5 s",
          "5 s",
          "6 s"
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        3600,
        4500,
        6600,
        10500,
        16200,
        21900,
        27600,
        33000,
        58275,
        69930
      ],
      "damage": [
        300,
        420,
        600,
        720,
        840,
        960,
        1080,
        1200,
        2100,
        2520
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Undead",
      "Support",
      "Tank",
      "Melee",
      "Crowd-Control",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Undead",
        "Support"
      ],
      "strengths": [
        "High HP",
        "High Damage",
        "Strong frontline durability",
        "Utility/support value"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Undead",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Undead",
      "Support",
      "Tank",
      "Melee",
      "Crowd-Control",
      "Frontline"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Grave Warhammer",
        "Wraith Bulwark Mace"
      ],
      "armors": [
        "Ashen Plate",
        "Soulbound Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-magic-archer",
    "name": "Magic Archer",
    "rarity": "epic",
    "categories": [
      "Mages",
      "Ranger"
    ],
    "description": "Skilled archers who enchant their arrows to fly through enemy units and deal huge damage to everyone in their path.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1.2,
      "attackRange": "Max.",
      "aoeRadius": "-"
    },
    "ability": null,
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        1800,
        2100,
        3050,
        4500,
        8400,
        12300,
        16200,
        20400,
        35700,
        42840
      ],
      "damage": [
        105,
        135,
        165,
        200,
        235,
        270,
        310,
        350,
        450,
        735
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Mages",
      "Ranger",
      "Ranged",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Mages"
      ],
      "strengths": [
        "Long-range attacker"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Mages",
    "type": "Ranger",
    "combatLine": "Backline",
    "synergyCategories": [
      "Mages",
      "Ranger",
      "Ranged",
      "Backline-DPS"
    ],
    "recommendedHeroes": [
      "Anavin",
      "Edelina",
      "Keyra",
      "Zaheer",
      "Sigurd",
      "Ophelia"
    ],
    "optimalGear": {
      "weapons": [
        "Ether Longbow",
        "Starforged War Crossbow"
      ],
      "armors": [
        "Mystic Leathers",
        "Sorcerous Skirmish Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Ranger",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Ranger role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  },
  {
    "id": "tr-monk",
    "name": "Monk",
    "rarity": "epic",
    "categories": [
      "Human",
      "Tank"
    ],
    "description": "Monks' deceptive appearance hides dangerous fighters. Quick strikes to weak points help monks to defeat any opponent.",
    "baseStats": {
      "speed": "High",
      "attackSpeed": 1.2,
      "attackRange": "1.2 m",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Vengeful Spirit",
      "description": "After the unit's death, Vengeful Spirit appears and takes part in battle for a while.",
      "levelStats": {
        "Spirit Lifetime": [
          "3 s",
          "3 s",
          "3 s",
          "3 s",
          "4 s",
          "4 s",
          "4 s",
          "4 s",
          "4 s",
          "4 s"
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        5,
        7,
        9,
        9,
        9,
        9,
        9,
        9,
        9
      ],
      "hp": [
        1200,
        1500,
        2200,
        3500,
        5400,
        7300,
        9200,
        11000,
        19425,
        42840
      ],
      "damage": [
        100,
        140,
        200,
        240,
        280,
        320,
        360,
        400,
        700,
        1420
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Human",
      "Tank",
      "Melee",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Human"
      ],
      "strengths": [
        "Strong frontline durability"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Human",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Human",
      "Tank",
      "Melee",
      "Frontline",
      "High-HP"
    ],
    "recommendedHeroes": [
      "Dragon Rider"
    ],
    "optimalGear": {
      "weapons": [
        "Forged Warhammer",
        "Valorous Bulwark Mace"
      ],
      "armors": [
        "Militia Plate",
        "Iron Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-assassins",
    "name": "Assassins",
    "rarity": "epic",
    "categories": [
      "Human",
      "Trickster"
    ],
    "description": "We're sneaking around the shadows!",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1,
      "attackRange": "1.3 m"
    },
    "ability": {
      "name": "Teleport",
      "description": "Teleports you to the enemy.",
      "levelStats": null
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        5,
        7,
        9,
        9,
        9,
        9,
        9,
        9,
        9
      ],
      "hp": [
        700,
        800,
        1000,
        1500,
        2800,
        4000,
        5500,
        7000,
        12250,
        17500
      ],
      "damage": [
        110,
        130,
        170,
        230,
        270,
        330,
        390,
        450,
        788,
        1125
      ],
      "defense": [
        10,
        15,
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55
      ],
      "evasion": [
        "0.5%",
        "1%",
        "1.5%",
        "2%",
        "2.5%",
        "3%",
        "3.5%",
        "4%",
        "4.5%",
        "5%"
      ]
    },
    "tags": [
      "Human",
      "Trickster",
      "Melee"
    ],
    "analysis": {
      "primaryRole": "Trickster",
      "secondaryRoles": [
        "Human"
      ],
      "strengths": [
        "Burst mobility to reach backline targets"
      ],
      "weaknesses": [
        "Low sustained damage without support"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Human",
    "type": "Trickster",
    "combatLine": "Midline",
    "synergyCategories": [
      "Human",
      "Trickster",
      "Melee"
    ],
    "recommendedHeroes": [
      "Dragon Rider"
    ],
    "optimalGear": {
      "weapons": [
        "Valorous Twin Daggers",
        "Militia Serrated Kris"
      ],
      "armors": [
        "Iron Stalker Garb",
        "Steel Shadow Wraps"
      ]
    },
  "realGear": {
    "roleFamily": "Trickster",
    "hasRealGearData": true,
    "weapon": "Mirage Glaive",
    "armor": "Mirage Garment",
    "note": "Next basic Trickster attack deals additional damage. (Mirage Glaive) paired with Tricksters gain a chance to evade basic AOE attacks entirely. (Mirage Garment)."
  }
  },
  {
    "id": "tr-storm-mistresses",
    "name": "Storm Mistresses",
    "rarity": "epic",
    "categories": [
      "Mages",
      "Trickster"
    ],
    "description": "Experienced warriors who know how to tame the full power of storms. Fully elusive on the battlefield.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1,
      "attackRange": "1.2 m"
    },
    "ability": {
      "name": "Lightning Jump",
      "description": "Storm Mistresses throw a lightning spear at the enemy and follow behind it directly.",
      "levelStats": {
        "Damage": [
          120,
          160,
          240,
          300,
          360,
          420,
          480,
          540,
          920,
          1120
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        5,
        7,
        9,
        9,
        9,
        9,
        9,
        9,
        9
      ],
      "hp": [
        1100,
        1400,
        2050,
        3400,
        5150,
        7050,
        8900,
        10500,
        17750,
        21100
      ],
      "damage": [
        120,
        160,
        240,
        300,
        360,
        420,
        480,
        540,
        920,
        1120
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ],
      "evasion": [
        "0.5%",
        "1%",
        "1.5%",
        "2%",
        "2.5%",
        "3%",
        "3.5%",
        "4%",
        "4.5%",
        "5%"
      ]
    },
    "tags": [
      "Mages",
      "Trickster",
      "Melee"
    ],
    "analysis": {
      "primaryRole": "Trickster",
      "secondaryRoles": [
        "Mages"
      ],
      "strengths": [
        "High mobility strike",
        "Chains gap-closing attacks"
      ],
      "weaknesses": [
        "Fragile without frontline cover"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Mages",
    "type": "Trickster",
    "combatLine": "Midline",
    "synergyCategories": [
      "Mages",
      "Trickster",
      "Melee",
      "High-HP"
    ],
    "recommendedHeroes": [
      "Anavin",
      "Edelina",
      "Keyra",
      "Zaheer",
      "Sigurd",
      "Ophelia"
    ],
    "optimalGear": {
      "weapons": [
        "Sorcerous Twin Daggers",
        "Arcane Serrated Kris"
      ],
      "armors": [
        "Runic Stalker Garb",
        "Ether Shadow Wraps"
      ]
    },
  "realGear": {
    "roleFamily": "Trickster",
    "hasRealGearData": true,
    "weapon": "Mirage Glaive",
    "armor": "Mirage Garment",
    "note": "Next basic Trickster attack deals additional damage. (Mirage Glaive) paired with Tricksters gain a chance to evade basic AOE attacks entirely. (Mirage Garment)."
  }
  },
  {
    "id": "tr-cursed-catapult",
    "name": "Cursed Catapult",
    "rarity": "rare",
    "categories": [
      "Undead",
      "Ranger"
    ],
    "description": "An undead army trophy catapult strengthened by dark magic. Sometimes uses skeletons as projectiles for sudden attacks from behind enemy lines.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1,
      "attackRange": "Max.",
      "aoeRadius": "4 m"
    },
    "ability": {
      "name": "Skeleton Shot",
      "description": "The cursed catapult launches a skeleton ball that summons skeletons when it lands.",
      "levelStats": {
        "Number": [
          1,
          1,
          1,
          1,
          2,
          2,
          2,
          3,
          3,
          3
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        1000,
        1800,
        2400,
        3200,
        4000,
        5000,
        6000,
        7000,
        8000,
        9000
      ],
      "damage": [
        210,
        250,
        290,
        330,
        380,
        430,
        490,
        600,
        1150,
        1440
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Undead",
      "Ranger",
      "Ranged",
      "AoE",
      "Summoner",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Undead"
      ],
      "strengths": [
        "Long-range attacker"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "moderate",
        "damage": "weak"
      }
    },
    "summon": {
      "id": "tr-cursed-catapult:summon",
      "name": "Skeleton",
      "description": "Made up of bones and bone marrow.",
      "baseStats": {
        "speed": "Medium",
        "attackSpeed": 1,
        "attackRange": "1 m",
        "aoeRadius": "-"
      },
      "levels": {
        "level": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "units": [
          1,
          1,
          1,
          1,
          2,
          2,
          2,
          3,
          3,
          3
        ],
        "hp": [
          600,
          800,
          1000,
          1200,
          1400,
          1600,
          1800,
          2000,
          3850,
          4700
        ],
        "damage": [
          80,
          100,
          140,
          200,
          240,
          280,
          320,
          360,
          630,
          770
        ],
        "defense": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    },
    "faction": "Undead",
    "type": "Ranger",
    "combatLine": "Backline",
    "synergyCategories": [
      "Undead",
      "Ranger",
      "Ranged",
      "AoE",
      "Summoner",
      "Backline-DPS",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Bone Longbow",
        "Grave War Crossbow"
      ],
      "armors": [
        "Wraith Leathers",
        "Ashen Skirmish Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Ranger",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Ranger role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  },
  {
    "id": "tr-imp",
    "name": "Imp",
    "rarity": "rare",
    "categories": [
      "Undead",
      "Ranger"
    ],
    "description": "Vile creatures resurrected by some crazy magician. They're ideal for bombarding the enemy from the air.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1.2,
      "attackRange": "Max.",
      "aoeRadius": "-"
    },
    "ability": null,
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        1800,
        2100,
        3050,
        4500,
        8400,
        12300,
        16200,
        20400,
        35700,
        42840
      ],
      "damage": [
        615,
        735,
        930,
        1230,
        1440,
        1770,
        2070,
        2370,
        4440,
        5250
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Undead",
      "Ranger",
      "Ranged",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Undead"
      ],
      "strengths": [
        "High Damage",
        "Long-range attacker"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Undead",
    "type": "Ranger",
    "combatLine": "Aerial",
    "synergyCategories": [
      "Undead",
      "Ranger",
      "Ranged",
      "Backline-DPS"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Grave Talons",
        "Wraith Wingblades"
      ],
      "armors": [
        "Ashen Windrider Harness",
        "Soulbound Scale Mail"
      ]
    },
  "realGear": {
    "roleFamily": "Ranger",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Ranger role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  },
  {
    "id": "tr-night-hunter",
    "name": "Night Hunter",
    "rarity": "legendary",
    "categories": [
      "Undead",
      "Trickster",
      "Support"
    ],
    "description": "The true embodiment of evil and a merciless creature that can't be stopped from achieving its only goal: to satisfy its constant hunger.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1,
      "attackRange": "1.7 m"
    },
    "ability": {
      "name": "Nightmare",
      "description": "The night hunter selects its prey and flies towards it. Upon landing, it releases a wave of fear causing enemy units to flee in the opposite direction.",
      "levelStats": {
        "Duration": [
          "1.5 s",
          "1.5 s",
          "1.5 s",
          "2 s",
          "2 s",
          "2 s",
          "2.5 s",
          "2.5 s",
          "2.5 s",
          "3 s"
        ],
        "AOE Radius": [
          "3 m",
          "3 m",
          "3 m",
          "4 m",
          "4 m",
          "4 m",
          "5 m",
          "5 m",
          "5 m",
          "6 m"
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        4000,
        7000,
        11000,
        16000,
        22000,
        29000,
        37000,
        46000,
        63500,
        91500
      ],
      "damage": [
        270,
        320,
        370,
        420,
        470,
        520,
        570,
        620,
        1250,
        1630
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ],
      "evasion": [
        "0.5%",
        "1%",
        "1.5%",
        "2%",
        "2.5%",
        "3%",
        "3.5%",
        "4%",
        "4.5%",
        "5%"
      ]
    },
    "tags": [
      "Undead",
      "Trickster",
      "Support",
      "Melee",
      "AoE",
      "Crowd-Control"
    ],
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Undead",
        "Trickster"
      ],
      "strengths": [
        "High HP",
        "Utility/support value"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Undead",
    "type": "Support",
    "combatLine": "Midline",
    "synergyCategories": [
      "Undead",
      "Trickster",
      "Support",
      "Melee",
      "AoE",
      "Crowd-Control"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Wraith Scepter",
        "Ashen Ritual Wand"
      ],
      "armors": [
        "Soulbound Vestments",
        "Plague Ward Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Trickster",
    "hasRealGearData": true,
    "weapon": "Mirage Glaive",
    "armor": "Mirage Garment",
    "note": "Next basic Trickster attack deals additional damage. (Mirage Glaive) paired with Tricksters gain a chance to evade basic AOE attacks entirely. (Mirage Garment)."
  }
  },
  {
    "id": "tr-pyrotechnician",
    "name": "Pyrotechnician",
    "rarity": "epic",
    "categories": [
      "Human",
      "Ranger"
    ],
    "description": "Brilliant engineers who love fireworks and blowing stuff up.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1.4,
      "attackRange": "Max.",
      "aoeRadius": "3 m"
    },
    "ability": null,
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        500,
        1000,
        1600,
        2400,
        3200,
        4200,
        5200,
        6200,
        10850,
        13020
      ],
      "damage": [
        90,
        110,
        130,
        150,
        170,
        190,
        210,
        250,
        420,
        520
      ],
      "defense": [
        10,
        15,
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55
      ]
    },
    "tags": [
      "Human",
      "Ranger",
      "Ranged",
      "AoE",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Human"
      ],
      "strengths": [
        "Long-range attacker"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Human",
    "type": "Ranger",
    "combatLine": "Backline",
    "synergyCategories": [
      "Human",
      "Ranger",
      "Ranged",
      "AoE",
      "Backline-DPS",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Dragon Rider"
    ],
    "optimalGear": {
      "weapons": [
        "Forged Longbow",
        "Valorous War Crossbow"
      ],
      "armors": [
        "Militia Leathers",
        "Iron Skirmish Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Ranger",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Ranger role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  },
  {
    "id": "tr-gravedigger",
    "name": "Gravedigger",
    "rarity": "rare",
    "categories": [
      "Undead",
      "Trickster"
    ],
    "description": "They like to dig into the ground near troops at back and kill them silently.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1,
      "attackRange": "0.9 m",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Underground Passage",
      "description": "At the start of battle, the gravedigger burrows and moves underground to the enemy army's backlines.",
      "levelStats": null
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        3,
        5,
        7,
        9,
        9,
        9,
        9,
        9,
        9,
        9
      ],
      "hp": [
        850,
        1000,
        1250,
        1750,
        3100,
        4500,
        6000,
        7500,
        12950,
        18000
      ],
      "damage": [
        100,
        120,
        160,
        225,
        265,
        320,
        370,
        420,
        740,
        975
      ],
      "defense": [
        10,
        15,
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55
      ],
      "evasion": [
        "0.5%",
        "1%",
        "1.5%",
        "2%",
        "2.5%",
        "3%",
        "3.5%",
        "4%",
        "4.5%",
        "5%"
      ]
    },
    "tags": [
      "Undead",
      "Trickster",
      "Melee"
    ],
    "analysis": {
      "primaryRole": "Trickster",
      "secondaryRoles": [
        "Undead"
      ],
      "strengths": [
        "Bypasses frontline to strike backline units"
      ],
      "weaknesses": [
        "Fragile, low HP for a melee flanker"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Undead",
    "type": "Trickster",
    "combatLine": "Midline",
    "synergyCategories": [
      "Undead",
      "Trickster",
      "Melee"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Soulbound Twin Daggers",
        "Plague Serrated Kris"
      ],
      "armors": [
        "Bone Stalker Garb",
        "Grave Shadow Wraps"
      ]
    },
  "realGear": {
    "roleFamily": "Trickster",
    "hasRealGearData": true,
    "weapon": "Mirage Glaive",
    "armor": "Mirage Garment",
    "note": "Next basic Trickster attack deals additional damage. (Mirage Glaive) paired with Tricksters gain a chance to evade basic AOE attacks entirely. (Mirage Garment)."
  }
  },
  {
    "id": "tr-axe-throwers",
    "name": "Axe Throwers",
    "rarity": "legendary",
    "categories": [
      "Human",
      "Trickster",
      "Ranger"
    ],
    "description": "These savage warriors revel in battle and grow stronger as the battle goes on.",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 1.2,
      "attackRange": "Max.",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Beast Rage",
      "description": "With every third hit, throwers increase in size and deal more damage.",
      "levelStats": {
        "Damage Increase per Effect": [
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%",
          "10%"
        ],
        "Maximum Effects": [
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3
      ],
      "hp": [
        1800,
        2900,
        3500,
        6000,
        12000,
        18600,
        21900,
        36700,
        39700,
        46700
      ],
      "damage": [
        430,
        545,
        820,
        850,
        950,
        1180,
        1450,
        1850,
        3600,
        4300
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ],
      "evasion": [
        "0.5%",
        "1%",
        "1.5%",
        "2%",
        "2.5%",
        "3%",
        "3.5%",
        "4%",
        "4.5%",
        "5%"
      ]
    },
    "tags": [
      "Human",
      "Trickster",
      "Ranger",
      "Ranged",
      "Backline-DPS"
    ],
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Human",
        "Trickster"
      ],
      "strengths": [
        "High Damage",
        "Long-range attacker"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": "moderate"
      }
    },
    "faction": "Human",
    "type": "Ranger",
    "combatLine": "Backline",
    "synergyCategories": [
      "Human",
      "Trickster",
      "Ranger",
      "Ranged",
      "Backline-DPS"
    ],
    "recommendedHeroes": [
      "Dragon Rider"
    ],
    "optimalGear": {
      "weapons": [
        "Militia Longbow",
        "Iron War Crossbow"
      ],
      "armors": [
        "Steel Leathers",
        "Kingsguard Skirmish Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Trickster",
    "hasRealGearData": true,
    "weapon": "Mirage Glaive",
    "armor": "Mirage Garment",
    "note": "Next basic Trickster attack deals additional damage. (Mirage Glaive) paired with Tricksters gain a chance to evade basic AOE attacks entirely. (Mirage Garment)."
  }
  },
  {
    "id": "tr-steel-revenant",
    "name": "Steel Revenant",
    "rarity": "legendary",
    "categories": [
      "Undead",
      "Support",
      "Tank"
    ],
    "description": "A centuries-old curse has granted this mighty warrior sharp spikes and condemned him to eternal solitude.",
    "baseStats": {
      "speed": "Medium",
      "attackSpeed": 1,
      "attackRange": "1.1 m",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Spiked Armor",
      "description": "The steel spikes of the revenant reflect part of the damage dealt to it back to the attackers.",
      "levelStats": {
        "Return Damage": [
          "5%",
          "8%",
          "11%",
          "14%",
          "17%",
          "21%",
          "25%",
          "29%",
          "33%",
          "37%"
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        4400,
        7700,
        12100,
        17600,
        24200,
        31900,
        40700,
        50600,
        69850,
        100650
      ],
      "damage": [
        325,
        385,
        445,
        505,
        565,
        625,
        685,
        745,
        1500,
        1955
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Undead",
      "Support",
      "Tank",
      "Melee",
      "Damage-Reflect",
      "Frontline"
    ],
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Undead",
        "Support"
      ],
      "strengths": [
        "High HP",
        "Strong frontline durability",
        "Utility/support value"
      ],
      "weaknesses": [],
      "scaling": {
        "hp": "strong",
        "damage": "weak"
      }
    },
    "faction": "Undead",
    "type": "Tank",
    "combatLine": "Frontline",
    "synergyCategories": [
      "Undead",
      "Support",
      "Tank",
      "Melee",
      "Damage-Reflect",
      "Frontline",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Bone Warhammer",
        "Grave Bulwark Mace"
      ],
      "armors": [
        "Wraith Plate",
        "Ashen Bastion Aegis"
      ]
    },
  "realGear": {
    "roleFamily": "Tank",
    "hasRealGearData": true,
    "weapon": "Hammer of Devourment",
    "armor": "Armor of Devourment",
    "note": "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage. (Hammer of Devourment) paired with Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation. (Armor of Devourment)."
  }
  },
  {
    "id": "tr-necromancer",
    "name": "Necromancer",
    "rarity": "epic",
    "categories": [
      "Undead",
      "Support"
    ],
    "description": "Every skeleton dreams to join his army...",
    "baseStats": {
      "speed": "Low",
      "attackSpeed": 2,
      "attackRange": "Max.",
      "aoeRadius": "-"
    },
    "ability": {
      "name": "Summon",
      "description": "Summons a skeleton.",
      "levelStats": {
        "Number": [
          1,
          1,
          1,
          2,
          2,
          2,
          3,
          3,
          3,
          4
        ]
      }
    },
    "levels": {
      "level": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "units": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ],
      "hp": [
        1000,
        1800,
        2600,
        3800,
        5000,
        6200,
        7400,
        8600,
        15050,
        18365
      ],
      "damage": [
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-"
      ],
      "defense": [
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        60,
        65
      ]
    },
    "tags": [
      "Undead",
      "Support",
      "Ranged",
      "Summoner"
    ],
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Undead"
      ],
      "strengths": [
        "Long-range attacker",
        "Utility/support value"
      ],
      "weaknesses": [
        "Low movement speed"
      ],
      "scaling": {
        "hp": "strong",
        "damage": null
      }
    },
    "summon": {
      "id": "tr-necromancer:summon",
      "name": "Skeleton",
      "description": "Made up of bones and bone marrow.",
      "baseStats": {
        "speed": "Medium",
        "attackSpeed": 1,
        "attackRange": "1 m",
        "aoeRadius": "-"
      },
      "levels": {
        "level": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "units": [
          1,
          1,
          1,
          1,
          2,
          2,
          2,
          3,
          3,
          3
        ],
        "hp": [
          600,
          800,
          1000,
          1200,
          1400,
          1600,
          1800,
          2000,
          3850,
          4700
        ],
        "damage": [
          80,
          100,
          140,
          200,
          240,
          280,
          320,
          360,
          630,
          770
        ],
        "defense": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    },
    "faction": "Undead",
    "type": "Support",
    "combatLine": "Backline",
    "synergyCategories": [
      "Undead",
      "Support",
      "Ranged",
      "Summoner",
      "Low-HP"
    ],
    "recommendedHeroes": [
      "Drake",
      "Bone Dragon"
    ],
    "optimalGear": {
      "weapons": [
        "Grave Scepter",
        "Wraith Ritual Wand"
      ],
      "armors": [
        "Ashen Vestments",
        "Soulbound Ward Cloak"
      ]
    },
  "realGear": {
    "roleFamily": "Support",
    "hasRealGearData": false,
    "weapon": null,
    "armor": null,
    "note": "No confirmed real gear data yet for the Support role family — only Tank (Hammer/Armor of Devourment) and Trickster (Mirage Glaive/Garment) gear has been captured so far."
  }
  }
];

module.exports = troops;
