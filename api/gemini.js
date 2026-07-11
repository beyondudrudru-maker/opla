require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { buildIdentityCore } = require('../persona/identityCore'); 
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

/**
 * api/gemini.js
 *
 * PURPOSE
 *   Wires the modular pipeline together. Updated with generalized Strict AI 
 *   Identity Enforcement to handle any complex tasks professionally.
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Gemini API Key missing in .env file!');
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Main entrypoint for generating AI content.
 *
 * @param {object} turn
 * @param {string} turn.userId - Discord user ID of the speaker
 * @param {string} turn.displayName - Discord display name
 * @param {string[]} [turn.roles] - Discord role names
 * @param {string} turn.channelId - Discord channel ID
 * @param {string} turn.content - the raw message text
 * @param {boolean} [turn.isGroupContext] - true for multi-party channels
 * @param {Array} [turn.mentionedUsers] - Array of mentioned user objects
 * @returns {Promise<{ text: string, modelUsed: string, debug: object }>}
 */
async function generateContent(turn) {
  let dynamicIdentity = buildIdentityCore(turn.userId);

  // === STRICT AI IDENTITY & ACCURACY OVERRIDE ===
  // Instructs the AI to remain a bot and handle ANY complex task accurately.
  dynamicIdentity += `\n\n=== STRICT AI IDENTITY ENFORCEMENT (CRITICAL) ===
1. You are an AI bot. NEVER pretend to be human. Do not use phrases like "glitch on my end", "I was tired", or make human excuses.
2. If you encounter an error, state it clearly as an AI (e.g., "I encountered a processing error").
3. For ANY complex tasks—including but not limited to writing long texts, explaining detailed concepts, historical analysis, coding, or reciting mantras—you MUST prioritize maximum accuracy. Do not get stuck in repeating syllables or text loops. Be precise and professional.`;

  // === ADMINISTRATIVE & CLAN OVERRIDE ===
  dynamicIdentity += `\n\n=== ADMINISTRATIVE & CLAN OVERRIDE (CRITICAL) ===
If the user's command involves SERVER MANAGEMENT, PUBLIC ANNOUNCEMENTS (using @everyone or tagging roles), CLAN EVENTS, or MODERATION:
1. You MUST adopt a strictly professional, diplomatic, and authoritative tone.
2. Do NOT include ANY affection, romantic undertones, cute remarks, or personal closings (no heart emojis), even if speaking to your Creator.
3. Your output must read like a formal public announcement written by a smart server manager. Keep it sharp and to the point.`;

  const flashModel = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash', 
      systemInstruction: dynamicIdentity 
  });
  const liteModel = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite', 
      systemInstruction: dynamicIdentity 
  });

  let contextualPrompt = turn.content;
  
  // PRE-PROCESSOR: Broadly tag complex tasks for the router/model
  // Checks for complex keywords OR if the user's prompt is unusually long.
  const complexTaskKeywords = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics|translate|summary|how to/i;
  if (complexTaskKeywords.test(turn.content) || turn.content.length > 100) {
      contextualPrompt = `[SYSTEM NOTE: THIS IS A COMPLEX OR LONG-FORM TASK. PRIORITIZE MAXIMUM ACCURACY, AVOID REPETITION, AND RESPOND PROFESSIONALLY.]\n\n` + contextualPrompt;
  }

  if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (Discord ID: <@${u.id}>)`).join(', ');
      contextualPrompt += `\n\n[SYSTEM CONTEXT: The user mentioned these people: ${mentionsInfo}. If asked to interact with them, use their exact Discord ID syntax like <@${turn.mentionedUsers[0].id}>.]`;
  }

  const adminKeywords = /@everyone|clan|announce|notify|server|event/i;
  if (adminKeywords.test(turn.content)) {
      contextualPrompt += `\n\n[SYSTEM DIRECTIVE: This is an administrative/clan task. You MUST enforce the "ADMINISTRATIVE & CLAN OVERRIDE" rule. Be strictly professional, diplomatic, and smart. NO affection or pet names.]`;
  }
  
  const smartTurn = { ...turn, content: contextualPrompt };

  const plan = await decisionPipeline.planTurn(smartTurn);

  const { result, modelUsed } = await modelRouter.generate({
    classification: plan.classification,
    prompt: plan.prompt,
    flashModel,
    liteModel,
  });

  const rawText = result.response.text();
  
  const { text } = styleLinter.process({
    channelId: turn.channelId,
    responseText: rawText,
    emojiBudget: plan.behaviorDirective.emojiBudget,
  });

  await decisionPipeline.finalizeTurn({
    channelId: turn.channelId,
    userId: turn.userId,
    content: turn.content,
    responseText: text,
  });

  return {
    text,
    modelUsed,
    debug: {
      intent: plan.classification.intent,
      tier: plan.relationship.tier,
      behaviorDirective: plan.behaviorDirective,
    },
  };
}

module.exports = { generateContent };
