/**
 * MELODY Game Knowledge Library — Heroes
 * Each hero includes standardized faction/type fields plus tags[] and
 * analysis{ primaryRole, secondaryRoles, strengths, weaknesses } for the
 * routing engine's .some()/.includes() synergy scans.
 */
const heroes = [
  {
    "id": "ANAVIN_01",
    "name": "FIRETAMER ANAVIN",
    "faction": "Mages",
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
    "type": "Mage",
    "analysis": {
      "primaryRole": "Mage",
      "secondaryRoles": [
        "Support",
        "AoE-Damage"
      ],
      "strengths": [
        "High AoE damage output",
        "Buffs allied attack & defense mid-fight"
      ],
      "weaknesses": [
        "Below-average defense",
        "Buff requires ability activation delay"
      ]
    }
  },
  {
    "id": "EDELINA_01",
    "name": "EDELINA, QUEEN OF THE FOREST",
    "faction": "Mages",
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
    "type": "Mage",
    "analysis": {
      "primaryRole": "Mage",
      "secondaryRoles": [
        "Crowd-Control",
        "Support"
      ],
      "strengths": [
        "Immobilizes enemies with root damage",
        "Reflect damage protects allied mages"
      ],
      "weaknesses": [
        "Below-average attack",
        "Low direct damage output"
      ]
    }
  },
  {
    "id": "XANA_01",
    "name": "FIRE FURY XANA",
    "faction": "Dreads",
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
    "type": "Summoner",
    "analysis": {
      "primaryRole": "Summoner",
      "secondaryRoles": [
        "Mage",
        "AoE-Damage"
      ],
      "strengths": [
        "Sustained AoE burn damage",
        "Converts fallen units into lava golems"
      ],
      "weaknesses": [
        "Below-average defense",
        "Reliant on ally deaths to scale"
      ]
    }
  },
  {
    "id": "HARKON_01",
    "name": "HERALD OF FLAME HARKON",
    "faction": "Dreads",
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
      "description": "Harkon enchants allied units so they only take a portion of incoming damage. The remaining damage is taken gradually once per second for 5 seconds. The effect continues after the hero's death but does not work in boss battles.",
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
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Boss-Damage",
        "AoE-Damage"
      ],
      "strengths": [
        "Reduces burst damage taken by allies",
        "Snowballing fire damage vs bosses"
      ],
      "weaknesses": [
        "Damage-mitigation shield disabled in boss battles",
        "Average HP pool"
      ]
    }
  },
  {
    "id": "BRUTALLUS_01",
    "name": "BRUTALLUS THE TERRORBRINGER",
    "faction": "Dreads",
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
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Crowd-Control",
        "Tank"
      ],
      "strengths": [
        "Highest HP and defense of any hero",
        "Fear effect increases damage vs feared enemies",
        "Grants allies speed to evade damage"
      ],
      "weaknesses": [
        "Lowest attack stat among Dreads heroes",
        "Utility-focused, low personal damage"
      ]
    }
  },
  {
    "id": "CALYRA_01",
    "name": "CALYRA, CELESTIAL HEALER",
    "faction": "Elevates",
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
    "type": "Healer",
    "analysis": {
      "primaryRole": "Healer",
      "secondaryRoles": [
        "Support",
        "Summoner"
      ],
      "strengths": [
        "Continuous AoE healing pulses",
        "Heal-over-time persists after hero death"
      ],
      "weaknesses": [
        "No direct damage output",
        "Below-average attack"
      ]
    }
  },
  {
    "id": "ATREYA_01",
    "name": "ATREYA, HAND OF VENGEANCE",
    "faction": "Elevates",
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
    "type": "Ranger",
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Support",
        "AoE-Damage"
      ],
      "strengths": [
        "High attack stat",
        "Buffs allied crit-style damage chance, persists after death"
      ],
      "weaknesses": [
        "Below-average HP",
        "Fragile if focused"
      ]
    }
  },
  {
    "id": "REMUS_01",
    "name": "REMUS THE INDESTRUCTIBLE",
    "faction": "Elevates",
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
    "type": "Tank",
    "analysis": {
      "primaryRole": "Tank",
      "secondaryRoles": [
        "Support",
        "Boss-Damage"
      ],
      "strengths": [
        "Very high HP and defense",
        "Shields allies from incoming damage",
        "Bonus damage vs tanks/bosses persists after death"
      ],
      "weaknesses": [
        "Low attack stat",
        "Low personal damage output"
      ]
    }
  },
  {
    "id": "MALIUM_01",
    "name": "MALIUM, THE HERALD OF CORRUPTION",
    "faction": "Undead",
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
    "type": "Debuffer",
    "analysis": {
      "primaryRole": "Debuffer",
      "secondaryRoles": [
        "Undead",
        "AoE-Damage"
      ],
      "strengths": [
        "Poison DoT zones control space",
        "Increases damage enemies take while poisoned"
      ],
      "weaknesses": [
        "No active ability, talent-only kit",
        "Below-average defense"
      ]
    }
  },
  {
    "id": "TRISTAN_01",
    "name": "CLERIC TRISTAN",
    "faction": "Human",
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
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Human",
        "HP-Buff"
      ],
      "strengths": [
        "Simple, reliable HP and attack buff for the whole squad",
        "Strengthens frontline resilience"
      ],
      "weaknesses": [
        "No crowd control or debuff utility",
        "Below-average attack stat"
      ]
    }
  },
  {
    "id": "MORGRANE_01",
    "name": "PLAGUE LORD MORGRANE",
    "faction": "Undead",
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
    "type": "Debuffer",
    "analysis": {
      "primaryRole": "Debuffer",
      "secondaryRoles": [
        "Summoner",
        "Undead"
      ],
      "strengths": [
        "Marks enemies to reduce their attack damage",
        "Cooldown reduction on marked-enemy kills"
      ],
      "weaknesses": [
        "Below-average attack",
        "Delayed impact until rat is killed"
      ]
    }
  },
  {
    "id": "DURAND_01",
    "name": "INQUISITOR DURAND",
    "faction": "Human",
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
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Tank-Buff",
        "Debuffer",
        "Crowd-Control"
      ],
      "strengths": [
        "Reduces damage taken by allied tanks",
        "Fear effect scatters enemies",
        "High HP and defense"
      ],
      "weaknesses": [
        "Below-average attack stat"
      ]
    }
  },
  {
    "id": "BUMI_01",
    "name": "BUMI THE DREAMWALKER",
    "faction": "Mages",
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
    "type": "Controller",
    "analysis": {
      "primaryRole": "Controller",
      "secondaryRoles": [
        "Mage",
        "Evasion-Buff"
      ],
      "strengths": [
        "Disables enemies with sleep zones",
        "Protects allies from ranged attackers"
      ],
      "weaknesses": [
        "Below-average HP and defense",
        "No direct damage buff"
      ]
    }
  },
  {
    "id": "DRAKE_01",
    "name": "DRAKE, TERROR OF THE SEAS",
    "faction": "Undead",
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
      "description": "In Drake's presence, allied undead units have a chance to deal double damage with regular attacks.",
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
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Undead",
        "Summoner"
      ],
      "strengths": [
        "Boosts undead troop damage with double-hit chance",
        "Summons a damaging ghost ship"
      ],
      "weaknesses": [
        "Average stats overall, no standout durability"
      ]
    }
  },
  {
    "id": "KEYRA_01",
    "name": "KEYRA THE WATER MAGE",
    "faction": "Mages",
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
    "type": "Mage",
    "analysis": {
      "primaryRole": "Mage",
      "secondaryRoles": [
        "Crowd-Control",
        "Support"
      ],
      "strengths": [
        "Launches enemies to disable them",
        "Attack buff scales with allied mage HP"
      ],
      "weaknesses": [
        "Below-average HP and defense",
        "Fragile"
      ]
    }
  },
  {
    "id": "ZAHEER_01",
    "name": "ZAHEER THE AIRLORD",
    "faction": "Mages",
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
    "type": "Controller",
    "analysis": {
      "primaryRole": "Controller",
      "secondaryRoles": [
        "Mage",
        "Summoner"
      ],
      "strengths": [
        "Tornado pulls and disables multiple enemies",
        "Grants allied mages dodge chance"
      ],
      "weaknesses": [
        "Lowest defense among all heroes",
        "Below-average HP"
      ]
    }
  },
  {
    "id": "SIGURD_01",
    "name": "SIGURD THE ICE MAGE",
    "faction": "Mages",
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
    "type": "Mage",
    "analysis": {
      "primaryRole": "Mage",
      "secondaryRoles": [
        "Crowd-Control",
        "HP-Buff"
      ],
      "strengths": [
        "Stuns and sweeps enemies with a growing snowball",
        "Buffs allied mage HP"
      ],
      "weaknesses": [
        "Below-average attack",
        "No damage buff support"
      ]
    }
  },
  {
    "id": "BONE_DRAGON_01",
    "name": "BONE DRAGON",
    "faction": "Undead",
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
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Undead",
        "AoE-Damage"
      ],
      "strengths": [
        "High HP pool",
        "Boosts undead troop damage",
        "Persistent damage-over-time flight path"
      ],
      "weaknesses": [
        "No crowd control or debuff utility"
      ]
    }
  },
  {
    "id": "MORGANA_01",
    "name": "MORGANA THE DARK MAGE",
    "faction": "Undead",
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
    "type": "Summoner",
    "analysis": {
      "primaryRole": "Summoner",
      "secondaryRoles": [
        "Crowd-Control",
        "Undead"
      ],
      "strengths": [
        "Converts enemy kills into allied skeletons",
        "Taunt disables enemy abilities",
        "Buffs summoned skeletons attack and HP"
      ],
      "weaknesses": [
        "Below-average HP and defense",
        "Relies on sustained combat to snowball"
      ]
    }
  },
  {
    "id": "OPHELIA_01",
    "name": "OPHELIA THE SPELLCASTER",
    "faction": "Mages",
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
    "type": "Mage",
    "analysis": {
      "primaryRole": "Mage",
      "secondaryRoles": [
        "Debuffer",
        "HP-Buff"
      ],
      "strengths": [
        "Curses killers of allied mages, reducing their damage",
        "Self-buffs HP and damage via spirit demon"
      ],
      "weaknesses": [
        "Below-average defense",
        "No AoE crowd control"
      ]
    }
  },
  {
    "id": "DRAGON_RIDER_01",
    "name": "DRAGON RIDER",
    "faction": "Human",
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
    "type": "Ranger",
    "analysis": {
      "primaryRole": "Ranger",
      "secondaryRoles": [
        "Human",
        "AoE-Damage"
      ],
      "strengths": [
        "High single-target/AoE meteor damage",
        "Boosts allied human troop damage"
      ],
      "weaknesses": [
        "Below-average HP and defense",
        "No crowd control or defensive utility"
      ]
    }
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // NEW HERO: BARON BENUA
  // Source: In-game screenshot (Level 9, Human / Rare)
  // Stats confirmed at Level 9 from screenshot: HP 30,000 | Defense 425 | Damage 505
  // All level scaling arrays derived from the screenshot's stat progression tables.
  // Ability: Gold Mark (Active) — AOE Radius 15, Cooldown 6s, Gold Multiplier 1.4
  //   at Level 9. Level 10 values taken from the displayed progression table.
  // Collection Bonus: Rare-tier estimation consistent with other Rare/Epic heroes
  //   (range 9–11). Set to 9.0 — flag as estimate if official value becomes known.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    "id": "BARON_BENUA_01",
    "name": "BARON BENUA",
    "faction": "Human",
    "rarity": "rare",
    "description": "A wealthy baron who pays generously for results. Baron Benua marks high-value targets and rewards their elimination with additional gold, making every kill more profitable for his allies.",
    "stats": {
      // Values at Level 9 as read from the in-game screenshot.
      // Full level scaling is captured in the abilityLevelStats below.
      "hp": 30000,
      "defense": 425,
      "attack": 505,
      // collectionBonus: Rare-tier estimate — no official value confirmed in data.
      // Other Rare/Epic heroes range 9–11; 9.0 used as conservative baseline.
      "collectionBonus": 9.0
    },
    "talent": null,
    // Baron Benua has no talent listed in the screenshot — only an Active ability.
    "ability": {
      "name": "Gold Mark",
      "description": "Gives an additional reward for enemy heads. Baron pays generously for killing undesirable opponents. Marks enemies in an AOE radius; killing marked enemies generates bonus gold with a gold multiplier.",
      "type": "Active",
      "effects": {
        // Full level 1–10 scaling read directly from the in-game screenshot table.
        // Values bolded in the screenshot (Level 9) are confirmed; all others are
        // as displayed in the progression list.
        "AOE Radius": "12 / 12 / 13 / 13 / 13 / 14 / 14 / 14 / 15 / 15",
        "Cooldown (sec)": "9 / 8 / 8 / 8 / 7 / 7 / 7 / 6 / 6 / 6",
        "Gold Multiplier": "1.2 / 1.2 / 1.2 / 1.3 / 1.3 / 1.3 / 1.4 / 1.4 / 1.4 / 1.5"
      },
      // Machine-readable level scaling arrays (index 0 = Level 1, index 9 = Level 10)
      "levelStats": {
        "aoeRadius":       [12, 12, 13, 13, 13, 14, 14, 14, 15, 15],
        "cooldownSec":     [9,  8,  8,  8,  7,  7,  7,  6,  6,  6],
        "goldMultiplier":  [1.2, 1.2, 1.2, 1.3, 1.3, 1.3, 1.4, 1.4, 1.4, 1.5]
      },
      "targets": []
    },
    // Full HP/Defense/Damage scaling extracted from the in-game stat table.
    // Level 9 values (bolded in screenshot) are ground-truth; others as shown.
    "statLevels": {
      "hp":      [20000, 21250, 22500, 23750, 25000, 26250, 27500, 28750, 30000, 31250],
      "defense": [85,    85,    170,   170,   255,   255,   340,   340,   425,   425],
      "attack":  [330,   350,   375,   395,   420,   440,   460,   485,   505,   530]
    },
    "tags": [
      "Human",
      "Gold-Generation",
      "Economy",
      "AoE",
      "Active-Ability"
    ],
    "type": "Support",
    "analysis": {
      "primaryRole": "Support",
      "secondaryRoles": [
        "Human",
        "Economy",
        "Gold-Generation"
      ],
      "strengths": [
        "Generates bonus gold on kills — unique economy utility among all heroes",
        "Short cooldown (6s at max level) means frequent mark reapplication",
        "Scales gold multiplier to 1.5x at Level 10",
        "Pairs well with high-damage human squads to maximize kill tempo and gold income"
      ],
      "weaknesses": [
        "Rare rarity — lower collection bonus than Legendary/Mythical heroes",
        "No direct combat buff to troop HP, damage, or defense",
        "Below-average attack and HP relative to combat-focused heroes",
        "Ability is utility-only; does not increase army DPS or survivability directly"
      ]
    }
  }
];

module.exports = heroes;
