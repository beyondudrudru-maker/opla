/**
 * MELODY Game Knowledge Library — Gear
 * Real weapon/armor data (as opposed to the flavor-name placeholders
 * still living in heroes.js/troops.js optimalGear.weapons/armors).
 *
 * WHY THIS FILE EXISTS
 * ────────────────────────────────────────────────────────
 * heroes.js and troops.js each carry an `optimalGear` block, but those
 * weapon/armor names were generated from a faction+role naming template
 * before any real gear existed in the source data. This file is the real
 * layer: actual gear pieces (name, slot, passive ability, per-level
 * scaling table, which unit-role family they're built for) plus a sync
 * layer that maps every hero/troop onto the gear that maximizes them,
 * without needing to touch the existing placeholder fields.
 *
 * THREE SEPARATE BONUS TRACKS (confirmed via screenshots — do not conflate)
 * ────────────────────────────────────────────────────────
 *  1. Passive ability scaling — the gear's actual combat effect
 *     (e.g. Hammer of Devourment's "+X% damage after reflect" table).
 *     Lives in gearCatalog[].passive.scaling. This is what makes the gear
 *     do something in a fight.
 *  2. Mastery bonus ("Mastery bonus: 🔥+X.XX%") — a flat account-wide
 *     stat-boost shown on the gear detail/passive-ability screen.
 *     Formula requested: legendary 1%/lvl (cap 10%), epic 0.5%/lvl
 *     (cap 5%), mythical 2%/lvl (cap 20%). See MASTERY_BONUS_RATES.
 *  3. Weapon/Armor bonus ("Weapon bonus: 🔥+7.40%" / "Armor bonus:
 *     🔥+7.60%") — a DIFFERENT flat stat-boost shown on the equip/loadout
 *     screen, scoped per-slot (all weapons combined, all armors combined)
 *     rather than per single gear piece. Confirmed different from #2
 *     because the same gear at the same level shows both numbers
 *     simultaneously in different screens (Hammer of Devourment lvl 21:
 *     Mastery +4.20% on the passive-ability screen, Weapon bonus +7.40%
 *     on the equip screen). See WEAPON_ARMOR_BONUS_OBSERVED.
 *
 * GEAR ACQUISITION & OWNERSHIP (confirmed via screenshots)
 * ────────────────────────────────────────────────────────
 * Gear is obtained from a spin wheel (gacha), not crafted directly.
 * Leveling a piece consumes gear fragments, with a specific fragment
 * requirement per level (e.g. lvl 21→22 needs 132 fragments, currently
 * holding 8; lvl 19→20 needs 102, currently holding 69 on the equipped
 * piece and 36 on a locked alternate of the same slot). Only pieces
 * you've actually pulled/obtained are usable — right now that's ONLY the
 * Devourment set (Hammer + Armor). The Mirage set exists in the catalog
 * but is LOCKED/not-yet-obtained. See ownershipStatus on each gearCatalog
 * entry and OWNED_GEAR_IDS below.
 *
 * DYNAMIC EQUIP LOGIC (per your clarification: "it works as per situation
 * and troops and hero which are in formation")
 * ────────────────────────────────────────────────────────
 * Gear is not permanently bound to one hero. It should be recommended
 * for whichever Tank/Trickster unit is actually slotted into the CURRENT
 * formation being discussed, and swapped as the formation changes. See
 * recommendGearForFormation() — this is the primary entry point Melody
 * should call, not a static per-hero assignment.
 *
 * SCHEMA
 * ────────────────────────────────────────────────────────
 *  gearCatalog[]
 *    - id, name, slot ("Weapon"|"Armor")
 *    - rarity: "epic" | "legendary" | "mythical"
 *    - roleFamily: which combat role this gear is designed around
 *        ("Tank", "Trickster", "Mage", "Ranger", "Support", "Aerial")
 *    - ownershipStatus: "owned" | "locked" — whether this account has
 *        actually obtained the piece from the spin wheel yet.
 *    - passive: { trigger, effect, appliesTo, scaling: {level:[], value:[]} }
 *    - masteryBonus: rarity-derived formula + observed screenshot value
 *    - weaponOrArmorBonus: observed slot-wide bonus + gear level it was
 *        observed at (see caveat above — no verified formula yet)
 *    - leveling: fragment cost/held observed at the screenshot's level
 *    - bestFor: which troop combat lines / hero support focuses benefit
 *
 *  MASTERY_BONUS_RATES / getMasteryBonus() / verifyMasteryBonus()
 *    Flat per-rarity mastery bonus-per-level table you specified. See
 *    the discrepancy note inside verifyMasteryBonus() — real screenshot
 *    values at gear levels 16-21 don't match a flat formula capped at
 *    level 10, so this formula should be treated as your requested
 *    target model, not a confirmed live formula, until more per-level
 *    data points are captured.
 *
 *  roleFamilyToWeaponType / roleFamilyToArmorType
 *    The naming-template map already implicit in heroes.js/troops.js
 *    optimalGear (Grimoire/Sigil Staff = Mage, Warhammer/Bulwark Mace =
 *    Tank, Longbow/War Crossbow = Ranger, Scepter/Ritual Wand = Support,
 *    Twin Daggers/Serrated Kris = Trickster, Talons/Wingblades = Aerial).
 *    Exposed so recommendGearFor() can explain *why* a placeholder name
 *    was chosen, tying the two layers together.
 */

