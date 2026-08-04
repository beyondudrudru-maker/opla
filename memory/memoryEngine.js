async function extractCandidateMemories(turns, userId) {
  const candidates = [];
  
  if (!extractionModel) return candidates;
  
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.user_id !== userId) continue;

    if (!MEMORY_SIGNAL_REGEX.test(turn.content)) continue;

    const sourceHash = computeContentHash(userId, turn.content);
    
    if (processedMessages.has(sourceHash) || processingMessages.has(sourceHash)) {
      continue;
    }

    processingMessages.add(sourceHash);

    // 🚀 UPGRADED: Now extracts the tag AND dynamically scores the emotional weight
    const extractionPrompt = `Analyze the user message. Extract durable, long-term facts, preferences, or goals.
Also assign an emotional weight from 0.1 (neutral) to 1.0 (highly passionate/emotional).
Output EXACTLY in this format: [TAG:Value]|Score
Example 1: "I am studying computer engineering" -> [STUDIES:CompEng]|0.3
Example 2: "I absolutely love Kingdom Clash!" -> [FAV_GAME:KingdomClash]|0.9
If no durable fact exists, output exactly: NONE
User Message: "${turn.content}"`;

    try {
      const result = await extractionModel.generateContent(extractionPrompt);
      const extraction = result.response.text().trim();

      if (extraction !== "NONE" && extraction.includes("]|")) {
        // Split the response into the memory tag and the numerical score
        const [memoryTag, scoreStr] = extraction.split("]|");
        const finalTag = memoryTag + "]"; 
        const emotionalScore = parseFloat(scoreStr) || 0.5; // Fallback to 0.5 if parsing fails

        candidates.push({
          content: finalTag,
          content_hash: computeContentHash(userId, finalTag),
          topic_tags: [], 
          emotional_score: emotionalScore, // 🧠 Dynamic emotional score saved!
        });
      }

      processedMessages.add(sourceHash);
      if (processedMessages.size > PROCESSED_LIMIT) {
        const oldestKey = processedMessages.keys().next().value;
        processedMessages.delete(oldestKey);
      }

    } catch (error) {
      console.error(`⚠️ Memory Extraction failed:`, error.message);
    } finally {
      processingMessages.delete(sourceHash);
    }
  }
  
  return candidates;
}
