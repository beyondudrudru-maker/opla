/**
 * router/modelRouter/executors.js
 *
 * API EXECUTORS (normalized output + quota extraction) — one function per
 * provider wire format. Every executor enforces GENERATION_TIMEOUT_MS so a
 * single slow candidate can never stall the whole request.
 * 
 * 🚀 UPGRADE: Fixed massive memory leak in Gemini's Promise.race timers.
 * 🚀 UPGRADE: Implemented true AbortSignals across all API calls.
 */

const { MODEL_REGISTRY } = require('./registry.js');
const { getGeminiClient, getCloudflareConfig } = require('./clients.js');
const { parseQuotaHeaders } = require('./failures.js');
const { timeoutError } = require('./asyncUtils.js');

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

  const controller = new AbortController();
  let timeoutId;

  // 🚀 FIX: Memory-leak proof timeout race
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(); // Actually kill the HTTP connection
      reject(timeoutError('Gemini', GENERATION_TIMEOUT_MS));
    }, GENERATION_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      // Pass the signal so modern SDK versions instantly drop the TCP connection
      model.generateContent(prompt, { signal: controller.signal }),
      timeoutPromise
    ]);
    return { text: response.response.text(), quota: null };
  } finally {
    clearTimeout(timeoutId); // 🧹 CLEAR the timer immediately to save RAM!
  }
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    const initial = client.chat.completions.create(payload, { signal: controller.signal });
    if (typeof initial.withResponse === 'function') {
      try {
        const withResp = await initial.withResponse();
        data = withResp.data;
        headers = withResp.response ? withResp.response.headers : null;
      } catch (e) {
        throw e;
      }
    } else {
      data = await initial;
    }
  } finally {
    clearTimeout(timeout); // 🧹 RAM Cleanup
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { text, quota: parseQuotaHeaders(headers) };
}

async function execCloudflare({ modelName, prompt, systemInstruction, maxTokens, temp }) {
  const cfg = getCloudflareConfig();
  if (!cfg) throw new Error('Cloudflare not configured');
  
  const controller = new AbortController();
  // 🚀 FIX: Unified timeout constant instead of hardcoded 20s
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  
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
    clearTimeout(timeout); // 🧹 RAM Cleanup
  }
}

module.exports = { GENERATION_TIMEOUT_MS, execGemini, execOpenAICompatible, execCloudflare };
