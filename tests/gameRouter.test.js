/**
 * tests/gameRouter.test.js
 * Run with: node tests/gameRouter.test.js
 *
 * Verifies the 12 required cases and, critically, that FACT/CALC/GOLD/GEM
 * cases resolve WITHOUT any AI context being produced (resolved: true).
 */

const assert = require('assert');
const { route } = require('../router/gameDomainRouter.js');
const { simulateHeroBonus } = require('../engine/heroBonusSimulator.js');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label} ${detail ? '— ' + detail : ''}`); }
}

// 1. Lava Golem Lv7 HP
{
  const r = route('How much HP does Lava Golem have at level 7?');
  check('1. Lava Golem Lv7 HP — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 2. Lava Golem Lv7 ability
{
  const r = route('What is Lava Golem level 7 ability?');
  check('2. Lava Golem Lv7 ability — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 3. Lava Golem Lv5 -> Lv9
{
  const r = route('Lava Golem HP from lvl 5 to lvl 9');
  check('3. Lava Golem Lv5->Lv9 — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 4. Immortal Lv1 -> Lv10
{
  const r = route('Immortal growth from lvl 1 to lvl 10');
  check('4. Immortal Lv1->Lv10 — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 5. 3 Lava Golem Lv7 vs 2 Immortal Lv7
{
  const r = route('3 Lava Golem lvl 7 vs 2 Immortal lvl 7');
  check('5. Squad compare — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 6. Lava Golem Lv7 + hypothetical 60% HP/Damage bonus
{
  const sim = simulateHeroBonus({ troopName: 'Lava Golem', level: 7, hpBonusPct: 60, damageBonusPct: 60 });
  check('6. Hero bonus sim labeled hypothetical', !sim.error && /hypothetical/i.test(sim.disclaimer), JSON.stringify(sim));
  console.log('   sim:', sim);
}

// 7. "Which mage buffs HP?" (category -> strategy context, needs AI)
{
  const r = route('Which mage buffs HP?');
  check('7. Category buff question -> needs AI context', r.resolved === false && !!r.context, JSON.stringify(r));
}

// 8. "Is Lava Golem Lv7 good?" (strategy, needs AI, compact context only)
{
  const r = route('Is Lava Golem Lv7 good?');
  check('8. Strategy question -> compact AI context (no full gameLibrary)', r.resolved === false && r.context && !r.context.troops, JSON.stringify(r));
  console.log('   context keys:', r.context ? Object.keys(r.context) : null);
}

// 9. "What is the gold ratio?"
{
  const r = route('What is the gold ratio?');
  check('9. Gold ratio — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 10. "How should I spend 100000 gold?"
{
  const r = route('How should I spend 100000 gold?');
  check('10. Gold allocation — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 11. "What is the gem ratio?"
{
  const r = route('What is the gem ratio?');
  check('11. Gem ratio — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

// 12. "How should I spend 5000 gems?"
{
  const r = route('How should I spend 5000 gems?');
  check('12. Gem allocation — resolved without AI', r.resolved === true, JSON.stringify(r));
  console.log('   reply:', r.reply);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
