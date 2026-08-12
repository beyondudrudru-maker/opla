/**
 * MELODY Game Knowledge Library — Synergies
 * Cross-reference data for the routing engine:
 *  - troopHeroSynergy: per-troop list of hero IDs with a synergy reason
 *  - heroSynergyIndex: hero IDs grouped by buff/utility category
 *  - indexes: troops/heroes grouped by category, role, rarity, tag, buff,
 *    debuff, plus (new) combatLine and supportFocus
 *  - formations: ready-to-use, pre-calculated squad compositions built
 *    strictly from the new combatLine/supportFocus/synergyCategories
 *    fields on troops.js/heroes.js, each with a reasoning string the AI
 *    can surface directly instead of re-deriving "why" a combo works.
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
        },
        {
          "heroId": "LIREAL_01",
          "reason": "Hero buffs All Allies (troop-scaling damage passive + attack/damage-reduction ability); Phoenix benefits like any troop in the army."
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
        },
        {
          "heroId": "LIREAL_01",
          "reason": "Hero buffs All Allies (troop-scaling damage passive + attack/damage-reduction ability); Lava Golem benefits like any troop in the army."
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
        },
        {
          "heroId": "LIREAL_01",
          "reason": "Hero buffs All Allies (troop-scaling damage passive + attack/damage-reduction ability); Shaman benefits like any troop in the army."
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
        },
        {
          "heroId": "LIREAL_01",
          "reason": "Hero buffs All Allies (troop-scaling damage passive + attack/damage-reduction ability); Stone Golem benefits like any troop in the army."
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
        },
        {
          "heroId": "LIREAL_01",
          "reason": "Hero buffs All Allies (troop-scaling damage passive + attack/damage-reduction ability); Magic Archer benefits like any troop in the army."
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
        },
        {
          "heroId": "LIREAL_01",
          "reason": "Hero buffs All Allies (troop-scaling damage passive + attack/damage-reduction ability); Storm Mistresses benefits like any troop in the army."
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
      "TRISTAN_01",
      "LIREAL_01"
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
    ],
    "damageReduction": [
      "LIREAL_01"
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
        "OPHELIA_01",
        "LIREAL_01"
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
        "DRAGON_RIDER_01",
        "LIREAL_01"
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
        "DRAGON_RIDER_01",
        "LIREAL_01"
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
      ],
      "Damage-Reduction": [
        "LIREAL_01"
      ]
    },
    "heroesByDebuff": {
      "Debuffer": [
        "MORGRANE_01",
        "DURAND_01",
        "OPHELIA_01"
      ]
    },
    "troopsByCombatLine": {
      "Frontline": [
        "tr-immortal",
        "tr-lava-golem",
        "tr-stone-golem",
        "tr-bonebreaker",
        "tr-headless",
        "tr-monk",
        "tr-steel-revenant"
      ],
      "Aerial": [
        "tr-phoenix",
        "tr-imp"
      ],
      "Backline": [
        "tr-alchemist",
        "tr-shaman",
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-pyrotechnician",
        "tr-axe-throwers",
        "tr-necromancer"
      ],
      "Midline": [
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-night-hunter",
        "tr-gravedigger"
      ]
    },
    "heroesBySupportFocusPrimary": {
      "Mage Troops": [
        "ANAVIN_01",
        "EDELINA_01",
        "KEYRA_01",
        "ZAHEER_01",
        "SIGURD_01",
        "OPHELIA_01"
      ],
      "Self (Summons Allies)": [
        "XANA_01",
        "MORGANA_01"
      ],
      "All Troops": [
        "HARKON_01",
        "CALYRA_01",
        "ATREYA_01",
        "REMUS_01",
        "TRISTAN_01",
        "DURAND_01",
        "BUMI_01",
        "LIREAL_01"
      ],
      "All Troops (Utility)": [
        "BRUTALLUS_01"
      ],
      "Enemy Control (Debuff)": [
        "MALIUM_01",
        "MORGRANE_01"
      ],
      "Undead Troops": [
        "DRAKE_01",
        "BONE_DRAGON_01"
      ],
      "Human Troops": [
        "DRAGON_RIDER_01"
      ],
      "Economy / Utility (Gold Generation)": [
        "BARON_BENUA_01"
      ]
    },
    "troopsByGearRoleFamily": {
      "_comment": "roleFamily is how gearData.js decides which real weapon/armor a troop should equip. 'Tank' and 'Trickster' currently have confirmed real gear (Devourment set, Mirage set); Mage/Ranger/Support/Aerial troops fall back to the flavor-name optimalGear placeholder in troops.js until more gear is captured.",
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
      "Trickster": [
        "tr-assassins",
        "tr-storm-mistresses",
        "tr-gravedigger",
        "tr-night-hunter",
        "tr-axe-throwers"
      ],
      "Ranger": [
        "tr-magic-archer",
        "tr-cursed-catapult",
        "tr-imp",
        "tr-pyrotechnician"
      ],
      "Support": [
        "tr-alchemist",
        "tr-shaman",
        "tr-necromancer"
      ]
    },
    "heroesByGearRoleFamily": {
      "_comment": "Same roleFamily logic applied to heroes' own combat type (not the troops they buff). A hero's gearRoleFamily governs what real gear maximizes the HERO directly; use recommendedTroops + troopsByGearRoleFamily to find gear for the troops that hero buffs.",
      "Mage": [
        "ANAVIN_01",
        "EDELINA_01",
        "KEYRA_01",
        "ZAHEER_01",
        "SIGURD_01",
        "OPHELIA_01",
        "LIREAL_01"
      ],
      "Tank": [
        "REMUS_01"
      ],
      "Ranger": [
        "ATREYA_01",
        "DRAGON_RIDER_01"
      ],
      "Support": [
        "XANA_01",
        "HARKON_01",
        "BRUTALLUS_01",
        "CALYRA_01",
        "MALIUM_01",
        "TRISTAN_01",
        "MORGRANE_01",
        "DURAND_01",
        "BUMI_01",
        "DRAKE_01",
        "BONE_DRAGON_01",
        "MORGANA_01",
        "BARON_BENUA_01"
      ]
    }
  },
  "gearCatalogSummary": {
    "_comment": "Real gear only — mirrors gearData.js gearCatalog. Full passive scaling tables (level 1-10) and the mastery bonus formula live in gearData.js; this is a lightweight cross-reference so synergies.js can name real gear without re-deriving it.",
    "confirmedGear": [
      {
        "id": "gear-hammer-of-devourment",
        "name": "Hammer of Devourment",
        "slot": "Weapon",
        "rarity": "legendary",
        "roleFamily": "Tank",
        "passiveSummary": "After the Tank takes reflected damage, its next basic attack (and that of units behind it) deals bonus damage. Bonus damage scales from 1.60% at level 1 up to 6.30% at level 10."
      },
      {
        "id": "gear-armor-of-devourment",
        "name": "Armor of Devourment",
        "slot": "Armor",
        "rarity": "legendary",
        "roleFamily": "Tank",
        "passiveSummary": "Tanks and units behind them take less reflected damage. Reduction scales from 4.00% at level 1 up to 16.00% at level 10.",
        "pairsWith": "gear-hammer-of-devourment"
      },
      {
        "id": "gear-mirage-glaive",
        "name": "Mirage Glaive",
        "slot": "Weapon",
        "rarity": "legendary",
        "roleFamily": "Trickster",
        "passiveSummary": "After a Trickster evades an AOE attack, its next basic attack deals bonus damage. Bonus damage scales from 6.30% at level 1 up to 25.20% at level 10."
      },
      {
        "id": "gear-mirage-garment",
        "name": "Mirage Garment",
        "slot": "Armor",
        "rarity": "legendary",
        "roleFamily": "Trickster",
        "passiveSummary": "Tricksters gain a chance to evade basic AOE attacks entirely. Evasion chance scales from 2.00% at level 1 up to 7.20% at level 10.",
        "pairsWith": "gear-mirage-glaive"
      }
    ],
    "gapsAwaitingData": [
      "Mage weapon/armor (would benefit Anavin, Edelina, Keyra, Zaheer, Sigurd, Ophelia, Lirael and their Mage troop synergies)",
      "Ranger weapon/armor (would benefit Dragon Rider, Atreya and Ranger troops like Magic Archer, Axe Throwers, Pyrotechnician)",
      "Support weapon/armor (would benefit Durand, Tristan, Calyra and Support troops like Alchemist, Shaman, Necromancer)",
      "Aerial-specific gear (Phoenix, Imp currently fall under Tank/Ranger gearRoleFamily by their type, not a dedicated Aerial gear line)"
    ]
  },
  "formations": [
    {
      "id": "formation-human-tank-wall",
      "name": "Human Tank Wall",
      "faction": "Human",
      "description": "A Human-faction frontline built to soak damage with two Frontline tanks, backed by ranged DPS and a healer, then amplified by Human-focused hero buffs.",
      "composition": {
        "frontline": [
          "Bonebreaker",
          "Monk"
        ],
        "backline": [
          "Axe Throwers",
          "Pyrotechnician"
        ],
        "support": [
          "Alchemist"
        ]
      },
      "recommendedHeroes": [
        "Dragon Rider",
        "Durand",
        "Tristan"
      ],
      "synergyCategories": [
        "Human",
        "Tank",
        "Frontline",
        "High-HP"
      ],
      "reasoning": "Bonebreaker and Monk both carry combatLine \"Frontline\" and synergyCategories including \"Human\"/\"Tank\", matching Dragon Rider's supportFocus of \"Human Troops\" (attack buff) and Durand/Tristan's \"All Troops\" buffs — the frontline absorbs hits while Axe Throwers and Pyrotechnician deal Backline-DPS damage behind it.",
      "recommendedGear": "Equip Bonebreaker and Monk with the Devourment Set (Hammer of Devourment + Armor of Devourment). Armor of Devourment cuts the reflected damage this frontline takes; Hammer of Devourment then turns any reflected damage it does take into bonus damage on the tank's (and the units behind it's) next basic attack — see gearData.js gearCatalog for full level-by-level scaling."
    },
    {
      "id": "formation-mage-backline-bombardment",
      "name": "Mage Backline Bombardment",
      "faction": "Mages",
      "description": "A Mage-faction backline of ranged casters shielded by a Mage tank, stacking every available Mage-troop attack/HP buff.",
      "composition": {
        "frontline": [
          "Lava Golem"
        ],
        "backline": [
          "Magic Archer",
          "Shaman"
        ]
      },
      "recommendedHeroes": [
        "Anavin",
        "Edelina",
        "Keyra",
        "Zaheer",
        "Sigurd",
        "Ophelia",
        "Lirael"
      ],
      "synergyCategories": [
        "Mages",
        "Ranger",
        "Backline",
        "AoE"
      ],
      "reasoning": "Magic Archer and Shaman both resolve to combatLine \"Backline\" with synergyCategories tagging \"Mages\"/\"Backline-DPS\". Every listed hero except Lirael has supportFocus \"Mage Troops\", so their attack/HP/defense buffs stack directly onto this backline, while Lava Golem (Frontline) tanks hits so the casters stay alive to output damage. Lirael's supportFocus is \"All Troops\" (Song of Courage hits All Allies), but her troop-count-scaling passive and attack/damage-reduction ability still buff this same lineup, adding army-wide burst windows on top of the faction-locked stacking."
    },
    {
      "id": "formation-undead-endless-swarm",
      "name": "Undead Endless Swarm",
      "faction": "Undead",
      "description": "An Undead-faction attrition composition: a Frontline wall of tanky Undead, Midline tricksters harassing flanks, and a Backline summoner replenishing bodies.",
      "composition": {
        "frontline": [
          "Immortal",
          "Headless",
          "Steel Revenant"
        ],
        "midline": [
          "Night Hunter",
          "Gravedigger"
        ],
        "backline": [
          "Necromancer",
          "Cursed Catapult"
        ]
      },
      "recommendedHeroes": [
        "Drake",
        "Bone Dragon",
        "Morgrane",
        "Morgana"
      ],
      "synergyCategories": [
        "Undead",
        "Tank",
        "Frontline",
        "Summoner"
      ],
      "reasoning": "Immortal, Headless, and Steel Revenant all share combatLine \"Frontline\" and the \"Undead\"/\"Tank\" synergyCategories. Drake and Bone Dragon both carry supportFocus \"Undead Troops\" (attack buff), directly scaling this wall, while Morgrane and Morgana add Enemy Control and Ally Summons (per their supportFocus extras) to keep Necromancer's skeleton-summon backline continuously reinforced.",
      "recommendedGear": "Equip the Devourment Set (Hammer of Devourment + Armor of Devourment) on Immortal, Headless, or Steel Revenant — Steel Revenant is the strongest fit since its own troop ability already reflects damage back at attackers, so Armor of Devourment's reflected-damage reduction stacks with its native kit while Hammer of Devourment converts remaining reflect exposure into offense."
    },
    {
      "id": "formation-aerial-strike-force",
      "name": "Aerial Strike Force",
      "faction": "Mixed",
      "description": "A niche cross-faction comp built entirely around the two Aerial-combatLine troops in the roster, bypassing melee chokepoints.",
      "composition": {
        "aerial": [
          "Phoenix",
          "Imp"
        ]
      },
      "recommendedHeroes": [
        "Anavin",
        "Drake",
        "Remus"
      ],
      "synergyCategories": [
        "Aerial",
        "Mixed-Faction",
        "Backline-DPS"
      ],
      "reasoning": "Phoenix (Mages) and Imp (Undead) are the only two troops with combatLine \"Aerial\" in the dataset. Because they span two factions, no single-faction buffer covers both — Anavin covers Phoenix (supportFocus \"Mage Troops\"), Drake covers Imp (supportFocus \"Undead Troops\"), and Remus's \"All Troops\" buff is the one hero that benefits both simultaneously."
    },
    {
      "id": "formation-faction-agnostic-support-core",
      "name": "Faction-Agnostic Support Core",
      "faction": "Mixed",
      "description": "Not a troop lineup but a hero backbone: every hero whose supportFocus resolves to \"All Troops\" can be slotted behind literally any of the three faction formations above without losing value.",
      "composition": {},
      "recommendedHeroes": [
        "Calyra",
        "Atreya",
        "Remus",
        "Tristan",
        "Harkon",
        "Bumi",
        "Durand"
      ],
      "synergyCategories": [
        "All Troops",
        "Support",
        "Faction-Agnostic"
      ],
      "reasoning": "These heroes all resolved to a primary supportFocus of \"All Troops\" because their talent/ability targets field is literally [\"All Allies\"], rather than a faction-specific type like \"Mage\" or \"Undead\". That makes them safe defaults when the router cannot confidently resolve which faction formation a request is about."
    }
  ]
};

module.exports = synergies;
