/**
 * commands/eventState.js
 * Silent state cron: NEVER sends a Discord message. Updates global.activeEvent / global.activeBoss.
 * Event is derived live from the IST weekday, so a missed cron (host sleep) can't leave stale state.
 */
'use strict';
const cron = require('node-cron');
const bossCommand = require('./bossCommand');

const TZ = 'Asia/Kolkata';
const DAY_EVENT = {
    Mon: { event: 'Glorious Boss Hunt', kind: 'boss' },
    Tue: { event: 'Glorious Boss Hunt', kind: 'boss' },
    Wed: { event: 'Glorious Boss Hunt', kind: 'boss' },
    Thu: { event: 'Clan Clash Prep Day', kind: 'prep' },
    Fri: { event: 'Clan Clash PvP', kind: 'pvp' },
    Sat: { event: 'Clan Clash PvP', kind: 'pvp' },
    Sun: { event: 'Clan Clash PvP', kind: 'pvp' }
};

const istDay = () => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date());

async function resolve() {
    const day = istDay();
    const { event, kind } = DAY_EVENT[day];
    // Always re-read the boss (rotation / fresh manual set / DB) so a stale value can't survive a season change.
    await bossCommand.refreshCurrentBoss().catch(() => {});
    const boss = bossCommand.getCurrentBoss();
    global.activeEvent = event;
    global.activeBoss = boss ? { id: boss.id, name: boss.name, tier: boss.tier } : null;
    return { day, event, kind, boss };
}

function start() {
    const run = () => resolve()
        .then(s => console.log(`🧭 [EVENT STATE] ${s.day} -> ${s.event}${s.boss ? ` | boss: ${s.boss.name}` : ''}`))
        .catch(e => console.warn('⚠️ [EVENT STATE]', e.message));
    run();
    cron.schedule('5 0 * * *', run, { timezone: TZ });
    console.log('🧭 Silent event-state cron started (00:05 IST, no messages).');
}

module.exports = { start, resolve };
