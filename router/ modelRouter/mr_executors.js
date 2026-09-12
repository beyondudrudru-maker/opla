/**
 * router/modelRouter/executors.js
 *
 * API EXECUTORS (normalized output + quota extraction) — one function per
 * provider wire format. Every executor enforces GENERATION_TIMEOUT_MS so a
 * single slow candidate can never stall the whole request.
 *
 * 🐛 FIX (kept from original): execGemini/execOpenAICompatible had NO
 * request timeout at all — only execCloudflare did (20s AbortController).
 * Observed in production: OpenRouter's nvidia/nemotron-3-ultra-550b:free
 * taking 50-127 SECONDS on a single call, with the router just awaiting it
 * to completion every time — stalling the entire Discord response and
 * burning the whole retry budget on one slow candidate instead of failing
 * fast to the next one. This is a shared budget for Gemini + Groq/
 * OpenRouter (Cloudflare keeps its own existing 20s constant untouched).
 */

const { MODEL_REGISTRY } = require('./registry.js');
const { getGeminiClient, getCloudflareConfig } = require('./clients.js');
const { parseQuotaHeaders } = require('./failures.js');
const { sleep, timeoutError } = require('./asyncUtils.js');

const GENERATION_TIMEOUT_MS = 25000;

async function execGemini({ apiKey, modelName, prompt, systemInstruction, temp, maxTokens }) {
  const entry = MODEL_REGISTRY.gemini[modelName];
  const genAI = getGeminiClient(apiKey);

  const generationConfig = { maxOutputTokens: maxTokens };
  if (entry && entry.supportsSampling && typeof temp === 'number') {
    generationConfig.temperature = temp;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
    tools: [
      { googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.2 } } }
    ],
    generationConfig
  });

  // Promise.race can't cancel the underlying HTTP call (the Gemini SDK here
  // doesn't take an abort signal), but it stops the router from waiting on
  // it — the router moves on to the next candidate instead of stalling the
  // user's response for 60-120+ seconds.
  const response = await Promise.race([
    model.generateContent(prompt),
    sleep(GENERATION_TIMEOUT_MS).then(() => { throw timeoutError('Gemini', GENERATION_TIMEOUT_MS); })
  ]);
  // Gemini SDK doesn't expose raw rate-limit headers through this call path.
  return { text: response.response.text(), quota: null };
}

async function execOpenAICompatible(client, { modelName, prompt, systemInstruction, maxTokens, temp }) {
  let data, headers = null;
  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    temperature: temp,
    max_tokens: maxTokens
  };

  // Real AbortController + the SDK's `signal` request option, so the
  // underlying HTTP request is actually cancelled (not just abandoned like
  // a bare Promise.race would do) — the connection is torn down and the
  // router moves on to the next candidate immediately.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  // Some SDK versions/paths return a plain Promise from .create() (no
  // .withResponse() chain method) instead of the APIPromise this prefers.
  // Distinguish "this SDK doesn't support .withResponse()" from "the
  // request itself failed" by checking BEFORE awaiting — chaining
  // .withResponse() onto an already-in-flight promise and only checking
  // in the catch block double-fires the request on every real failure
  // (doubling quota burn) and can also surface as an unhandled rejection
  // on the un-awaited first promise.
  try {
    const initial = client.chat.completions.create(payload, { signal: controller.signal });
    if (typeof initial.withResponse === 'function') {
      try {
        const withResp = await initial.withResponse();
        data = withResp.data;
        headers = withResp.response ? withResp.response.headers : null;
      } catch (e) {
        // withResponse() exists but the request itself failed — propagate,
        // do NOT re-issue the request.
        throw e;
      }
    } else {
      // No .withResponse() support on this SDK path/version — the plain
      // call IS the real request; let its rejection propagate naturally.
      data = await initial;
    }
  } finally {
    clearTimeout(timeout);
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { text, quota: parseQuotaHeaders(headers) };
}

async function execCloudflare({ modelName, prompt, systemInstruction, maxTokens, temp }) {
  const cfg = getCloudflareConfig();
  if (!cfg) throw new Error('Cloudflare not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: temp,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Cloudflare ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content || '', quota: parseQuotaHeaders(res.headers) };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { GENERATION_TIMEOUT_MS, execGemini, execOpenAICompatible, execCloudflare };