// ---------------------------------------------------------------------
// 1. Mastery bonus formula (rarity-based, from your screenshots)
// ---------------------------------------------------------------------

const MASTERY_BONUS_RATES = {
  epic: { ratePerLevel: 0.50, capLevel: 10, capPercent: 5.00 },
  legendary: { ratePerLevel: 1.00, capLevel: 10, capPercent: 10.00 },
  mythical: { ratePerLevel: 2.00, capLevel: 10, capPercent: 20.00 }
};

/**
 * Returns the mastery/collection bonus (%) for a piece of gear at a given
 * level, based on its rarity tier.
 * @param {"epic"|"legendary"|"mythical"} rarity
 * @param {number} level - gear level (1-10 typical range)
 * @returns {number} bonus percent, capped at the rarity's ceiling
 */
function getMasteryBonus(rarity, level) {
  const tier = MASTERY_BONUS_RATES[rarity];
  if (!tier) throw new Error(`Unknown gear rarity: ${rarity}`);
  const raw = tier.ratePerLevel * level;
  return Math.min(raw, tier.capPercent);
}

/**
 * Cross-check against the 4 real screenshot data points:
 *   Hammer of Devourment (legendary, lvl 21) -> Mastery bonus +4.20%
 *   Mirage Glaive         (legendary, lvl 16) -> Mastery bonus +3.20%
 *   Armor of Devourment    (legendary, lvl 19) -> Mastery bonus +3.80%
 *   Mirage Garment          (legendary, lvl 19) -> Mastery bonus +3.80%
 * NOTE: these in-game levels (16-21) exceed the 10-level cap table you
 * gave (1%/lvl legendary, max 10%). The observed bonuses (3.20%-4.20%)
 * don't match a flat 1%/lvl formula run out to level 16-21 (which would
 * already be capped at 10%). This means the actual in-game curve is NOT
 * linear-then-capped the way you described — it's closer to a much
 * flatter per-level increment at these higher levels. This function
 * documents the discrepancy rather than silently papering over it.
 */
