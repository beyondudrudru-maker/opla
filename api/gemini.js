require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Import the dynamic builder instead of a static string
const { buildIdentityCore } = require('../persona/identityCore'); 
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

/**
 * api/gemini.js
 *
 * PURPOSE
 *   Thin entrypoint. Wires the modular pipeline together and exposes the
 *   same API your Discord event handler calls.
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Gemini API Key missing in .env file!');
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Main entrypoint, replacing the old smartBrain.generateContent(prompt).
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
  // 2. Build the dynamic persona (Creator vs Others)
  const dynamicIdentity = buildIdentityCore(turn.userId);

  // 3. Initialize models per-request to inject the correct dynamic persona
  const flashModel = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash', 
      systemInstruction: dynamicIdentity 
  });
  const liteModel = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite', 
      systemInstruction: dynamicIdentity 
  });

  // 4. Inject the Discord Mention Context (Smart Working Style)
  let contextualPrompt = turn.content;
  if (turn.mentionedUsers && turn.mentionedUsers.length > 0) {
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username} (Discord ID: <@${u.id}>)`).join(', ');
      contextualPrompt += `\n\n[SYSTEM CONTEXT: The user mentioned these people: ${mentionsInfo}. If asked to interact with them, use their exact Discord ID syntax like <@${turn.mentionedUsers[0].id}>.]`;
  }
  
  // Replace the raw content with our smarter contextual prompt for the AI to process
  const smartTurn = { ...turn, content: contextualPrompt };

  // 5. Route through your existing architecture
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

  // 6. Save the original content (without system brackets) to the database
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
