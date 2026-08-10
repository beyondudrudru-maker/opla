/**
 * MELODY Game Knowledge Library — Formulas
 * Power calculation formulas and lookup tables.
 */
const formulas = {
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
};

module.exports = formulas;