function verifyMasteryBonus() {
  const observed = [
    { name: "Hammer of Devourment", rarity: "legendary", gearLevel: 21, observedBonus: 4.20 },
    { name: "Mirage Glaive", rarity: "legendary", gearLevel: 16, observedBonus: 3.20 },
    { name: "Armor of Devourment", rarity: "legendary", gearLevel: 19, observedBonus: 3.80 },
    { name: "Mirage Garment", rarity: "legendary", gearLevel: 19, observedBonus: 3.80 }
  ];
  return observed.map(o => {
    const predicted = getMasteryBonus(o.rarity, o.gearLevel);
    return {
      ...o,
      predictedByFlatFormula: predicted,
      matches: Math.abs(predicted - o.observedBonus) < 0.01,
      discrepancyNote:
        predicted !== o.observedBonus
          ? "Screenshot bonus does not match a flat 1%/level-capped-at-10 formula at this gear level. Treat MASTERY_BONUS_RATES as the requested target formula for levels 1-10, and observed screenshot values as real high-level reference points until more level-by-level mastery data is captured."
          : null
    };
  });
}

// ---------------------------------------------------------------------
// 1b. Weapon/Armor bonus (slot-wide equip-screen stat — separate track
//     from Mastery bonus, see header note). Only 2 observed data points
//     exist so far — one per slot — both at the ONE gear piece currently
//     owned per slot. No verified per-level formula yet; ratios noted for
//     future cross-checking once more levels/pieces are observed.
// ---------------------------------------------------------------------

const WEAPON_ARMOR_BONUS_OBSERVED = [
  {
    slot: "Weapon",
    gearId: "gear-hammer-of-devourment",
    gearLevel: 21,
    observedBonusPercent: 7.40,
    impliedRatePerLevelIfLinear: 7.40 / 21
  },
  {
    slot: "Armor",
    gearId: "gear-armor-of-devourment",
    gearLevel: 19,
    observedBonusPercent: 7.60,
    impliedRatePerLevelIfLinear: 7.60 / 19
  }
];

// ---------------------------------------------------------------------
// 1c. Ownership — only gear actually pulled from the spin wheel is
//     equippable. Confirmed: Devourment set owned, Mirage set locked.
// ---------------------------------------------------------------------

const OWNED_GEAR_IDS = [
  "gear-hammer-of-devourment",
  "gear-armor-of-devourment"
];

//    (already implicit in heroes.js / troops.js optimalGear naming)
// ---------------------------------------------------------------------

const roleFamilyToWeaponType = {
  Mage: ["Grimoire", "Sigil Staff"],
  Tank: ["Warhammer", "Bulwark Mace"],
  Ranger: ["Longbow", "War Crossbow"],
  Support: ["Scepter", "Ritual Wand"],
  Trickster: ["Twin Daggers", "Serrated Kris"],
  Aerial: ["Talons", "Wingblades"]
};

const roleFamilyToArmorType = {
  Mage: ["Runeweave Robes", "Arcane Mantle"],
  Tank: ["Plate", "Bastion Aegis"],
  Ranger: ["Leathers", "Skirmish Cloak"],
  Support: ["Vestments", "Ward Cloak"],
  Trickster: ["Stalker Garb", "Shadow Wraps"],
  Aerial: ["Windrider Harness", "Scale Mail"]
};

// ---------------------------------------------------------------------
// 3. Gear catalog — real pieces from your screenshots
//    Passive scaling tables are transcribed level-by-level where visible
//    (levels 1-10 fully readable in each screenshot; level 11 partially
//    cut off in every image, so it is omitted rather than guessed).
// ---------------------------------------------------------------------

