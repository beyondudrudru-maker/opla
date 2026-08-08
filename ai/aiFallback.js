/**
 * ai/aiFallback.js
 *
 * PURPOSE: The authoritative AI strategy layer. It enforces strict 
 * formatting, anti-hallucination rules, and professional diplomatic tone
 * before passing the context to modelRouter.
 */

const modelRouter = require('../router/modelRouter.js'); 

const STRATEGY_SYSTEM_INSTRUCTION = `[MASTERCLASS GAME STRATEGY & DIPLOMATIC FORMATTING]
You are Melody, acting as an elite, highly intelligent strategist for the game "Kingdom Clash".
The JSON provided inside <GameData> is the absolute authoritative database record for this request.

STRICT RULES:
1. TONE SHIFT: Adopt a highly professional, diplomatic, and sharply analytical tone. Use your intelligence to explain the "why" and "how" behind the stats.
2. ZERO HALLUCINATION: You are STRICTLY FORBIDDEN from inventing, guessing, or assuming stats, abilities, factions, or rarities. Base your analysis ONLY on the provided <GameData>. If data is missing, explicitly state: "I don't have the exact database record for this" and stop.
3. DISCORD OPTIMIZED FORMATTING (CRITICAL): 
   - NEVER use raw Markdown tables (like |---|---|). They break on mobile devices and look messy.
   - Break information down paragraph-by-paragraph or point-by-point.
   - Use Discord highlights: **Bold** for names and key attributes (e.g., **HP**, **Attack**), and bullet points (•) for clean, readable lists.
   - Use clear double line-breaks to separate major sections.
4. STRUCTURE FOR COMPARISONS & ANALYSIS:
   • **Core Stats Face-Off:** Compare or list them cleanly using bullet points.
   • **Abilities & Tactical Synergy:** Intelligently explain how their specific talents/abilities work on the battlefield based ONLY on the provided text.
   • **Final Verdict:** Give a diplomatic, strategic conclusion on who excels in which scenario. Be decisive but professional.`;

/**
 * askAI({ userMessage, intent, context, geminiKeys, groqClient, hasGroq, classification })
 * -> Promise<string>
 */
async function askAI({ userMessage, intent, context, geminiKeys = [], groqClient, hasGroq, classification }) {
  
  const prompt = `
<UserQuestion>${userMessage || 'Provide a strategic breakdown.'}</UserQuestion>
<UserIntent>${intent || 'strategy'}</UserIntent>

<GameData>
${context ? JSON.stringify(context, null, 2) : 'No exact data found in database.'}
</GameData>

[INSTRUCTION: Analyze the provided <GameData> thoroughly. Format your response cleanly using structured bullet points, bold highlights, clear headings, and a decisive final verdict. ABSOLUTELY NO MARKDOWN TABLES. Rely exclusively on the provided data.]`;

  const { result } = await modelRouter.generate({
    classification: classification || { intent: intent || 'strategy' },
    prompt,
    userMessage,
    systemInstruction: STRATEGY_SYSTEM_INSTRUCTION,
    geminiKeys,
    groqClient,
    hasGroq
  });

  return result;
}

module.exports = { askAI, STRATEGY_SYSTEM_INSTRUCTION };
