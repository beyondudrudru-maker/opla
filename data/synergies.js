/**
 * MELODY Game Knowledge Library — Synergies
 * Cross-reference data for the routing engine:
 *  - troopHeroSynergy: per-troop list of hero IDs with a synergy reason
 *  - heroSynergyIndex: hero IDs grouped by buff/utility category
 *  - indexes: troops/heroes grouped by category, role, rarity, tag, buff, debuff
 */
const synergies = {
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
  }
};

module.exports = synergies;