const gearCatalog = [
  {
    id: "gear-hammer-of-devourment",
    name: "Hammer of Devourment",
    slot: "Weapon",
    rarity: "legendary",
    roleFamily: "Tank",
    observedGearLevel: 21,
    ownershipStatus: "owned",
    weaponOrArmorBonus: {
      observedAtGearLevel: 21,
      observedBonusPercent: 7.40,
      note: "Slot-wide 'Weapon bonus' shown on the equip screen — distinct from the per-piece Mastery bonus (+4.20% at the same level 21). See WEAPON_ARMOR_BONUS_OBSERVED."
    },
    leveling: {
      observedAtGearLevel: 21,
      fragmentsHeld: 8,
      fragmentsNeededForNextLevel: 132,
      note: "Fragments obtained via spin wheel. 8/132 held toward level 22 as of the screenshot."
    },
    passive: {
      name: "Devourment (Weapon)",
      trigger: "After the wielding Tank receives reflected damage",
      effect: "Next basic attack of your Tanks AND units standing behind them in the original formation deals additional damage.",
      appliesTo: ["Tank", "units behind Tank in formation"],
      conditions: "Bonus only applies while this gear is equipped.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        damageIncreasePercent: [1.60, 2.00, 2.30, 2.60, 3.00, 3.30, 3.70, 4.00, 4.40, 6.30]
      }
    },
    masteryBonus: {
      ratePerLevel: MASTERY_BONUS_RATES.legendary.ratePerLevel,
      capPercent: MASTERY_BONUS_RATES.legendary.capPercent,
      observedAtGearLevel21: 4.20
    },
    bestFor: {
      heroDescription: "Any hero whose troops lean on a Tank frontline that's expected to eat reflected/counter damage.",
      troopCombatLines: ["Frontline"]
    }
  },
  {
    id: "gear-mirage-glaive",
    name: "Mirage Glaive",
    slot: "Weapon",
    rarity: "legendary",
    roleFamily: "Trickster",
    observedGearLevel: 16,
    ownershipStatus: "locked",
    weaponOrArmorBonus: {
      observedAtGearLevel: null,
      observedBonusPercent: null,
      note: "Not equippable yet (locked/not obtained from spin wheel), so no equip-screen Weapon bonus has been observed for this piece."
    },
    leveling: {
      observedAtGearLevel: 16,
      fragmentsHeld: null,
      fragmentsNeededForNextLevel: null,
      note: "Fragment progress not observable while locked."
    },
    passive: {
      name: "Mirage (Weapon)",
      trigger: "After the wielding Trickster evades an AOE attack",
      effect: "Next basic Trickster attack deals additional damage.",
      appliesTo: ["Trickster"],
      conditions: "Bonus only applies while this gear is equipped.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        damageIncreasePercent: [6.30, 7.70, 9.10, 10.50, 11.90, 13.30, 14.70, 16.10, 17.50, 25.20]
      }
    },
    masteryBonus: {
      ratePerLevel: MASTERY_BONUS_RATES.legendary.ratePerLevel,
      capPercent: MASTERY_BONUS_RATES.legendary.capPercent,
      observedAtGearLevel16: 3.20
    },
    bestFor: {
      heroDescription: "Heroes that buff or field Midline Trickster troops relying on evasion to punish AOE-heavy enemy comps.",
      troopCombatLines: ["Midline"]
    }
  },
  {
    id: "gear-armor-of-devourment",
    name: "Armor of Devourment",
    slot: "Armor",
    rarity: "legendary",
    roleFamily: "Tank",
    observedGearLevel: 19,
    ownershipStatus: "owned",
    weaponOrArmorBonus: {
      observedAtGearLevel: 19,
      observedBonusPercent: 7.60,
      note: "Slot-wide 'Armor bonus' shown on the equip screen — distinct from the per-piece Mastery bonus (+3.80% at the same level 19). See WEAPON_ARMOR_BONUS_OBSERVED."
    },
    leveling: {
      observedAtGearLevel: 19,
      fragmentsHeld: 69,
      fragmentsNeededForNextLevel: 102,
      note: "Fragments obtained via spin wheel. 69/102 held toward level 20 (this is the equipped piece). A second, locked copy of a different armor at the same level 19 shows 36/102 — a separate, not-yet-equipped roll from the wheel."
    },
    passive: {
      name: "Devourment (Armor)",
      trigger: "Passive, always active while equipped",
      effect: "Tanks grant defense in the form of reduced reflected damage taken, to themselves AND units standing behind them in the original formation.",
      appliesTo: ["Tank", "units behind Tank in formation"],
      conditions: "Bonus only applies while this gear is equipped.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        reflectedDamageDecreasePercent: [4.00, 5.00, 6.00, 6.80, 7.70, 8.50, 9.50, 10.40, 11.30, 16.00]
      }
    },
    masteryBonus: {
      ratePerLevel: MASTERY_BONUS_RATES.legendary.ratePerLevel,
      capPercent: MASTERY_BONUS_RATES.legendary.capPercent,
      observedAtGearLevel19: 3.80
    },
    bestFor: {
      heroDescription: "Pairs directly with Hammer of Devourment (same passive family) for a full Tank frontline that both deals AND survives reflect-damage exchanges.",
      troopCombatLines: ["Frontline"]
    }
  },
  {
    id: "gear-mirage-garment",
    name: "Mirage Garment",
    slot: "Armor",
    rarity: "legendary",
    roleFamily: "Trickster",
    observedGearLevel: 19,
    ownershipStatus: "locked",
    weaponOrArmorBonus: {
      observedAtGearLevel: null,
      observedBonusPercent: null,
      note: "Not equippable yet (locked/not obtained from spin wheel), so no equip-screen Armor bonus has been observed for this piece."
    },
    leveling: {
      observedAtGearLevel: 19,
      fragmentsHeld: null,
      fragmentsNeededForNextLevel: null,
      note: "Fragment progress not observable while locked."
    },
    passive: {
      name: "Mirage (Armor)",
      trigger: "Passive, always active while equipped",
      effect: "Tricksters gain a chance to evade basic AOE attacks entirely.",
      appliesTo: ["Trickster"],
      conditions: "Bonus only applies while this gear is equipped.",
      scaling: {
        level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        evasionChancePercent: [2.00, 2.30, 2.60, 2.90, 3.50, 3.80, 4.20, 4.60, 5.00, 7.20]
      }
    },
    masteryBonus: {
      ratePerLevel: MASTERY_BONUS_RATES.legendary.ratePerLevel,
      capPercent: MASTERY_BONUS_RATES.legendary.capPercent,
      observedAtGearLevel19: 3.80
    },
    bestFor: {
      heroDescription: "Pairs directly with Mirage Glaive (same passive family) — the higher the evasion chance from this armor, the more often Mirage Glaive's bonus-damage proc triggers.",
      troopCombatLines: ["Midline"]
    }
  }
];

