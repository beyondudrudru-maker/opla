/**
 * router/modelRouter/clients.js
 *
 * CLIENT CACHE (created once, never per-request).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const { ENABLE_OPENROUTER, ENABLE_CLOUDFLARE, dlog } = require('./envFlags.js');

const genAiClientCache = new Map();
function getGeminiClient(apiKey) {
  if (!genAiClientCache.has(apiKey)) {
    genAiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return genAiClientCache.get(apiKey);
}

let openRouterClient = null;
let openRouterInitAttempted = false;
function getOpenRouterClient() {
  if (!ENABLE_OPENROUTER) return null;
  if (openRouterInitAttempted) return openRouterClient;
  openRouterInitAttempted = true;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    dlog('OPENROUTER_API_KEY not set — OpenRouter tier disabled.');
    return null;
  }
  openRouterClient = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || '',
      'X-Title': process.env.OPENROUTER_SITE_NAME || ''
    }
  });
  return openRouterClient;
}

// Groq clients are built internally from the raw API keys the caller
// passes in (groqKeys), the same way Gemini clients are built from
// geminiKeys — callers should never need to construct an SDK client
// themselves. Cached per-key so repeated calls don't re-instantiate.
const groqClientCache = new Map();
function getGroqClient(apiKey) {
  if (!apiKey) return null;
  if (!groqClientCache.has(apiKey)) {
    groqClientCache.set(apiKey, new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    }));
  }
  return groqClientCache.get(apiKey);
}

let cloudflareInitAttempted = false;
let cloudflareConfig = null;
function getCloudflareConfig() {
  if (!ENABLE_CLOUDFLARE) return null;
  if (cloudflareInitAttempted) return cloudflareConfig;
  cloudflareInitAttempted = true;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    dlog('Cloudflare credentials not set — Cloudflare tier disabled.');
    return null;
  }
  cloudflareConfig = {
    accountId,
    apiToken,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
  };
  return cloudflareConfig;
}

module.exports = { getGeminiClient, getOpenRouterClient, getGroqClient, getCloudflareConfig };
