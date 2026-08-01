require('dotenv').config();
const { OpenAI } = require('openai');
const { buildIdentityCore } = require('../persona/identityCore');
const styleLinter = require('../postProcessor/styleLinter');
const decisionPipeline = require('../decision/decisionPipeline');

// Initialize the client pointing to Groq's free endpoint
const aiClient = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1", 
  apiKey: process.env.opla // 🔑 Now pointing to your new 'opla' variable!
});

async function generateContent(turn) {
  // Empty Check
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  // Key Check
  if (!process.env.opla) {
    return { text: "My brain is disconnected! Tell my creator to add the opla key in Render.", modelUsed: 'fallback', debug: { error: 'No API key' } };
  }

  try {
    let dynamicIdentity = buildIdentityCore(turn.userId);
    
    // Maintain your bot's personality
    dynamicIdentity += `\n\n=== HUMAN CONVERSATIONAL FLOW (CRITICAL) ===
1. SPEAK NATURALLY: Be authentic, warm, and witty. Never say "As an AI...".
2. EMOJIS: Use a rich variety of emojis (❤️✨🎶).
3. ACCURACY: Provide exact lyrics for specific songs if asked.`;

    // Execute the call to the Groq API (Using the free Llama 3.1 model)
    const completion = await aiClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: dynamicIdentity },
        { role: "user", content: turn.content }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    let rawText = completion.choices[0].message.content;

    // Process through your style linter
    const { text } = styleLinter.process({
      channelId: turn.channelId,
      responseText: rawText,
      emojiBudget: 'medium',
    });

    // Save state to database safely
    try {
      await decisionPipeline.finalizeTurn({
        channelId: turn.channelId,
        userId: turn.userId,
        content: turn.content,
        responseText: text,
      });
    } catch (dbError) {
      console.error('⚠️ Database warning:', dbError.message);
    }

    return {
        text,
        modelUsed: "Groq-Llama-3.1-8b",
        debug: { intent: "social", tier: "standard" }
    };

  } catch (error) {
    console.error("❌ Groq API Error:", error.message);
    return {
        text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸",
        modelUsed: "fallback",
        debug: { intent: "error", error: error.message }
    };
  }
}

module.exports = { generateContent };
