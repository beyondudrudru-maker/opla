/**
 * node scripts/validateFacetData.js
 * Prints every unit's compiled card summary + any data problems (missing job, wrong override ids, healer-claims...).
 * Run it after editing heroes.js / troops.js / data/facetOverrides.js.
 */
'use strict';
const F = require('../engine/facetStore.js');
const T = require('../data/troops.js');
const H = require('../data/heroes.js');
const issues = F.audit();
console.log(`Troops: ${T.length}   Heroes: ${H.length}`);
H.forEach(h => { const e = F.findEntity(h.id.replace(/_\d+$/, '')); if (!e) issues.push(`hero ${h.name}: facet store cannot find it by name`); });
T.forEach(t => { if (!F.findEntity(t.name)) issues.push(`troop ${t.name}: facet store cannot find it by name`); });
console.log(issues.length ? 'PROBLEMS:\n - ' + issues.join('\n - ') : 'No problems found.');
process.exitCode = issues.length ? 1 : 0;
