/**
 * data/gearData.js
 * 
 * PURPOSE: The definitive catalog of actual, real-world gear in Kingdom Clash.
 * Removed all theoretical/fake placeholders. Only includes 100% verified gear.
 */

// ---------------------------------------------------------------------
// 1. Ownership Bonus (Confirmed via in-game screenshots)
// "Each new item level increases this bonus by 🔥0.20%"
// Affects HP, Basic attack power, and abilities of your units.
// ---------------------------------------------------------------------
const OWNERSHIP_BONUS_RATE_PER_LEVEL = 0.20;

function getOwnershipBonus(level) {
  return parseFloat((level * OWNERSHIP_BONUS_RATE_PER_LEVEL).toFixed(2));
}

// ---------------------------------------------------------------------
// 2. Weapon/Armor Slot Bonus (Equip screen bonus)
// ---------------------------------------------------------------------
const WEAPON_ARMOR_BONUS_OBSERVED = [
  { slot: "Weapon", gearId: "gear-hammer-of-devourment", gearLevel: 21, observedBonusPercent: 7.40 },
  { slot: "Armor", gearId: "gear-armor-of-devourment", gearLevel: 19, observedBonusPercent: 7.60 }
];

// ---------------------------------------------------------------------
// 3. Real Gear Catalog (Strictly Devourment and Mirage sets)
// ---------------------------------------------------------------------
const gearCatalog = [
  {
    id: "gear-hammer-of-devourment",
    name: "Hammer of Devourment",
    slot: "Weapon",
    rarity: "legendary",
    roleFamily: "Tank",
    ownershipStatus: "owned",
    passive: {
      name: "Devourment (Weapon)",
      trigger: "After receiving the reflected damage",
      effect: "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        damageIncreasePercent: [1.60, 2.00, 2.30, 2.60, 3.00, 3.30, 3.70, 4.00, 4.40, 6.30, 12.10, 12.60, 13.10, 13.70, 14.20, 14.90, 15.60, 16.30, 17.00, 19.40]
      }
    }
  },
  {
    id: "gear-armor-of-devourment",
    name: "Armor of Devourment",
    slot: "Armor",
    rarity: "legendary",
    roleFamily: "Tank",
    ownershipStatus: "owned",
    passive: {
      name: "Devourment (Armor)",
      trigger: "Passive, always active while equipped",
      effect: "Tanks grant defence in amount of X% reflected damage to themselves and units standing behind them.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        reflectedDamageDecreasePercent: [4.00, 5.00, 6.00, 6.80, 7.70, 8.50, 9.50, 10.40, 11.30, 16.00, 24.30, 29.70, 31.10, 32.40, 33.80, 35.10, 36.50, 38.30, 40.10, 41.90, 43.70]
      }
    }
  },
  {
    id: "gear-mirage-glaive",
    name: "Mirage Glaive",
    slot: "Weapon",
    rarity: "legendary",
    roleFamily: "Trickster",
    ownershipStatus: "locked",
    passive: {
      name: "Mirage (Weapon)",
      trigger: "After evading AOE attack",
      effect: "Next basic Trickster's attack deals additional damage.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
        damageIncreasePercent: [6.30, 7.70, 9.10, 10.50, 11.90, 13.30, 14.70, 16.10, 17.50, 25.20, 33.60, 35.00, 36.40, 37.80, 46.20, 48.30, 50.40, 52.50, 54.60, 56.70, 59.50]
      }
    }
  },
  {
    id: "gear-mirage-garment",
    name: "Mirage Garment",
    slot: "Armor",
    rarity: "legendary",
    roleFamily: "Trickster",
    ownershipStatus: "locked",
    passive: {
      name: "Mirage (Armor)",
      trigger: "Passive, always active while equipped",
      effect: "Tricksters have a chance to evade basic AOE attacks.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        evasionChancePercent: [2.00, 2.30, 2.60, 2.90, 3.50, 3.80, 4.20, 4.60, 5.00, 7.20, 10.80, 13.20, 13.80, 14.40, 15.00, 15.60, 16.20, 17.00, 17.80, 18.60, 19.40]
      }
    }
  }
];

// ---------------------------------------------------------------------
// 4. Curated Gear Sets
// ---------------------------------------------------------------------
const gearSets = [
  {
    id: "set-devourment",
    name: "Devourment Set",
    pieces: ["gear-hammer-of-devourment", "gear-armor-of-devourment"],
    roleFamily: "Tank",
    synergy: "Armor reduces reflected damage taken by Tanks and units behind them; Hammer uses that reflected damage to buff their next attack. Perfectly turns enemy reflect into your own damage."
  },
  {
    id: "set-mirage",
    name: "Mirage Set",
    pieces: ["gear-mirage-glaive", "gear-mirage-garment"],
    roleFamily: "Trickster",
    synergy: "Armor gives evasion against AOE; Weapon rewards evasion with massive bonus damage. Highly synergistic for midline Tricksters surviving AOE bursts."
  }
];

// ---------------------------------------------------------------------
// 5. Sync Helpers (Only matching valid role families now)
// ---------------------------------------------------------------------
function recommendGearForTroop(troop) {
  const roleFamily = troop.type === "Tank" ? "Tank" : (troop.tags || []).includes("Trickster") ? "Trickster" : null;
  if (!roleFamily) return [];
  return gearCatalog.filter(g => g.roleFamily === roleFamily);
}

module.exports = {
  OWNERSHIP_BONUS_RATE_PER_LEVEL,
  getOwnershipBonus,
  gearCatalog,
  gearSets,
  recommendGearForTroop
};
