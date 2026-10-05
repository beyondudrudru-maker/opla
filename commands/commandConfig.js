// commands/commandConfig.js
// Single place to rename Melody's fast-lane commands so they never collide with other bots.
// Override on Render with env vars, no code change needed:
//   MELODY_CMD_PREFIX=!   MELODY_BOSS_CMD=mboss   MELODY_SUMMARY_CMD=summary
'use strict';

const clean = (v, fallback) => (String(v || fallback).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || fallback);

const PREFIX = (process.env.MELODY_CMD_PREFIX || '!').trim() || '!';
const BOSS_CMD = clean(process.env.MELODY_BOSS_CMD, 'mboss');
const SUMMARY_CMD = clean(process.env.MELODY_SUMMARY_CMD, 'summary');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matches "<prefix><cmd> <args>" ; group1 = which command, group2 = args
const FAST_CMD_REGEX = new RegExp(
    `^${escapeRegExp(PREFIX)}(${escapeRegExp(SUMMARY_CMD)}|${escapeRegExp(BOSS_CMD)})(?![a-z0-9_])\\s*([\\s\\S]*)$`,
    'i'
);

module.exports = {
    PREFIX, BOSS_CMD, SUMMARY_CMD, FAST_CMD_REGEX,
    bossLabel: `${PREFIX}${BOSS_CMD}`,
    summaryLabel: `${PREFIX}${SUMMARY_CMD}`
};