// ---------------------------------------------------------------------
// 4. Curated gear sets (weapon+armor pairs that share a passive family)
// ---------------------------------------------------------------------

const gearSets = [
  {
    id: "set-devourment",
    name: "Devourment Set",
    pieces: ["gear-hammer-of-devourment", "gear-armor-of-devourment"],
    roleFamily: "Tank",
    synergy: "Armor of Devourment reduces reflected damage taken by Tanks and the units behind them; Hammer of Devourment then spends that same reflected-damage trigger to buff the next basic attack of the same units. Equip both on a frontline Tank to turn incoming reflect damage into a net damage swing instead of a pure loss."
  },
  {
    id: "set-mirage",
    name: "Mirage Set",
    pieces: ["gear-mirage-glaive", "gear-mirage-garment"],
    roleFamily: "Trickster",
    synergy: "Mirage Garment raises the Trickster's chance to evade AOE attacks; Mirage Glaive rewards each evasion with bonus damage on the next basic attack. The two pieces compound — more evasion chance directly means more frequent damage procs — so they should be equipped together on any Midline Trickster expected to face AOE-heavy enemies."
  }
];

// ---------------------------------------------------------------------
// 5. Sync helpers — connect gearCatalog to heroes.js / troops.js
//    Pass in the already-loaded heroes/troops arrays; this file has no
//    hard dependency on them so it can't create a circular require.
// ---------------------------------------------------------------------

/**
 * Given a troop object (from troops.js), return the gear pieces from
 * gearCatalog that best fit it, based on roleFamily <-> troop type/tags
 * matching (Tank type -> roleFamily "Tank", Trickster tag -> "Trickster").
 * @param {object} troop - a single troop entry from troops.js
 * @returns {object[]} matching gearCatalog entries
 */
