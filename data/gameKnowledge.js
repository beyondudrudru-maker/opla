/**
 * MELODY Game Knowledge Library
 * Auto-generated from data.js and calculator.html
 * DO NOT hand-edit level data — regenerate from source instead.
 */

const gameLibrary = {
  "version": "1.0.0",
  "troops": [
    {
      "id": "tr-immortal",
      "name": "Immortal",
      "rarity": "epic",
      "categories": [
        "Undead",
        "Tank"
      ],
      "description": "One swing of his sword sows death and panic in the enemy's army.",
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
        "strengths": [],
        "weaknesses": [],
        "scaling": {
          "hp": "strong",
          "damage": "moderate"
        }
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
      "source": "Get it in Shop or by purchasing troop cards",
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
        "strengths": [],
        "weaknesses": [],
        "scaling": {
          "hp": "strong",
          "damage": "moderate"
        }
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
        "strengths": [],
        "weaknesses": [],
        "scaling": {
          "hp": "strong",
          "damage": "moderate"
        }
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
      "source": "Can be obtained in a special Challenge Tower event",
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
      "source": "Can be obtained in a special Challenge Tower event",
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
      "source": "Get it in Shop or by purchasing troop cards",
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
      }
    }
  ],
  "heroes": [
    {
      "id": "ANAVIN_01",
      "name": "FIRETAMER ANAVIN",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "A legendary mage capable of controlling celestial fire. Best placed in the backline to deal massive AoE damage and buff her allies.",
      "stats": {
        "hp": 38250,
        "defense": 300,
        "attack": 900,
        "collectionBonus": 12
      },
      "talent": {
        "name": "Flaming Heart",
        "description": "Anavin inspires all allied mage units with her presence, increasing their attack.",
        "effects": {
          "Increased Damage Dealt": "2% — 25%"
        },
        "targets": [
          "Mage"
        ]
      },
      "ability": {
        "name": "Rise of the Phoenix",
        "description": "Anavin flies up high and releases fiery beams in all directions. Enemy units take damage over time. When the fire rays are burning, Anavin concentrates all her power to release a wave of energy that increases the defense and attack damage of allied units.",
        "effects": {
          "Attack Radius": "9m — 18m",
          "Buff Radius": "12m — 21m",
          "Damage per Second": "125 — 350",
          "Cooldown": "17s — 14s",
          "Damage Bonus": "40 — 175",
          "Damage Reduction": "5% — 8%",
          "Duration": "5s — 8s"
        },
        "targets": [
          "All Allies"
        ]
      },
      "tags": [
        "Mages",
        "Mage",
        "All Allies",
        "Attack-Buff",
        "Defense-Buff"
      ],
      "synergies": [
        "Mage",
        "All Allies"
      ]
    },
    {
      "id": "EDELINA_01",
      "name": "EDELINA, QUEEN OF THE FOREST",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "The protector of the ancient woods. Edelina excels at crowd control, turning the battlefield into a trap for her enemies while bolstering her allies.",
      "stats": {
        "hp": 32100,
        "defense": 250,
        "attack": 850,
        "collectionBonus": 10.5
      },
      "talent": {
        "name": "Thorns",
        "description": "Edelina covers allied mage units with spikes that deal return damage to attackers.",
        "effects": {
          "Return Damage": "3% - 35%"
        },
        "targets": [
          "Mage"
        ]
      },
      "ability": {
        "name": "Spiked Roots",
        "description": "Edelina launches spiked roots at enemy units, damaging and immobilizing them.",
        "effects": {
          "Enemies Amount": "12 - 21 units",
          "Cooldown": "17s - 14s",
          "Roots Damage": "150 - 375",
          "Roots Duration": "5s (Fixed)"
        },
        "targets": []
      },
      "tags": [
        "Mages",
        "Mage",
        "Crowd-Control"
      ],
      "synergies": [
        "Mage"
      ]
    },
    {
      "id": "XANA_01",
      "name": "FIRE FURY XANA",
      "faction": "DREADS",
      "rarity": "mythical",
      "description": "A harbinger of molten destruction. Xana consumes the battlefield in flames and turns the fallen into golems of lava, ensuring that even in death, her enemies face her wrath.",
      "stats": {
        "hp": 28000,
        "defense": 210,
        "attack": 1100,
        "collectionBonus": 17
      },
      "talent": {
        "name": "Meteor Requiem",
        "description": "The last allied unit in a troop to die summons a meteorite that crashes down at their location. When a certain number of units die this way, they summon a large meteorite that turns into a golem.",
        "effects": {
          "Meteorite Damage": "1,600 - 2,500",
          "Troop deaths to summon": "8 - 5"
        },
        "targets": []
      },
      "ability": {
        "name": "Inferno",
        "description": "Xana creates infernal zones on the battlefield that burn enemies and rain down meteorites. Each large meteorite deals damage and turns into a lava golem when it falls.",
        "effects": {
          "Number of Zones": "2 - 4",
          "Zone Damage per Second": "200 - 500",
          "Meteorite Damage": "1,600 - 2,500",
          "Cooldown": "19s - 16s"
        },
        "targets": []
      },
      "tags": [
        "Dreads",
        "Summoner",
        "AoE"
      ],
      "synergies": []
    },
    {
      "id": "HARKON_01",
      "name": "HERALD OF FLAME HARKON",
      "faction": "DREADS",
      "rarity": "mythical",
      "description": "A master of combustion who turns the battlefield into a furnace. Harkon devastates enemy lines with growing infernos and shields his allies from lethal strikes by delaying the impact of damage.",
      "stats": {
        "hp": 32000,
        "defense": 250,
        "attack": 1200,
        "collectionBonus": 19
      },
      "talent": {
        "name": "Echo of Pain",
        "description": "Harkon enchants allied units so they only take a portion of incoming damage. The remaining damage is taken gradually once per second for 5 seconds. The effect continues after the hero’s death but does not work in boss battles.",
        "effects": {
          "Delayed Damage": "20% - 56%"
        },
        "targets": [
          "All Allies"
        ]
      },
      "ability": {
        "name": "Insatiable Flame",
        "description": "Harkon shoots a fireball that deals damage and ignites the area where it lands. Each enemy troop that dies in the burning area increases the strength of the fireballs.",
        "effects": {
          "Damage": "1,400 - 3,800",
          "Attack Radius": "4m - 6m",
          "Area Duration": "2s - 5s",
          "Zone Damage per Second": "100 - 1,100",
          "Damage Multiplier": "0.05 - 0.1",
          "Cooldown": "8s - 4s"
        },
        "targets": []
      },
      "tags": [
        "Dreads",
        "All Allies",
        "Boss-Damage"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "BRUTALLUS_01",
      "name": "BRUTALLUS THE TERRORBRINGER",
      "faction": "DREADS",
      "rarity": "mythical",
      "description": "A master of psychological warfare. Brutallus manipulates the battlefield by inciting terror in his foes, turning their own fear into a vulnerability that his allies can exploit.",
      "stats": {
        "hp": 48000,
        "defense": 400,
        "attack": 600,
        "collectionBonus": 18
      },
      "talent": {
        "name": "Easy Prey",
        "description": "Enemy units affected by fear take increased damage.",
        "effects": {
          "Damage Increase": "45% - 100%"
        },
        "targets": []
      },
      "ability": {
        "name": "Primal Fear",
        "description": "Brutallus shrouds nearby allies in an aura of primal fear that increases movement speed, allowing them to flee when taking damage.",
        "effects": {
          "Haste": "50% - 120%",
          "Unit Quantity": "35 - 115",
          "Aura Duration": "4s - 9s",
          "AOE Radius": "6m - 12m",
          "Cooldown": "16s - 13s"
        },
        "targets": []
      },
      "tags": [
        "Dreads",
        "Attack-Buff",
        "Crowd-Control",
        "AoE"
      ],
      "synergies": []
    },
    {
      "id": "CALYRA_01",
      "name": "CALYRA, CELESTIAL HEALER",
      "faction": "ELEVATES",
      "rarity": "mythical",
      "description": "A divine healer who channels the light to sustain her allies. Her presence ensures the squad remains combat-ready even under heavy pressure.",
      "stats": {
        "hp": 29800,
        "defense": 220,
        "attack": 700,
        "collectionBonus": 15
      },
      "talent": {
        "name": "Gift of Light",
        "description": "When the squad takes damage from a normal attack, Calira's light fully restores the squad's health over time. The effect continues after the hero's death.",
        "effects": {
          "Full Restoration from Damage Taken": "35s - 26s"
        },
        "targets": [
          "All Allies"
        ]
      },
      "ability": {
        "name": "Healing Veil",
        "description": "Calira summons pillars of light that periodically restore health to all allied units on the battlefield.",
        "effects": {
          "HP Regeneration per Second": "5% - 10%",
          "Duration of Healing": "3s - 5s",
          "Cooldown": "20s - 17s"
        },
        "targets": [
          "All Allies"
        ]
      },
      "tags": [
        "Elevates",
        "All Allies",
        "HP-Buff",
        "Healing",
        "Summoner",
        "AoE"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "ATREYA_01",
      "name": "ATREYA, HAND OF VENGEANCE",
      "faction": "ELEVATES",
      "rarity": "mythical",
      "description": "A divine archer whose presence turns the tide of battle. Atreya brings precision and devastating power to the squad, ensuring victory through overwhelming celestial force.",
      "stats": {
        "hp": 27500,
        "defense": 210,
        "attack": 1200,
        "collectionBonus": 14
      },
      "talent": {
        "name": "Smashing Light",
        "description": "Atreya inspires allied units, granting their attacks a chance to deal increased damage to enemy units. The effect remains active even after the hero's death.",
        "effects": {
          "Chance of Dealing Double Damage": "20% - 30%",
          "Increased Damage Dealt": "60% - 200%"
        },
        "targets": [
          "All Allies"
        ]
      },
      "ability": {
        "name": "Wrath of Heaven",
        "description": "Atreya unleashes a volley of light arrows that rain down on the battlefield, dealing damage to all enemy units.",
        "effects": {
          "Cooldown": "17s - 14s",
          "Damage": "1,500 - 4,800"
        },
        "targets": []
      },
      "tags": [
        "Elevates",
        "All Allies",
        "Attack-Buff",
        "AoE"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "REMUS_01",
      "name": "REMUS THE INDESTRUCTIBLE",
      "faction": "ELEVATES",
      "rarity": "mythical",
      "description": "A stalwart protector who turns defense into a strategic advantage. Remus specializes in shielding the squad and empowering attacks against the toughest enemies on the field.",
      "stats": {
        "hp": 45000,
        "defense": 450,
        "attack": 500,
        "collectionBonus": 18
      },
      "talent": {
        "name": "Threat of Giants",
        "description": "Remus powers up the regular attacks of allied troops to deal more damage to enemy tanks and bosses. The effect continues after the hero's death.",
        "effects": {
          "Increased Damage Dealt": "30% - 85%"
        },
        "targets": [
          "All Allies"
        ]
      },
      "ability": {
        "name": "Light Shield",
        "description": "Remus surrounds allied units with a shield that absorbs the next damage they receive.",
        "effects": {
          "Cooldown": "14s - 10s",
          "AOE Radius": "12m - 25m",
          "Damage Absorption Limit": "1,250 - 10,250",
          "Shield Duration": "3s - 6s"
        },
        "targets": [
          "All Allies"
        ]
      },
      "tags": [
        "Elevates",
        "All Allies",
        "Attack-Buff",
        "Shielding",
        "Boss-Damage",
        "AoE"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "MALIUM_01",
      "name": "MALIUM, THE HERALD OF CORRUPTION",
      "faction": "UNDEAD",
      "rarity": "epic",
      "description": "A master of blight and misery. Malium utilizes his lizard companion to contaminate the battlefield, weakening enemies and making them susceptible to further damage.",
      "stats": {
        "hp": 26000,
        "defense": 180,
        "attack": 950,
        "collectionBonus": 9
      },
      "talent": {
        "name": "Poison Puddles",
        "description": "Malium commands his lizard to spit out gobs of mucus that deal damage on impact and form poisonous puddles. Enemy units in puddles receive poison damage and other incoming damage is increased.",
        "effects": {
          "Number of Puddles": "4 - 9",
          "AOE Radius": "4m - 8m",
          "Damage": "150 - 375",
          "Puddle Damage per Second": "50 - 100",
          "Cooldown": "16s - 14s",
          "Damage Increase": "2% - 12%"
        },
        "targets": []
      },
      "ability": null,
      "tags": [
        "Undead",
        "Attack-Buff",
        "AoE"
      ],
      "synergies": []
    },
    {
      "id": "TRISTAN_01",
      "name": "CLERIC TRISTAN",
      "faction": "HUMAN",
      "rarity": "epic",
      "description": "A devoted guardian who channels divine power to fortify his comrades. Tristan is essential for keeping the frontline resilient during intense skirmishes.",
      "stats": {
        "hp": 30500,
        "defense": 200,
        "attack": 450,
        "collectionBonus": 11
      },
      "talent": null,
      "ability": {
        "name": "Blessing",
        "description": "Tristan invokes his inner strength and blesses allied units into battle. Blessing increases their HP and basic attack damage.",
        "effects": {
          "AOE Radius": "5m - 8m",
          "Cooldown": "15s - 12s",
          "HP Bonus": "400 - 1,750",
          "Damage Bonus": "40 - 175"
        },
        "targets": [
          "All Allies"
        ]
      },
      "tags": [
        "Human",
        "All Allies",
        "Attack-Buff",
        "HP-Buff",
        "AoE"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "MORGRANE_01",
      "name": "PLAGUE LORD MORGRANE",
      "faction": "UNDEAD",
      "rarity": "legendary",
      "description": "A master of pestilence and decay. Morgrane dominates the battlefield by summoning vermin to weaken his foes and spreading corrupting plagues that punish enemies who dare to strike back.",
      "stats": {
        "hp": 35000,
        "defense": 280,
        "attack": 800,
        "collectionBonus": 13.5
      },
      "talent": {
        "name": "Black Plague",
        "description": "Reduces the damage from the regular attacks of enemy troops for each debuff applied to them.",
        "effects": {
          "Decreased Damage Dealt": "1% - 10%"
        },
        "targets": []
      },
      "ability": {
        "name": "Plague Rat Summon",
        "description": "Morgrane summons a plague rat that marks the enemy with each attack. When a marked unit dies, the ability cooldown is reduced. When the rat is killed, it releases a plague cloud that marks all enemies.",
        "effects": {
          "Summoned Unit HP": "2,500 - 60,000",
          "Summoned Unit Damage": "300 - 1,500",
          "Cooldown": "16s - 12s",
          "Cloud Duration": "2s (Fixed)",
          "Mark Damage": "650 - 1,600",
          "Mark Duration": "3s - 6s",
          "Cloud Radius": "2m - 7m",
          "Cooldown Reduction": "1s - 5s"
        },
        "targets": []
      },
      "tags": [
        "Undead",
        "Debuffer",
        "Summoner",
        "AoE"
      ],
      "synergies": []
    },
    {
      "id": "DURAND_01",
      "name": "INQUISITOR DURAND",
      "faction": "HUMAN",
      "rarity": "legendary",
      "description": "A fierce arbiter of justice who cleanses the battlefield with holy fire. Durand provides essential protection to his tank allies while demoralizing those who stand against the light.",
      "stats": {
        "hp": 42000,
        "defense": 350,
        "attack": 650,
        "collectionBonus": 16
      },
      "talent": {
        "name": "Immutability",
        "description": "Allied troops with the Tank role take reduced damage from incoming attacks and better resist debuffs.",
        "effects": {
          "Reduces Debuff Duration": "5% - 80%",
          "Damage Reduction": "5% - 32.5%"
        },
        "targets": [
          "All Allies"
        ]
      },
      "ability": {
        "name": "Righteous Flame",
        "description": "Durand throws a burning thurible that releases a wave of fire when it hits the ground. Enemy units hit by the wave take periodic damage and run away in fear.",
        "effects": {
          "Cooldown": "16s - 14s",
          "AOE Radius": "5m - 9m",
          "Area Duration": "4s - 8s",
          "Damage per Second": "150 - 800",
          "Fear Duration": "1s - 2s"
        },
        "targets": []
      },
      "tags": [
        "Human",
        "All Allies",
        "Defense-Buff",
        "Crowd-Control",
        "Debuffer",
        "AoE"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "BUMI_01",
      "name": "BUMI THE DREAMWALKER",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "A mystical weaver of sand and slumber. Bumi manipulates the battlefield by lulling foes into a false sense of security and shielding allies from ranged projectile threats.",
      "stats": {
        "hp": 28000,
        "defense": 200,
        "attack": 750,
        "collectionBonus": 11.5
      },
      "talent": {
        "name": "Sand Storm",
        "description": "Bumi creates a curtain of sand that prevents enemy army shooters from hitting allied units.",
        "effects": {
          "Chance of missing": "2% - 20%"
        },
        "targets": [
          "All Allies"
        ]
      },
      "ability": {
        "name": "Dream",
        "description": "Bumi creates sandy areas that cast enemies into sleep. Enemies can't attack or use their abilities during the dream state. Dream ends when enemies receive the first damage.",
        "effects": {
          "Cooldown": "16s - 14s",
          "Areas Number": "2 - 5",
          "Duration": "4s - 7s",
          "AOE Radius": "4m - 8m"
        },
        "targets": []
      },
      "tags": [
        "Mages",
        "All Allies",
        "Crowd-Control",
        "Evasion-Buff",
        "AoE"
      ],
      "synergies": [
        "All Allies"
      ]
    },
    {
      "id": "DRAKE_01",
      "name": "DRAKE, TERROR OF THE SEAS",
      "faction": "UNDEAD",
      "rarity": "legendary",
      "description": "A spectral captain who brings the chill of the grave to every battlefield. Drake empowers his undead legions while devastating enemy lines with his spectral vessel.",
      "stats": {
        "hp": 34000,
        "defense": 260,
        "attack": 850,
        "collectionBonus": 12.5
      },
      "talent": {
        "name": "Boarding Party",
        "description": "In Drake’s presence, allied undead units have a chance to deal double damage with regular attacks.",
        "effects": {
          "Chance of Dealing Double Damage": "2% - 25%"
        },
        "targets": [
          "Undead"
        ]
      },
      "ability": {
        "name": "Ghost Ship",
        "description": "Drake summons a ghost ship that deals damage and increases damage dealt to enemies.",
        "effects": {
          "AOE Radius": "6m (Fixed)",
          "Damage": "725 - 1,400",
          "Cooldown": "16s - 14s",
          "Damage Increase": "5% - 15%",
          "Duration": "4s - 7s"
        },
        "targets": []
      },
      "tags": [
        "Undead",
        "Attack-Buff",
        "Summoner",
        "AoE"
      ],
      "synergies": [
        "Undead"
      ]
    },
    {
      "id": "KEYRA_01",
      "name": "KEYRA THE WATER MAGE",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "A master of the tides who commands the crushing weight of the ocean. Keyra disrupts enemy formations by launching them into the air and empowers allied mages based on their vitality.",
      "stats": {
        "hp": 27200,
        "defense": 190,
        "attack": 920,
        "collectionBonus": 12
      },
      "talent": {
        "name": "Power of Water",
        "description": "Keyra blesses allied mage units with the power of water, increasing their attack based on their current HP.",
        "effects": {
          "Increased damage with full HP": "3% - 35%"
        },
        "targets": [
          "Mage"
        ]
      },
      "ability": {
        "name": "Howl of the Deep",
        "description": "Keyra creates powerful geysers that toss enemy units into the air. Units tossed up by geysers take damage and are unable to attack or use abilities until they land.",
        "effects": {
          "AOE Radius": "3m (Fixed)",
          "Number of geysers": "6 - 15",
          "Damage": "200 - 650",
          "Cooldown": "16s - 14s"
        },
        "targets": []
      },
      "tags": [
        "Mages",
        "Mage",
        "Attack-Buff",
        "Crowd-Control",
        "AoE"
      ],
      "synergies": [
        "Mage"
      ]
    },
    {
      "id": "ZAHEER_01",
      "name": "ZAHEER THE AIRLORD",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "A master of the unseen currents. Zaheer controls the flow of battle by sweeping enemies into chaotic vortexes and granting his allies the grace of the wind to avoid incoming threats.",
      "stats": {
        "hp": 26500,
        "defense": 175,
        "attack": 980,
        "collectionBonus": 11
      },
      "talent": {
        "name": "Wind Tamer",
        "description": "Zaheer imbues allied mage units with the power of wind to sometimes dodge attacks.",
        "effects": {
          "Evasion chance": "2% - 20%"
        },
        "targets": [
          "Mage"
        ]
      },
      "ability": {
        "name": "Tornado",
        "description": "Zaheer summons a powerful tornado that moves across the battlefield and pulls in enemy units. Units caught inside cannot attack or use abilities and take damage upon falling.",
        "effects": {
          "Cooldown": "16s - 14s",
          "Damage": "850 - 1,525",
          "Duration": "4s - 7s",
          "Enemies Amount": "15 - 60",
          "AOE Radius": "5m - 8m"
        },
        "targets": []
      },
      "tags": [
        "Mages",
        "Mage",
        "Crowd-Control",
        "Evasion-Buff",
        "Summoner",
        "AoE"
      ],
      "synergies": [
        "Mage"
      ]
    },
    {
      "id": "SIGURD_01",
      "name": "SIGURD THE ICE MAGE",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "A frost-wielder who turns the tide by literally rolling over his enemies. Sigurd is a master of disruption, clearing lanes and creating opportunities for his allies to strike.",
      "stats": {
        "hp": 29500,
        "defense": 230,
        "attack": 880,
        "collectionBonus": 12
      },
      "talent": {
        "name": "Frost Armor",
        "description": "Sigurd coats allied mage units in ice armor, increasing their HP.",
        "effects": {
          "Bonus HP": "2% - 25%"
        },
        "targets": [
          "Mage"
        ]
      },
      "ability": {
        "name": "Snowball",
        "description": "Sigurd creates a huge snowball that speeds forward, increasing in size. The snowball sweeps up any enemy units in its path. At the end of its path, the snowball smashes open, and the units in it are damaged and stunned.",
        "effects": {
          "Snowball Distance": "27 (Fixed)",
          "Damage": "750 - 1,425",
          "Cooldown": "16s - 14s",
          "Stun Time": "1s - 3s",
          "Enemies Amount": "10 - 55"
        },
        "targets": []
      },
      "tags": [
        "Mages",
        "Mage",
        "HP-Buff",
        "Crowd-Control"
      ],
      "synergies": [
        "Mage"
      ]
    },
    {
      "id": "BONE_DRAGON_01",
      "name": "BONE DRAGON",
      "faction": "UNDEAD",
      "rarity": "legendary",
      "description": "A skeletal titan of the skies. The Bone Dragon terrorizes the battlefield, raining destruction from above while bolstering the strength of the undead forces below.",
      "stats": {
        "hp": 40000,
        "defense": 300,
        "attack": 950,
        "collectionBonus": 14
      },
      "talent": {
        "name": "Death Aura",
        "description": "Bone Dragon strengthens allied undead units with its presence, increasing their damage.",
        "effects": {
          "Increased damage dealt": "2% - 25%"
        },
        "targets": [
          "Undead"
        ]
      },
      "ability": {
        "name": "Death Flight",
        "description": "Bone Dragon flies over enemy units, leaving a cursed area that deals periodic damage.",
        "effects": {
          "Damage per Sec": "450 - 1,550",
          "Cooldown": "16s - 14s",
          "Flights Number": "4 - 6"
        },
        "targets": []
      },
      "tags": [
        "Undead",
        "Attack-Buff"
      ],
      "synergies": [
        "Undead"
      ]
    },
    {
      "id": "MORGANA_01",
      "name": "MORGANA THE DARK MAGE",
      "faction": "UNDEAD",
      "rarity": "legendary",
      "description": "A master of forbidden necromancy. Morgana disrupts the battlefield with taunting monuments and bolsters her undead army by raising the fallen to fight at her side.",
      "stats": {
        "hp": 27500,
        "defense": 200,
        "attack": 950,
        "collectionBonus": 13
      },
      "talent": {
        "name": "Unholy Alliance",
        "description": "Morgana buffs all summoned allied skeletons, increasing their attack and HP. With each of her attacks, Morgana curses her enemies to rise in the form of allied skeletons after they die.",
        "effects": {
          "Increased damage dealt": "4% - 40%",
          "Bonus HP": "4% - 40%"
        },
        "targets": []
      },
      "ability": {
        "name": "Mysterious Tombstone",
        "description": "Morgana summons a tombstone that taunts enemy units to attack it. After it's destroyed, skeletons burst from it. While the taunt is active, enemy units can't use their abilities.",
        "effects": {
          "Duration": "2s - 3.5s",
          "Number of summoned units": "2 - 9",
          "Taunt Radius": "5m - 8m"
        },
        "targets": []
      },
      "tags": [
        "Undead",
        "Attack-Buff",
        "HP-Buff",
        "Crowd-Control",
        "Summoner"
      ],
      "synergies": []
    },
    {
      "id": "OPHELIA_01",
      "name": "OPHELIA THE SPELLCASTER",
      "faction": "MAGES",
      "rarity": "legendary",
      "description": "A conduit for ancient and malevolent forces. Ophelia dominates the battlefield by unleashing forbidden spirits to empower herself and cursing those who dare to strike down her allies.",
      "stats": {
        "hp": 31000,
        "defense": 240,
        "attack": 920,
        "collectionBonus": 14
      },
      "talent": {
        "name": "Revenge of the Fallen",
        "description": "Ophelia enchants allied mage units to curse their killers when they die, reducing their damage.",
        "effects": {
          "Decreased damage dealt": "15% - 45%",
          "Duration": "2s - 6s"
        },
        "targets": [
          "Mage"
        ]
      },
      "ability": {
        "name": "Summon Spirit",
        "description": "Ophelia unleashes a spirit demon sealed within her, which greatly increases her damage and HP.",
        "effects": {
          "Duration": "9s (Fixed)",
          "HP Bonus": "5,000 - 24,500",
          "Damage Bonus": "455 - 650"
        },
        "targets": []
      },
      "tags": [
        "Mages",
        "Mage",
        "HP-Buff",
        "Debuffer"
      ],
      "synergies": [
        "Mage"
      ]
    },
    {
      "id": "DRAGON_RIDER_01",
      "name": "DRAGON RIDER",
      "faction": "HUMAN",
      "rarity": "legendary",
      "description": "A master of the skies who wields the cosmos as a weapon. Dragon Rider turns the battlefield into an inferno, raining celestial bodies upon her foes while empowering her human kin.",
      "stats": {
        "hp": 33000,
        "defense": 240,
        "attack": 880,
        "collectionBonus": 14
      },
      "talent": {
        "name": "Aerial Support",
        "description": "The dragon rider inspires allied human units with her presence, increasing their damage.",
        "effects": {
          "Increased damage dealt": "2% - 25%"
        },
        "targets": [
          "Human"
        ]
      },
      "ability": {
        "name": "Meteor Strike",
        "description": "Dragon soars into the sky, catches the nearest asteroid, and redirects it right at the enemy.",
        "effects": {
          "AOE Radius": "5m (Fixed)",
          "Damage": "390 - 625",
          "Cooldown": "17s - 14s"
        },
        "targets": []
      },
      "tags": [
        "Human",
        "Attack-Buff",
        "AoE"
      ],
      "synergies": [
        "Human"
      ]
    }
  ],
  "bosses": [
    {
      "name": "KALIDOR",
      "tier": "Lord of the Dunes",
      "zone": "Glorious Hunting",
      "abilities": [
        {
          "type": "PASSIVE",
          "name": "Wind Mantle",
          "cooldown": null,
          "description": "Increased resistance to ranged attacks. Ranged Damage Protection: 30%."
        },
        {
          "type": "ACTIVE",
          "name": "Quicksand",
          "cooldown": "7s",
          "description": "Creates areas where units always miss normal attacks (100% chance) and take 1000 DMG/sec. Lasts 12s."
        },
        {
          "type": "ACTIVE",
          "name": "Crushing Hammer",
          "cooldown": "13s",
          "description": "Slams sand hammer forward. Deals 3200 DMG, knocks back units, and reduces movement speed by 30% for 4s.",
          "damage": 3200
        },
        {
          "type": "ACTIVE",
          "name": "Explosive Spear",
          "cooldown": "15s",
          "description": "Throws a spear into the center unleashing an explosive wave dealing 6000 DMG."
        }
      ],
      "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Kalidor has 30% Ranged Protection. Use high HP melee/tanks and heavy healers to survive the massive 6000 DMG Explosive Spear."
    },
    {
      "name": "BALTHAZAR",
      "tier": "Fire Dragon",
      "zone": "Glorious Hunting",
      "abilities": [
        {
          "type": "PASSIVE",
          "name": "Sharp Growths",
          "cooldown": null,
          "description": "Balthazar has increased resistance to melee unit attacks. Melee Damage Protection: 30%."
        },
        {
          "type": "ACTIVE",
          "name": "Fire Breath",
          "cooldown": "30s",
          "description": "Channels all inner energy and releases a stream of fire forward, dealing massive damage to all units it hits. Each boss level increases damage by 2%. Damage: 6000",
          "damage": 6000
        },
        {
          "type": "ACTIVE",
          "name": "Fury from the Deep",
          "cooldown": "34s",
          "description": "Soars into the air, crashing down to tilt the battlefield toward himself. Troops lose footing and slide toward the dragon. Afterward, scorches the area in front, dealing massive damage. Each boss level increases damage by 2%. Damage: 15000",
          "damage": 15000
        },
        {
          "type": "ACTIVE",
          "name": "Shattering Strikes",
          "cooldown": "32s",
          "description": "Strikes the ground powerfully several times, sending shockwaves across the battlefield that damage everything in their path. Each boss level increases damage by 2%. Damage: 7200",
          "damage": 7200
        }
      ],
      "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Balthazar has 30% Melee Protection. Rely heavily on Ranged units for your primary DPS. Bring strong healers to sustain your troops through his massive, battlefield-wide AoE attacks like Fury from the Deep."
    },
    {
      "name": "ASHIRA",
      "tier": "Spider Queen",
      "zone": "Glorious Hunting",
      "abilities": [
        {
          "type": "PASSIVE",
          "name": "Chitin Carapace",
          "cooldown": null,
          "description": "20% of basic attack damage is reflected back at the attacker."
        },
        {
          "type": "PASSIVE",
          "name": "Speed and Agility",
          "cooldown": null,
          "description": "Ashira has increased resistance to ranged unit attacks. Ranged Damage Protection: 30%."
        },
        {
          "type": "ACTIVE",
          "name": "Acid Barrage",
          "cooldown": "22s",
          "description": "Launches acid balls at units, creating pools that deal periodic damage for 8 seconds. Each boss level increases damage by 2%. Damage: 4000 | Puddle Damage: 1500/sec",
          "damage": 4000
        },
        {
          "type": "ACTIVE",
          "name": "Battle Spiders Summon",
          "cooldown": "20s",
          "description": "Summons 30 battle spiders from the ceiling to attack troops and deal area damage. Each boss level increases damage by 2%. Summoned Damage: 900 | Health: 8000",
          "damage": 900
        },
        {
          "type": "ACTIVE",
          "name": "Explosive Spiders Summon",
          "cooldown": "20s",
          "description": "Summons 40 explosive spiders that burrow and roll toward the nearest units, exploding on contact. Each boss level increases damage by 2%. Explosion Damage: 550",
          "damage": 550
        }
      ],
      "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Ashira has 30% Ranged Protection, so you should prioritize **Melee units** for your primary DPS. However, be careful—her **Chitin Carapace** reflects 20% of basic attack damage back at your melee units, so bring heavy healers or shield-bearers to keep your frontline alive against both the reflected damage and the constant swarms of explosive spiders!"
    },
    {
      "name": "DAGON",
      "tier": "Ancient Kraken",
      "zone": "Glorious Hunting",
      "abilities": [
        {
          "type": "PASSIVE",
          "name": "Slimy Scales",
          "cooldown": null,
          "description": "Dagon has increased resistance to ranged unit attacks. Ranged Damage Protection: 30%."
        },
        {
          "type": "ACTIVE",
          "name": "Tentacle Smash",
          "cooldown": "18s",
          "description": "Dagon goes into a rage and delivers 3 powerful tentacle attacks on the ship's deck. Each boss level increases damage by 2%. Damage: 18000",
          "damage": 18000
        },
        {
          "type": "ACTIVE",
          "name": "Hungry Jaws",
          "cooldown": "15s",
          "description": "Grabs the player's units with a tentacle, stuffs them into his maw, and starts digesting them. As the boss level increases, the number of units grows. A timely shot from the ship's cannon will return the units to battle. Number of consumed units: 15"
        },
        {
          "type": "ACTIVE",
          "name": "Gift From the Depths",
          "cooldown": "24s",
          "description": "Dagon pulls a massive barrel from the seabed and hurls it at the player's troops, dealing massive area damage. Each boss level increases damage by 2%. Damage: 8000",
          "damage": 8000
        }
      ],
      "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Dagon has 30% Ranged Protection, so rely heavily on your strongest Melee/Tank units. Be extremely vigilant with the Hungry Jaws mechanic—keep your finger ready on the ship's cannon to interrupt him and save your 15 units. High-health troops are required to survive the massive 18,000 DMG Tentacle Smash!"
    }
  ],
  "arena": [
    {
      "name": "REGULAR FORM",
      "faction": "STABILITY & COUNTER",
      "rank": "Beginner Friendly",
      "moves": [
        {
          "name": "SETUP & GEAR",
          "description": "[ HERO REQUIREMENTS ]\n\nPrimary Hero: Tristan (Best Synergy)\n\nSecondary Hero: Flexible (Any legendary with stun capability)\n\n[ TROOP REQUIREMENTS ]\n\n- Immortals: 7x (Lv. 7-10)\n\n- Magic Archers: 7x (Lv. 7-10)\n\n- Cursed Catapults: 8x (Lv. 7-10)\n\n- Necromancers: 2x (Lv. 7-10)\n\n- Alchemists: 4 to 5x (Lv. 7-10)\n\n- Gravediggers: 4 to 5x (Lv. 7-10)\n\n- Undead Mages: 3 to 4x (Lv. 7-10)\n\n- Monks: 2 to 3x (Lv. 7-10)\n\n- Bone Breakers: 2x (Lv. 7-10)\n\n- Shamans: 2x (Lv. 7-10)\n\n- Pyrotechnician: 1x (Lv. 7-10)\n\n► TOTAL CAPACITY: 49 UNITS"
        },
        {
          "name": "TACTIC & STRATEGY",
          "description": "[ BATTLE DYNAMICS ]\n\nTristan's Core Synergy. This formation is incredibly stable. It delivers high-impact attack and reliable stunning while maintaining excellent healing sustain. It performs consistently within your power range and is highly customizable without losing its structural integrity.\n\n[ HOW IT WORKS ]\n\n1. Damage Absorption & Defense: Immortals and Bone Breakers form a solid frontline. The Necromancers are key here—they significantly aid in absorbing incoming damage, keeping the frontline alive longer.\n\n2. Tactical Positioning: Cursed Catapults are placed on the sides, protecting them from direct damage and allowing them to operate at peak efficiency. Gravediggers act as silent killers, flanking and dismantling the opposition.\n\n3. Counter-Meta Performance: This formation is highly effective against Skeleton builds and specifically counters Spider-heavy attacks by neutralizing their initiation.\n\n4. Efficiency: Even with lower troop counts, this layout produces impressive output. With Magic Archers and Catapults providing constant pressure, you can secure wins even when slightly outpowered."
        }
      ]
    }
  ],
  "meta": [
    {
      "category": "ECONOMY META",
      "title": "The Ultimate Gold Farming & Spending Blueprint",
      "summary": "Maximize your gold income in the Arena and learn the strict 50-20-10 reserve blueprint for spending.",
      "rules": [
        "Gold is the lifeblood of your army's progression. Mismanaging it will stall your growth. Follow these strict clan directives to maximize your earnings and optimize your spending.",
        "Part 1: Arena Farming Tactics",
        "- The 7-Day Trap: For the first 7 days of a new Arena season, purposefully set a weak or normal defense formation. This keeps your rank lower, allowing you to easily farm weaker opponents for consistent gold wins.",
        "- Target Prioritization: When refreshing opponents, specifically hunt for players using the 441 troop formation. These setups yield the highest and easiest gold earnings.",
        "- Deploy the Baron: Upgrade the Baron hero and deploy him exclusively for gold farming runs. His passive abilities will generate a solid gold income boost of up to 1.5%.",
        "Part 2: The Golden Spending Blueprint",
        "Never spend gold randomly. Hoard your wealth and divide your total reserves using this exact ratio:",
        "50% — Troop Recruitment: Always save up to use the 120k gold pulls to ensure you are recruiting high-tier troops.",
        "20% — Hero Upgrades: Only upgrade when necessary. Priority order: Legendary ➔ Epic ➔ Mythical.",
        "10% — Fusions: Spend strictly on necessary troop/hero fusions.",
        "20% — Emergency Reserve: DO NOT TOUCH. Keep this saved for a backup.",
        "Part 3: Multipliers & Dailies",
        "- Headhunt Sweeps: Play the Headhunt mode 2 to 3 times every single day. This is a crucial source of steady gold and bonus gems.",
        "- Ad Multipliers: Always watch the optional ads at the end of battles to double your gold revenue. Never leave free gold on the table.",
        "- Double Gold Card Rule: Do NOT waste Double Gold Cards on low-yield runs. Only activate these cards if your base earning (without ads or cards) is already hitting 14k to 15k gold. This guarantees maximum return on your consumables."
      ]
    },
    {
      "category": "ARENA META",
      "title": "The Arena Masterclass: Trophies, Tactics & Psychology",
      "summary": "The ultimate guide to Arena domination. Covers the 14-day cycle, trophy math, hidden formations, and hero requirements.",
      "rules": [
        "The Arena is the ultimate testing ground. It exposes your strategy, mindset, and the true efficiency of your formation. Every attack must be calculated. Follow these directives to dominate the global ladder.",
        "Part 1: The 14-Day Season Cycle",
        "- The Split Strategy: An Arena season lasts exactly two weeks. Dedicate the first 7 days strictly to gold farming (use a weak defense to farm easy wins). Use the final 7 days to aggressively push for trophies and global rankings.",
        "- Max Attempts: Never waste a ticket. You get 20 attempts per day, and gold for killed units is tripled in the Arena. Use every single attempt.",
        "- The Late Push: Play your daily ranked attacks as late in the day as possible to maximize your trophy earnings after the ladder settles.",
        "Part 2: Target Selection & Trophy Math",
        "Target Selection: Only attack players equivalent to your power or those you know are guaranteed wins.",
        "Trophy Math: The higher the trophy difference between you and your opponent, the more you earn. The maximum gain per battle is +35, and the maximum loss is -19. Protect your rating!",
        "Part 3: Information Warfare & Hero Meta",
        "- Hide Your Power: Always hide your best formation on defense. Save your ultimate, highly-tuned setup exclusively to crush the toughest opponents you face on offense.",
        "- Clan Sparring: Never test a new formation in ranked play. Test your Arena layouts by doing friendly battles with Clan Members first.",
        "- Hero Minimums: Mythical and Legendary heroes are incredibly powerful, but only after they reach Level 5 and unlock their active and passive skills. Until then, they might underperform.",
        "- Gear Optimization: Best heroes, weapons, and armor vary heavily based on your specific troop placement. Consult the Clan Heroes/Troops pages to synergize your gear.",
        "Follow this strategy, execute your 20 attacks daily, and secure your identity among the top global players! 💪🏻"
      ]
    },
    {
      "category": "ECONOMY META",
      "title": "The Premium Gem Matrix: Acquisition & Optimal Spending",
      "summary": "Master the secrets of infinite gem farming—including the Library milestone loop—and decode the 40-20-20-10 spending hierarchy.",
      "rules": [
        "Gems are the most critical premium resource in the realm. They dictate your access to elite troops and Legendary heroes. Squandering them on random chest pulls will completely ruin your late-game progression. Memorize this strategic manual to harvest and invest your gems flawlessly.",
        "Part 1: The Ultimate Gem Harvesting Streams",
        "- The Library Exploitation: This is your primary hidden goldmine. Keep executing stages to gather library books. Once you hit the 150-book milestone, the system triggers a massive payout: every single book collected from there on yields a massive 50 gems. Focus heavily on this.",
        "- Competitive & Grinding Yields: Secure top ranks in the Arena and Boss Raids to extract massive seasonal gem payloads. Supplement this daily by running Headhunt missions, unlocking your level-dependent Idle Chests, and clearing Campaign stages.",
        "- System Bonuses: Never miss a Daily Login claim or Promo Code drops (which frequently award up to 500 gems instantly). Use your daily Lucky Royale spins, which feature mega-jackpots up to 20k gems depending on your accumulated spin milestones.",
        "- Premium Access: For fast-track progression, purchase gem bundles directly from the store or invest in the Seasonal Battle Passes for high-density gem returns.",
        "Part 2: Tactical Fusion & Deployment Tricks",
        "The Gem-Saving Fusion Meta: Troop fusion consumes heavy resources. While a standard 4 + 4 + 4 level troop combination is common, veteran players use the highly efficient 10 + 4 + 1 config to bypass extreme fusion costs and save massive amounts of gems.",
        "Calculated Investments: Use gems for critical Hero Upgrades (starting at Level 7+), buying high-value 3k Hero Bundles, and targeted Lucky Wheel cycles to pull specific default troops/hero cards. Avoid buying single 350-gem chests unless absolutely necessary.",
        "Part 3: The Clan Gem Budget Matrix",
        "To ensure steady development without running dry, apply your gathered gems strictly to this percentage layout:",
        "40% — Troop & Hero Fusions: Your main spending engine to forge max-tier units.",
        "20% — High-Level Hero Upgrades: To unlock crucial ability stats past Level 7.",
        "20% — Legendary Bundles: Mandatory to raise your Legendary hero collection and secure powerful global Hero Bonuses.",
        "10% — Lucky Wheel Spins: For resource cycling and picking up extra upgrade materials.",
        "10% — Operational Reserves: Kept safely for emergency purchases, Conquest unlocks (worth 1700 gems for massive value), or Demo mode testing (10 gems per Boss run).",
        "// DIRECTIVE RECEIVED — COLLECT HOARD & DEPLOY WISELY //"
      ]
    },
    {
      "category": "WARFARE META",
      "title": "Operation Clan Clash: Tactical Deployment & Scoring Supremacy",
      "summary": "The absolute battlefield manual for the new PvP weekly event. Lock your formations, maximize your 3 daily attacks, and master the scoring formula.",
      "rules": [
        "Warriors, a new era of localized warfare has arrived—Clan Clash PvP is officially active. This weekly event lets us face off directly against opposing player formations to skyrocket our global clan ranking. Leaving attacks unused or mismanaging your setup will actively drag down the clan's progress. Memorize these combat protocols immediately.",
        "Part 1: The Weekly War Cycle",
        "- The Timeline: Clan Clashes ignite every single week, running for four consecutive days from Thursday to Sunday. No exceptions—all clans are automatically pulled into the bracket.",
        "- The Final Objective: Victory is determined purely by points. The clan with the highest cumulative score wins the clash. Forget trophies; in this event, raw event score is the only metric that matters.",
        "- The Spoils: Once the event concludes on Sunday, your personal points are added to the clan's pool and converted directly into valuable clan currency. Command Note: Payouts have been temporarily increased until new activities roll out—hoard this currency now.",
        "- Lock-out Restraint: Any mercenary or recruit who joins the clan while a Clan Clash is already active will be completely barred from participating in battles for that cycle.",
        "Part 2: Stage Protocols & Formation Lock",
        "Stage 1 — Preparation Day (Thursday): This stage lasts exactly 24 hours. You must manually set and save your defensive formation. Warning: Your formation is locked completely for the rest of the event once this day ends. If you fail to set it manually, the system will force-default to your last active Arena layout. Treat this with extreme care.",
        "Stage 2 — The Clash Phase (Friday to Sunday): The war phase runs for 3 days. All matches are completely auto-fought with a maximum time limit of 5 minutes per match. You will not have manual control over your heroes' abilities, making formation composition your highest priority asset.",
        "Part 3: Engagement Strategy & Score Multipliers",
        "Every member has exactly 3 high-value attack chances per day. There is zero risk of losing points on failure, meaning you must maximize your targets using this operational matrix:",
        "Target Acquisition: Do not waste attacks on low-tier, weak opponents that you can stomp instantly. Target players equal to or slightly stronger than your current rating, provided you have the element advantage to secure a win.",
        "The Score Formula: Points scale exponentially based on three locked variables. Optimize your matchups accordingly:",
        "[Your Army Power] + [Enemy Army Power] + [Battle Stats / Defeated Units] = Final Points",
        "Formation Directives: Study the opponent's defensive layout before committing. Cross-reference our internal Arena, Hero, and Formation guides to build custom counters before pressing fight.",
        "// TARGET EQUAL OR STRONGER — 3 DAILY AT TACKS ARE MANDATORY — NO EXCUSES //"
      ]
    },
    {
      "category": "TROOPS META",
      "title": "The Strategic Army Composition: Baseline Minimum Requirements",
      "summary": "The absolute minimum troop quantities and level thresholds required for clan members to participate in competitive Arena and Boss operations.",
      "rules": [
        "To maintain our competitive standing, all members must meet or exceed these barracks benchmarks. The quantities and levels listed below are strict minimum requirements—anything less is considered under-leveled for core operations.",
        "High-Priority Minimum Rush Targets",
        "- SG (Stone Golem) — [Arena]: Minimum requirement of exactly 1 unit pushed to Level 10 ASAP.",
        "- HEADLESS — [Boss / Arena]: Minimum requirement of exactly 1 unit pushed to Level 10 ASAP.",
        "Core Level 9 & 10 Minimum Benchmarks",
        "LG (Lava Golem) — [Arena / Boss]: Minimum of 3 units, all at least Level 9.",
        "BB (Bone Breaker) — [Boss / Arena]: Minimum of 1 unit at least Level 9.",
        "NH (Night Hunter) — [Arena]: Minimum of 1 unit at least Level 9.",
        "SHAMAN — [Arena]: Minimum of 2 units, both at least Level 9.",
        "SM (Storm Mistress) — [Boss / Arena]: Minimum of 1 unit at least Level 9.",
        "NM (Necromancer) — [Boss / Arena]: Minimum of 2 units, both at least Level 9.",
        "GRAVEDIGGER — [Boss / Arena]: Minimum of 4 units, all scaled to at least Level 10.",
        "ASSASSIN — [Boss / Arena]: Minimum of 4 units, all scaled to at least Level 10.",
        "MONKS — [Boss / Arena]: Minimum of 2 units, both scaled to at least Level 10.",
        "Mass Footprint Minimum Quantities",
        "- MA (Magic Archer) — [Arena]: Minimum of 6 units, all at least Level 8.",
        "- IMMORTALS — [Arena]: Minimum of 6 units, all at least Level 9.",
        "- CC (Cursed Catapult) — [Arena]: Strict minimum requirement of 6 units in active rotation.",
        "- UM (Undead Mage) — [Arena]: Strict minimum requirement of 4 units in active rotation.",
        "- ALCHEMIST — [Boss / Arena]: Strict minimum requirement of 5 units in active rotation.",
        "Non-Beneficial Cap (Do Not Exceed)",
        "IG (Iron Guards) — [Arena / Boss]: Confirmed as NOT BENEFICIAL in the current meta. Maintain a baseline minimum of only 1–2 units. Do not invest any further resources into this unit.",
        "// BARRACKS AUDIT PENDING — ENSURE ALL MINIMUM REQUIREMENTS ARE MET IMMEDIATELY //"
      ]
    }
  ],
  "troopHeroSynergy": [
    {
      "troopId": "tr-immortal",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Immortal belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Immortal belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-phoenix",
      "heroSynergies": [
        {
          "heroId": "ANAVIN_01",
          "reason": "Hero buffs allied Mage troops (attack/defense buff); Phoenix belongs to Mages."
        },
        {
          "heroId": "EDELINA_01",
          "reason": "Hero buffs allied Mage troops (synergy); Phoenix belongs to Mages."
        },
        {
          "heroId": "KEYRA_01",
          "reason": "Hero buffs allied Mage troops (attack buff); Phoenix belongs to Mages."
        },
        {
          "heroId": "ZAHEER_01",
          "reason": "Hero buffs allied Mage troops (synergy); Phoenix belongs to Mages."
        },
        {
          "heroId": "SIGURD_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Phoenix belongs to Mages."
        },
        {
          "heroId": "OPHELIA_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Phoenix belongs to Mages."
        }
      ]
    },
    {
      "troopId": "tr-alchemist",
      "heroSynergies": [
        {
          "heroId": "DRAGON_RIDER_01",
          "reason": "Hero buffs allied Human troops (attack buff); Alchemist belongs to Human."
        }
      ]
    },
    {
      "troopId": "tr-lava-golem",
      "heroSynergies": [
        {
          "heroId": "ANAVIN_01",
          "reason": "Hero buffs allied Mage troops (attack/defense buff); Lava Golem belongs to Mages."
        },
        {
          "heroId": "EDELINA_01",
          "reason": "Hero buffs allied Mage troops (synergy); Lava Golem belongs to Mages."
        },
        {
          "heroId": "KEYRA_01",
          "reason": "Hero buffs allied Mage troops (attack buff); Lava Golem belongs to Mages."
        },
        {
          "heroId": "ZAHEER_01",
          "reason": "Hero buffs allied Mage troops (synergy); Lava Golem belongs to Mages."
        },
        {
          "heroId": "SIGURD_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Lava Golem belongs to Mages."
        },
        {
          "heroId": "OPHELIA_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Lava Golem belongs to Mages."
        }
      ]
    },
    {
      "troopId": "tr-shaman",
      "heroSynergies": [
        {
          "heroId": "ANAVIN_01",
          "reason": "Hero buffs allied Mage troops (attack/defense buff); Shaman belongs to Mages."
        },
        {
          "heroId": "EDELINA_01",
          "reason": "Hero buffs allied Mage troops (synergy); Shaman belongs to Mages."
        },
        {
          "heroId": "KEYRA_01",
          "reason": "Hero buffs allied Mage troops (attack buff); Shaman belongs to Mages."
        },
        {
          "heroId": "ZAHEER_01",
          "reason": "Hero buffs allied Mage troops (synergy); Shaman belongs to Mages."
        },
        {
          "heroId": "SIGURD_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Shaman belongs to Mages."
        },
        {
          "heroId": "OPHELIA_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Shaman belongs to Mages."
        }
      ]
    },
    {
      "troopId": "tr-stone-golem",
      "heroSynergies": [
        {
          "heroId": "ANAVIN_01",
          "reason": "Hero buffs allied Mage troops (attack/defense buff); Stone Golem belongs to Mages."
        },
        {
          "heroId": "EDELINA_01",
          "reason": "Hero buffs allied Mage troops (synergy); Stone Golem belongs to Mages."
        },
        {
          "heroId": "KEYRA_01",
          "reason": "Hero buffs allied Mage troops (attack buff); Stone Golem belongs to Mages."
        },
        {
          "heroId": "ZAHEER_01",
          "reason": "Hero buffs allied Mage troops (synergy); Stone Golem belongs to Mages."
        },
        {
          "heroId": "SIGURD_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Stone Golem belongs to Mages."
        },
        {
          "heroId": "OPHELIA_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Stone Golem belongs to Mages."
        }
      ]
    },
    {
      "troopId": "tr-bonebreaker",
      "heroSynergies": [
        {
          "heroId": "DRAGON_RIDER_01",
          "reason": "Hero buffs allied Human troops (attack buff); Bonebreaker belongs to Human."
        }
      ]
    },
    {
      "troopId": "tr-headless",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Headless belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Headless belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-magic-archer",
      "heroSynergies": [
        {
          "heroId": "ANAVIN_01",
          "reason": "Hero buffs allied Mage troops (attack/defense buff); Magic Archer belongs to Mages."
        },
        {
          "heroId": "EDELINA_01",
          "reason": "Hero buffs allied Mage troops (synergy); Magic Archer belongs to Mages."
        },
        {
          "heroId": "KEYRA_01",
          "reason": "Hero buffs allied Mage troops (attack buff); Magic Archer belongs to Mages."
        },
        {
          "heroId": "ZAHEER_01",
          "reason": "Hero buffs allied Mage troops (synergy); Magic Archer belongs to Mages."
        },
        {
          "heroId": "SIGURD_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Magic Archer belongs to Mages."
        },
        {
          "heroId": "OPHELIA_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Magic Archer belongs to Mages."
        }
      ]
    },
    {
      "troopId": "tr-monk",
      "heroSynergies": [
        {
          "heroId": "DRAGON_RIDER_01",
          "reason": "Hero buffs allied Human troops (attack buff); Monk belongs to Human."
        }
      ]
    },
    {
      "troopId": "tr-assassins",
      "heroSynergies": [
        {
          "heroId": "DRAGON_RIDER_01",
          "reason": "Hero buffs allied Human troops (attack buff); Assassins belongs to Human."
        }
      ]
    },
    {
      "troopId": "tr-storm-mistresses",
      "heroSynergies": [
        {
          "heroId": "ANAVIN_01",
          "reason": "Hero buffs allied Mage troops (attack/defense buff); Storm Mistresses belongs to Mages."
        },
        {
          "heroId": "EDELINA_01",
          "reason": "Hero buffs allied Mage troops (synergy); Storm Mistresses belongs to Mages."
        },
        {
          "heroId": "KEYRA_01",
          "reason": "Hero buffs allied Mage troops (attack buff); Storm Mistresses belongs to Mages."
        },
        {
          "heroId": "ZAHEER_01",
          "reason": "Hero buffs allied Mage troops (synergy); Storm Mistresses belongs to Mages."
        },
        {
          "heroId": "SIGURD_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Storm Mistresses belongs to Mages."
        },
        {
          "heroId": "OPHELIA_01",
          "reason": "Hero buffs allied Mage troops (HP buff); Storm Mistresses belongs to Mages."
        }
      ]
    },
    {
      "troopId": "tr-cursed-catapult",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Cursed Catapult belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Cursed Catapult belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-imp",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Imp belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Imp belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-night-hunter",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Night Hunter belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Night Hunter belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-pyrotechnician",
      "heroSynergies": [
        {
          "heroId": "DRAGON_RIDER_01",
          "reason": "Hero buffs allied Human troops (attack buff); Pyrotechnician belongs to Human."
        }
      ]
    },
    {
      "troopId": "tr-gravedigger",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Gravedigger belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Gravedigger belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-axe-throwers",
      "heroSynergies": [
        {
          "heroId": "DRAGON_RIDER_01",
          "reason": "Hero buffs allied Human troops (attack buff); Axe Throwers belongs to Human."
        }
      ]
    },
    {
      "troopId": "tr-steel-revenant",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Steel Revenant belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Steel Revenant belongs to Undead."
        }
      ]
    },
    {
      "troopId": "tr-necromancer",
      "heroSynergies": [
        {
          "heroId": "DRAKE_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Necromancer belongs to Undead."
        },
        {
          "heroId": "BONE_DRAGON_01",
          "reason": "Hero buffs allied Undead troops (attack buff); Necromancer belongs to Undead."
        }
      ]
    }
  ],
  "heroSynergyIndex": {
    "buffsMageAttack": [
      "ANAVIN_01",
      "KEYRA_01"
    ],
    "buffsMageHP": [
      "SIGURD_01",
      "OPHELIA_01"
    ],
    "buffsMageDefense": [
      "ANAVIN_01"
    ],
    "buffsHumanAttack": [
      "DRAGON_RIDER_01"
    ],
    "buffsHumanHP": [],
    "buffsHumanDefense": [],
    "buffsUndeadAttack": [
      "DRAKE_01",
      "BONE_DRAGON_01"
    ],
    "buffsUndeadHP": [],
    "buffsUndeadDefense": [],
    "buffsTankDefense": [],
    "buffsTankDamage": [],
    "buffsTroopAttack": [
      "ANAVIN_01",
      "ATREYA_01",
      "REMUS_01",
      "TRISTAN_01"
    ],
    "buffsTroopHP": [
      "CALYRA_01",
      "TRISTAN_01"
    ],
    "buffsTroopDefense": [
      "ANAVIN_01",
      "DURAND_01"
    ],
    "bossDamage": [
      "HARKON_01",
      "REMUS_01"
    ],
    "healing": [
      "CALYRA_01"
    ],
    "shielding": [
      "REMUS_01"
    ],
    "crowdControl": [
      "EDELINA_01",
      "BRUTALLUS_01",
      "DURAND_01",
      "BUMI_01",
      "KEYRA_01",
      "ZAHEER_01",
      "SIGURD_01",
      "MORGANA_01"
    ],
    "debuffers": [
      "MORGRANE_01",
      "DURAND_01",
      "OPHELIA_01"
    ],
    "evasionBuff": [
      "BUMI_01",
      "ZAHEER_01"
    ],
    "summoners": [
      "XANA_01",
      "CALYRA_01",
      "MORGRANE_01",
      "DRAKE_01",
      "ZAHEER_01",
      "MORGANA_01"
    ]
  },
  "indexes": {
    "troopsByCategory": {
      "Undead": [
        "tr-immortal",
        "tr-headless",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-night-hunter",
        "tr-gravedigger",
        "tr-steel-revenant",
        "tr-necromancer"
      ],
      "Tank": [
        "tr-immortal",
        "tr-phoenix",
        "tr-lava-golem",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-monk",
        "tr-steel-revenant"
      ],
      "Mages": [
        "tr-phoenix",
        "tr-lava-golem",
        "tr-shaman",
        "tr-stone-golem",
        "tr-magic-archer",
        "tr-storm-mistresses"
      ],
      "Ranger": [
        "tr-phoenix",
        "tr-shaman",
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-pyrotechnician",
        "tr-axe-throwers"
      ],
      "Human": [
        "tr-alchemist",
        "tr-bonebreaker",
        "tr-monk",
        "tr-assassins",
        "tr-pyrotechnician",
        "tr-axe-throwers"
      ],
      "Support": [
        "tr-alchemist",
        "tr-shaman",
        "tr-stone-golem",
        "tr-headless",
        "tr-night-hunter",
        "tr-steel-revenant",
        "tr-necromancer"
      ],
      "Trickster": [
        "tr-bonebreaker",
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-night-hunter",
        "tr-gravedigger",
        "tr-axe-throwers"
      ]
    },
    "troopsByRole": {
      "Tank": [
        "tr-immortal",
        "tr-phoenix",
        "tr-lava-golem",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-monk",
        "tr-steel-revenant"
      ],
      "Support": [
        "tr-alchemist",
        "tr-shaman",
        "tr-night-hunter",
        "tr-necromancer"
      ],
      "Ranger": [
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-pyrotechnician",
        "tr-axe-throwers"
      ],
      "Trickster": [
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-gravedigger"
      ]
    },
    "troopsByRarity": {
      "epic": [
        "tr-immortal",
        "tr-alchemist",
        "tr-lava-golem",
        "tr-magic-archer",
        "tr-monk",
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-pyrotechnician",
        "tr-necromancer"
      ],
      "legendary": [
        "tr-phoenix",
        "tr-shaman",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-night-hunter",
        "tr-axe-throwers",
        "tr-steel-revenant"
      ],
      "rare": [
        "tr-cursed-catapult",
        "tr-imp",
        "tr-gravedigger"
      ]
    },
    "troopsByTag": {
      "Undead": [
        "tr-immortal",
        "tr-headless",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-night-hunter",
        "tr-gravedigger",
        "tr-steel-revenant",
        "tr-necromancer"
      ],
      "Tank": [
        "tr-immortal",
        "tr-phoenix",
        "tr-lava-golem",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-monk",
        "tr-steel-revenant"
      ],
      "Melee": [
        "tr-immortal",
        "tr-lava-golem",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-monk",
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-night-hunter",
        "tr-gravedigger",
        "tr-steel-revenant"
      ],
      "AoE": [
        "tr-immortal",
        "tr-phoenix",
        "tr-alchemist",
        "tr-lava-golem",
        "tr-cursed-catapult",
        "tr-night-hunter",
        "tr-pyrotechnician"
      ],
      "Frontline": [
        "tr-immortal",
        "tr-phoenix",
        "tr-lava-golem",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-monk",
        "tr-steel-revenant"
      ],
      "Mages": [
        "tr-phoenix",
        "tr-lava-golem",
        "tr-shaman",
        "tr-stone-golem",
        "tr-magic-archer",
        "tr-storm-mistresses"
      ],
      "Ranger": [
        "tr-phoenix",
        "tr-shaman",
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-pyrotechnician",
        "tr-axe-throwers"
      ],
      "Ranged": [
        "tr-phoenix",
        "tr-alchemist",
        "tr-shaman",
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-pyrotechnician",
        "tr-axe-throwers",
        "tr-necromancer"
      ],
      "Low-HP Scaling": [
        "tr-phoenix",
        "tr-lava-golem"
      ],
      "Revival": [
        "tr-phoenix"
      ],
      "Backline-DPS": [
        "tr-phoenix",
        "tr-shaman",
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-pyrotechnician",
        "tr-axe-throwers"
      ],
      "Human": [
        "tr-alchemist",
        "tr-bonebreaker",
        "tr-monk",
        "tr-assassins",
        "tr-pyrotechnician",
        "tr-axe-throwers"
      ],
      "Support": [
        "tr-alchemist",
        "tr-shaman",
        "tr-stone-golem",
        "tr-headless",
        "tr-night-hunter",
        "tr-steel-revenant",
        "tr-necromancer"
      ],
      "Healer": [
        "tr-alchemist"
      ],
      "Summoner": [
        "tr-stone-golem",
        "tr-cursed-catapult",
        "tr-necromancer"
      ],
      "Trickster": [
        "tr-bonebreaker",
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-night-hunter",
        "tr-gravedigger",
        "tr-axe-throwers"
      ],
      "Crowd-Control": [
        "tr-headless",
        "tr-night-hunter"
      ],
      "Damage-Reflect": [
        "tr-steel-revenant"
      ]
    },
    "heroesByFaction": {
      "MAGES": [
        "ANAVIN_01",
        "EDELINA_01",
        "BUMI_01",
        "KEYRA_01",
        "ZAHEER_01",
        "SIGURD_01",
        "OPHELIA_01"
      ],
      "DREADS": [
        "XANA_01",
        "HARKON_01",
        "BRUTALLUS_01"
      ],
      "ELEVATES": [
        "CALYRA_01",
        "ATREYA_01",
        "REMUS_01"
      ],
      "UNDEAD": [
        "MALIUM_01",
        "MORGRANE_01",
        "DRAKE_01",
        "BONE_DRAGON_01",
        "MORGANA_01"
      ],
      "HUMAN": [
        "TRISTAN_01",
        "DURAND_01",
        "DRAGON_RIDER_01"
      ]
    },
    "heroesByRarity": {
      "legendary": [
        "ANAVIN_01",
        "EDELINA_01",
        "MORGRANE_01",
        "DURAND_01",
        "BUMI_01",
        "DRAKE_01",
        "KEYRA_01",
        "ZAHEER_01",
        "SIGURD_01",
        "BONE_DRAGON_01",
        "MORGANA_01",
        "OPHELIA_01",
        "DRAGON_RIDER_01"
      ],
      "mythical": [
        "XANA_01",
        "HARKON_01",
        "BRUTALLUS_01",
        "CALYRA_01",
        "ATREYA_01",
        "REMUS_01"
      ],
      "epic": [
        "MALIUM_01",
        "TRISTAN_01"
      ]
    },
    "heroesByBuff": {
      "Attack-Buff": [
        "ANAVIN_01",
        "BRUTALLUS_01",
        "ATREYA_01",
        "REMUS_01",
        "MALIUM_01",
        "TRISTAN_01",
        "DRAKE_01",
        "KEYRA_01",
        "BONE_DRAGON_01",
        "MORGANA_01",
        "DRAGON_RIDER_01"
      ],
      "Defense-Buff": [
        "ANAVIN_01",
        "DURAND_01"
      ],
      "Boss-Damage": [
        "HARKON_01",
        "REMUS_01"
      ],
      "HP-Buff": [
        "CALYRA_01",
        "TRISTAN_01",
        "SIGURD_01",
        "MORGANA_01",
        "OPHELIA_01"
      ],
      "Healing": [
        "CALYRA_01"
      ],
      "Shielding": [
        "REMUS_01"
      ],
      "Evasion-Buff": [
        "BUMI_01",
        "ZAHEER_01"
      ]
    },
    "heroesByDebuff": {
      "Debuffer": [
        "MORGRANE_01",
        "DURAND_01",
        "OPHELIA_01"
      ]
    }
  },
  "formulas": {
    "troopPower": "troopPower(troopId, level, squads) = TROOP_POWER[rarityOf(troopId)][level-1] * squads",
    "heroPower": "heroPower(heroId, level) = HERO_POWER[rarityOf(heroId)][level-1]",
    "weaponMastery": "weaponMasteryBonusPct = weaponLevel * 0.20  (0 if no weapon equipped)",
    "armorMastery": "armorMasteryBonusPct = armorLevel * 0.20  (0 if no armor equipped)",
    "totalBonusPct": "totalBonusPct = heroCollectionBonusPct + weaponMasteryBonusPct + armorMasteryBonusPct",
    "multiplier": "multiplier = 1 + totalBonusPct / 100",
    "armyPower": "armyPower = sum over all troop rows of troopPower(troop, level, squads)",
    "totalHeroPower": "totalHeroPower = heroPower(hero1, hero1Level) + heroPower(hero2, hero2Level)",
    "basePower": "basePower = armyPower + totalHeroPower",
    "finalArmyPower": "finalPower = round(basePower * multiplier)",
    "rarityNormalization": "getRarity(name): 'mythical' is treated as 'legendary' tier for power tables; unknown/blank rarity defaults to 'epic'",
    "lookupTables": {
      "HERO_POWER": {
        "legendary": [
          3500,
          4200,
          5200,
          6200,
          7200,
          8600,
          10300,
          12400,
          14900,
          17900
        ],
        "mythical": [
          3500,
          4200,
          5200,
          6200,
          7200,
          8600,
          10300,
          12400,
          14900,
          17900
        ],
        "epic": [
          2200,
          2640,
          3168,
          3802,
          4562,
          5474,
          6600,
          7920,
          9504,
          11405
        ],
        "rare": [
          1500,
          1800,
          2160,
          2592,
          3110,
          3732,
          6600,
          7900,
          9480,
          11400
        ]
      },
      "TROOP_POWER": {
        "rare": [
          120,
          240,
          480,
          960,
          1920,
          3840,
          7680,
          11520,
          23040,
          46080
        ],
        "epic": [
          140,
          280,
          560,
          1120,
          2240,
          4480,
          8960,
          13440,
          26880,
          53760
        ],
        "legendary": [
          160,
          320,
          640,
          1280,
          2560,
          5120,
          10240,
          15360,
          30720,
          61440
        ]
      },
      "NOTE": "Index 0 = Level 1 ... Index 9 = Level 10. Values represent per-unit base power before squads multiplier (troops) and are per-hero-level power (heroes)."
    },
    "equipment": {
      "weapons": [
        "Mirage glaive",
        "Hammer of Devournment"
      ],
      "armors": [
        "armor of devounment",
        "mirage garment"
      ],
      "masteryFormula": "bonusPct = itemLevel * 0.20 (applies per item, 0 if item is 'none')"
    }
  }
};

module.exports = { gameLibrary };
