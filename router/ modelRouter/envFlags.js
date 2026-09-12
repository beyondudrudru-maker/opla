/**
 * router/modelRouter/envFlags.js
 * Environment-driven safety switches and shared loggers.
 */

function envBool(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return def;
  return String(raw).toLowerCase() !== 'false' && String(raw).toLowerCase() !== '0';
}

const DEBUG = envBool('MODEL_ROUTER_DEBUG', false);
const FREE_ONLY_MODE = envBool('FREE_ONLY_MODE', true);
const OPENROUTER_FREE_ONLY = envBool('OPENROUTER_FREE_ONLY', true);

const ENABLE_GEMINI = envBool('ENABLE_GEMINI', true);
const ENABLE_GROQ = envBool('ENABLE_GROQ', true);
const ENABLE_OPENROUTER = envBool('ENABLE_OPENROUTER', true);
const ENABLE_CLOUDFLARE = envBool('ENABLE_CLOUDFLARE', true);

const MODEL_DISCOVERY_TTL_MS = Number(process.env.MODEL_ROUTER_HEALTH_INTERVAL_MS) > 0
  ? Number(process.env.MODEL_ROUTER_HEALTH_INTERVAL_MS)
  : 30 * 60 * 1000; // 30 min default

function dlog(...args) { if (DEBUG) console.log('[ROUTER]', ...args); }
function ilog(...args) { console.log('[ROUTER]', ...args); }
function wlog(...args) { console.warn('[ROUTER]', ...args); }

module.exports = {
  envBool,
  DEBUG,
  FREE_ONLY_MODE,
  OPENROUTER_FREE_ONLY,
  ENABLE_GEMINI,
  ENABLE_GROQ,
  ENABLE_OPENROUTER,
  ENABLE_CLOUDFLARE,
  MODEL_DISCOVERY_TTL_MS,
  dlog,
  ilog,
  wlog
};
