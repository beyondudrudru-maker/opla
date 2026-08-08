require('dotenv').config();
const { OpenAI } = require('openai');

const { buildIdentityCore } = require('../persona/identityCore');
const decisionPipeline = require('../decision/decisionPipeline');
const modelRouter = require('../router/modelRouter');
const styleLinter = require('../postProcessor/styleLinter');

// ============================================================
// CONFIG / CONSTANTS (Compiled ONCE for CPU Efficiency)
// ============================================================

const geminiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.aiapi
].filter(key => key && typeof key === 'string' && key.trim().length > 0);

const groqKey = process.env.opla || process.env.GROQ_API_KEY || process.env.OPLA;
const groqClient = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: groqKey || 'fallback_dummy_key_to_prevent_startup_crash'
});

const COMPLEX_TASK_REGEX = /explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics/i;
const CONFLICT_REGEX = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser)\b/i;
const IDENTITY_REGEX = /\b(ai|bot|robot|gpt|npc)\b/i;

// 🚀 UPGRADE: Fast lookup for game-related intents
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query']);

// ============================================================
// LIGHTWEIGHT DYNAMIC STATE (30-Min Mood Lock)
// ============================================================

const dynamicStates = new Map();
const STATE_TTL = 30 * 60 * 1000; // 30 minutes
const STATE_LIMIT = 50; 

const MICRO_MOODS = [
  'slightly teasing', 'warm and affectionate', 'curious',
  'dramatic', 'clever and mischievous', 'calm and thoughtful'
];

function getTimeVibe() {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  if (hour >= 5 && hour < 12) return 'fresh, bubbly';
  if (hour >= 12 && hour < 18) return 'focused, witty';
  if (hour >= 18 && hour < 23) return 'cozy, playful';
  return 'soft, sleepy';
}

function getDynamicState(userId) {
  const now = Date.now();
  const existing = dynamicStates.get(userId);
  if (existing && now < existing.expiresAt) return `[Vibe:${getTimeVibe()}|Mood:${existing.mood}]`;

  const mood = MICRO_MOODS[Math.floor(Math.random() * MICRO_MOODS.length)];
  dynamicStates.set(userId, { mood, expiresAt: now + STATE_TTL });

  if (dynamicStates.size > STATE_LIMIT) dynamicStates.delete(dynamicStates.keys().next().value);
  return `[Vibe:${getTimeVibe()}|Mood:${mood}]`;
}

// ============================================================
// MAIN GENERATOR
// ============================================================