function recommendGearForTroop(troop) {
  const roleFamily =
    troop.type === "Tank" ? "Tank" :
    (troop.tags || []).includes("Trickster") ? "Trickster" :
    troop.type === "Ranger" ? "Ranger" :
    troop.type === "Support" ? "Support" :
    troop.combatLine === "Aerial" ? "Aerial" :
    null;

  if (!roleFamily) return [];
  return gearCatalog.filter(g => g.roleFamily === roleFamily);
}

/**
 * Given a hero object (from heroes.js), return gearCatalog pieces whose
 * roleFamily matches the troop types this hero's supportFocus targets —
 * i.e., gear that maximizes the troops this hero is meant to be paired
 * with, not gear for the hero's own combat type.
 * @param {object} hero - a single hero entry from heroes.js
 * @param {object[]} troops - full troops.js array, to resolve
 *   recommendedTroops names into troop objects
 * @returns {{forHeroRole: object[], forRecommendedTroops: object[]}}
 */
function recommendGearForHero(hero, troops) {
  const heroRoleFamily =
    hero.type === "Tank" ? "Tank" :
    hero.type === "Mage" ? "Mage" :
    hero.type === "Ranger" ? "Ranger" :
    (hero.type === "Support" || hero.type === "Controller" || hero.type === "Debuffer" || hero.type === "Healer" || hero.type === "Summoner" || hero.type === "Active") ? "Support" :
    null;

  const forHeroRole = heroRoleFamily
    ? gearCatalog.filter(g => g.roleFamily === heroRoleFamily)
    : [];

  const recommendedTroopObjs = (hero.recommendedTroops || [])
    .map(tName => troops.find(t => t.name === tName))
    .filter(Boolean);

  const forRecommendedTroops = recommendedTroopObjs.flatMap(recommendGearForTroop);

  return { forHeroRole, forRecommendedTroops: [...new Set(forRecommendedTroops)] };
}

/**
 * THE PRIMARY ENTRY POINT for gear questions. Gear is not permanently
 * bound to a hero — it should follow whichever Tank/Trickster unit is
 * actually slotted into the formation being discussed right now, and
 * only recommend gear that's actually owned (spin-wheel obtained).
 *
 * @param {object[]} formationTroops - troop objects (from troops.js)
 *   currently in the formation being discussed
 * @returns {object[]} one entry per troop that has a role-family match,
 *   containing the troop, its matching gear (owned + locked, clearly
 *   labeled), and a plain-language equip recommendation.
 */
function recommendGearForFormation(formationTroops) {
  return (formationTroops || []).map(troop => {
    const matches = recommendGearForTroop(troop);
    const owned = matches.filter(g => g.ownershipStatus === "owned");
    const locked = matches.filter(g => g.ownershipStatus === "locked");

    let recommendation;
    if (matches.length === 0) {
      recommendation = `No confirmed real gear exists yet for ${troop.name}'s role family.`;
    } else if (owned.length > 0) {
      const names = owned.map(g => g.name).join(" + ");
      recommendation = `${troop.name} is in the active formation and its role matches owned gear: equip ${names} on it now.`;
    } else {
      const names = locked.map(g => g.name).join(" + ");
      recommendation = `${troop.name}'s role matches ${names}, but that gear is still locked (not yet obtained from the spin wheel) — nothing equippable for this troop yet.`;
    }

    return { troop: troop.name, troopId: troop.id, owned, locked, recommendation };
  });
}

module.exports = {
  MASTERY_BONUS_RATES,
  getMasteryBonus,
  verifyMasteryBonus,
  WEAPON_ARMOR_BONUS_OBSERVED,
  OWNED_GEAR_IDS,
  roleFamilyToWeaponType,
  roleFamilyToArmorType,
  gearCatalog,
  gearSets,
  recommendGearForTroop,
  recommendGearForHero,
  recommendGearForFormation
};
