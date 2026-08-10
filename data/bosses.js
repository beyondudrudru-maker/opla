/**
 * MELODY Game Knowledge Library — Bosses
 * Boss kits and fight strategy notes, enriched with strict hero/troop roster rules.
 */

const bossRosterWarning = "\n\n[UNIVERSAL BOSS ROSTER & WARNING]: Do NOT use Harkon. His talent is disabled in boss battles. Recommended Heroes: Lireal, Calyra, Remus, Tristan, Anavin, Drake, Dragon Rider, Bone Dragon. Recommended Troops: Imp, Alchemist, Bone Breaker, Headless, Storm Mistress, Assassin, Bone Thrower, Archer, Paladin, Axe Thrower.";

const bosses = [
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
    "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Kalidor has 30% Ranged Protection. Use high HP melee/tanks and heavy healers to survive the massive 6000 DMG Explosive Spear." + bossRosterWarning
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
    "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Balthazar has 30% Melee Protection. Rely heavily on Ranged units for your primary DPS. Bring strong healers to sustain your troops through his massive, battlefield-wide AoE attacks like Fury from the Deep." + bossRosterWarning
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
    "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Ashira has 30% Ranged Protection, so you should prioritize **Melee units** for your primary DPS. However, be careful—her **Chitin Carapace** reflects 20% of basic attack damage back at your melee units, so bring heavy healers or shield-bearers to keep your frontline alive against both the reflected damage and the constant swarms of explosive spiders!" + bossRosterWarning
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
    "strategy": "1. Season lasts 3 days. 3 tries per day.\n\n2. Top players formed by total damage dealt over the season.\n\n3. Earn coins based on damage dealt.\n\n4. Boss power increases every 30 seconds of battle.\n\n5. Demo battles don't waste attempts but earn no gold.\n\n[TACTIC]: Dagon has 30% Ranged Protection, so rely heavily on your strongest Melee/Tank units. Be extremely vigilant with the Hungry Jaws mechanic—keep your finger ready on the ship's cannon to interrupt him and save your 15 units. High-health troops are required to survive the massive 18,000 DMG Tentacle Smash!\n\n[KRAKEN BOSS MAX SCORE TIMINGS]: Turn OFF Auto Hero Ability! Place Bone Dragon at the RIGHT of the formation. Target Timings: Minute 4 (4:51 Mouth, 4:39 Barrel, 4:24 Tentacles, 4:13 Barrel, 4:03 Tentacles), Minute 3 (3:40 Tentacles, 3:21 Tentacles, 3:10 Mouth, 3:00 Tentacles), Minute 2 (2:37 Tentacles, 2:18 Tentacles, 2:07 Mouth), Minute 1 (1:56 Tentacles, 1:34 Tentacles, 1:15 Tentacles, 1:04 Mouth), Minute 0 (0:54 Tentacles, 0:31 Tentacles, 0:21 Mouth, 0:11 Tentacles)." + bossRosterWarning
  }
];

module.exports = bosses;