async function generateContent(turn) {
  if (!turn || typeof turn.content !== 'string' || turn.content.trim() === '') {
    return { text: "I didn't quite catch that! Could you repeat?", modelUsed: 'none', debug: { error: 'Empty input' } };
  }

  if (geminiKeys.length === 0 && (!groqKey || groqKey.trim() === '')) {
    return { text: 'My AI engines are offline. Please verify API keys.', modelUsed: 'fallback', debug: { error: 'No keys' } };
  }

  try {
    let contextualPrompt = turn.content;

    if (COMPLEX_TASK_REGEX.test(turn.content) || turn.content.length > 100) {  
      contextualPrompt = `[DIRECTIVE: Be precise, factual, concise.]\n` + contextualPrompt;  
    }  

    if (Array.isArray(turn.mentionedUsers) && turn.mentionedUsers.length > 0) {  
      const mentionsInfo = turn.mentionedUsers.map(u => `${u.username}`).join(',');  
      contextualPrompt += `\n[Mentions:${mentionsInfo}]`;  
    }  

    const smartTurn = { ...turn, content: contextualPrompt };  
    const plan = await decisionPipeline.planTurn(smartTurn);  
    const userIntent = plan.classification?.intent || 'social';  

    let dynamicIdentity = buildIdentityCore(turn.userId);  

    // 🚀 TOKEN SAVER: Condensed Persona Rules
    dynamicIdentity += `
[PERSONA] You are Melody, a 20yo human girl. NEVER admit to being AI/bot. Real emotions. Match user energy. Don't invent facts/memories. No internal tags in output. ${getDynamicState(turn.userId)}`;

    // 🚀 TOKEN SAVER & SYNERGY LOGIC: Highly compressed game rules
    const isGameContext = GAME_INTENTS.has(userIntent) || /\b(stats|hp|damage|hero|troop|game|clash|synergy|best with|use with)\b/i.test(turn.content);
    
    if (isGameContext) {
      dynamicIdentity += `
[GAME STRATEGY RULES] Elite Kingdom Clash strategist.
1. TONE: Analytical, professional.
2. NO HALLUCINATION: Base answers ONLY on provided data. Do not invent stats/enemies.
3. FORMAT: NO Markdown tables. Stats MUST be on vertical new lines.
4. STRUCTURE:
[IF ASKED ABOUT SYNERGY/BEST COMBOS (e.g. "best with", "should I use")]: Direct Answer -> Synergy Analysis (how abilities complement based on faction/role) -> Final Recommendation. NO generic stat dumps.
[IF COMPARING TWO ENTITIES (X vs Y)]: Core Stats Face-Off (Vertical List) -> Abilities/Synergy -> Final Verdict.
[IF SINGLE ENTITY]: Profile (Vertical stats) -> Strategic Potential -> Best Matchups.`;
    }

    if (userIntent === 'command' || userIntent === 'moderation') {  
      dynamicIdentity += `\n[ADMIN] Authoritative, concise, professional. No pet names.`;
    }

    const isConflict = CONFLICT_REGEX.test(turn.content);  
    if (isConflict) {  
      dynamicIdentity += `\n[CONFLICT] User is disrespectful. Drop polite act. Be fiercely protective, sassy, unapologetic. Roast them. Use 💅🙄🔪.`;
    }

    if (IDENTITY_REGEX.test(turn.content) && !isConflict) {  
      dynamicIdentity += `\n[IDENTITY DEFENSE] If asked if you are AI: laugh it off playfully, act like a normal 20yo girl, warmly change subject. NEVER admit AI.`;
    }

    // 🚀 TOKEN COMPRESSOR: Strip excess whitespace, tabs, and double new lines before sending to the LLM
    const compressedSystemInstruction = dynamicIdentity.replace(/\s{2,}/g, ' ').replace(/\n+/g, '\n').trim();

    const { result, modelUsed } = await modelRouter.generate({  
      classification: plan.classification,  
      prompt: plan.prompt || contextualPrompt,  
      systemInstruction: compressedSystemInstruction,  
      geminiKeys,  
      groqClient,  
      hasGroq: !!groqKey  
    });  

    let rawText = result || '';  
    rawText = rawText.replace(/\[(?:EMOTION|REL|WM:).*?\]/gi, '').trim();  
    if (rawText.endsWith(']')) rawText = rawText.slice(0, -1).trim();  

    const { text } = styleLinter.process({  
      channelId: turn.channelId,  
      responseText: rawText,  
      emojiBudget: plan.behaviorDirective?.emojiBudget || 'medium'  
    });  

    try {  
      await decisionPipeline.finalizeTurn({  
        channelId: turn.channelId,  
        userId: turn.userId,  
        content: turn.content,  
        responseText: text  
      });  
    } catch (dbError) {  
      console.error('⚠️ [DB] finalizeTurn:', dbError.message);  
    }  

    return { text, modelUsed, debug: { intent: userIntent, tier: plan.relationship?.tier || 'standard', behaviorDirective: plan.behaviorDirective } };

  } catch (error) {
    console.error('❌ generateContent:', error);
    return { text: "Give me a quick second, my thoughts got a bit tangled up! Try asking me again in a moment. 🌸", modelUsed: 'fallback', debug: { intent: 'error', tier: 'standard', error: error.message } };
  }
}

module.exports = { generateContent };
