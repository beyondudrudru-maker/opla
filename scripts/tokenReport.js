/**
 * scripts/tokenReport.js — measures GameData payload size, BEFORE (raw records) vs AFTER (sliced).
 * Run: node scripts/tokenReport.js   (adjust the two require paths to your tree)
 * ~4 chars ≈ 1 token (rough). Real token counts: log usageMetadata from Gemini.
 */
const heroes = require('../data/heroes.js');
const troops = require('../data/troops.js');
const bosses = require('../data/bosses.js');
const slicer = require('../engine/contextSlicer.js');
const { deepCompress, compressGameData } = require('../promptBuilder/promptAssembler.js');

const S = (o) => JSON.stringify(deepCompress(compressGameData(o))).length;
const byName = (list, n) => list.find(x => x.name.toLowerCase().includes(n.toLowerCase()));
const bossList = Array.isArray(bosses) ? bosses : Object.values(bosses);
const rows = [];
const row = (label, before, after) => rows.push({ query: label, before, after, saved: `${Math.round((1 - after / before) * 100)}%`, '~tokens after': Math.round(after / 4) });

for (const h of heroes) {
  const recT = (h.recommendedTroops || []).map(n => byName(troops, n)).filter(Boolean);
  const before = S({ recognizedHero: h, mentionedHeroes: [h], synergyCandidates: [{ target: h, recommendedTroops: recT }] });
  const after = S({ mentionedHeroes: [slicer.sliceHero(h)], synergyCandidates: [slicer.sliceSynergy({ entityType: 'hero', entity: h, recommendedHeroes: [], recommendedTroops: recT })] });
  row(`synergy: ${h.name}`, before, after);
}
for (const t of troops) row(`troop L10: ${t.name}`, S({ troop: t }), S({ troop: slicer.sliceTroop(t) }));
for (const b of bossList) row(`boss: ${b.name}`, S({ bossRecords: [b] }), S({ bossRecords: [slicer.sliceBoss(b)] }));
console.table(rows);
const tot = rows.reduce((a, r) => ({ b: a.b + r.before, a: a.a + r.after }), { b: 0, a: 0 });
console.log(`TOTAL before=${tot.b} after=${tot.a} saved=${Math.round((1 - tot.a / tot.b) * 100)}%`);
