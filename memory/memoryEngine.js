// ============================================================
// 11.5 CHAT SUMMARIZATION (ON-DEMAND, ULTRA-CLEAN & CACHED)
// ============================================================

// 🚀 UPGRADE: In-Memory Cache to prevent redundant API calls and save tokens/latency.
const summaryCache = new Map();
const MAX_CACHE_SIZE = 50; // Prevents memory leaks

async function generateChatSummary(turns) {
  if (!extractionClient || !Array.isArray(turns) || turns.length === 0) return '';

  let transcript = turns
    .map(t => {
      const safeContent = t.content.length > 200 ? t.content.substring(0, 200) + '...' : t.content;
      return `${t.role || 'user'}: ${safeContent}`;
    })
    .join('\n');
    
  if (transcript.length > 2000) {
      transcript = transcript.substring(transcript.length - 2000);
  }

  // 🚀 FAST-LANE: Create a unique fingerprint of the current transcript
  const transcriptHash = crypto.createHash('md5').update(transcript).digest('hex');
  
  // If we already summarized this exact block of text recently, return it instantly!
  if (summaryCache.has(transcriptHash)) {
      return summaryCache.get(transcriptHash);
  }

  // 🚀 Force the AI to be extremely short and avoid fluff.
  const prompt = `Summarize this Discord conversation. 
RULES:
1. ONLY return 2 short bullet points.
2. NO conversational filler (e.g. "Here is the summary").
3. Focus purely on key actions or decisions.

Conversation:\n${transcript}`;

  try {
    const response = await extractionClient.chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100
    });
    
    const finalSummary = response.choices[0]?.message?.content?.trim() || '';
    
    // Save to cache
    summaryCache.set(transcriptHash, finalSummary);
    
    // Prevent cache from growing infinitely
    if (summaryCache.size > MAX_CACHE_SIZE) {
        const oldestKey = summaryCache.keys().next().value;
        summaryCache.delete(oldestKey);
    }

    return finalSummary;
  } catch (err) {
    console.error('⚠️ [MEMORY] Chat summary via Groq failed:', err.message);
    return '';
  }
}
