/**
 * postProcessor/leakFilter.js
 *
 * PURPOSE
 *   Shared "thinking leak" scrubber used by every AI response path
 *   (api/gemini.js and ai/aiFallback.js) so both go through the exact same
 *   regex rules instead of drifting out of sync. Strips internal reasoning,
 *   planning steps, and meta-commentary that a model occasionally emits
 *   before its real, in-character answer — e.g. "Here's a thinking
 *   process:", "Thinking Process:", or a numbered plan like
 *   "1. Analyze User Input" — while leaving legitimate numbered/bulleted
 *   content that's actually part of the answer (a troop-tier list, a
 *   step-by-step game guide the user asked for, etc.) untouched.
 */

'use strict';

// ------------------------------------------------------------
// Line-level leak patterns — a single line matching any of these is dropped.
// ------------------------------------------------------------
const LEAK_LINE_PATTERNS = [
  /^\s*[-*•]\s*(?:[A-Za-z \/]{0,40}?\s+)?\b(check|verify|confirm|constraint|length|tone|persona|emoji|format)\b[A-Za-z \/]{0,20}?\s*:/i,
  /^\s*(draft|plan|step\s*\d+|reasoning|thought)\s*[:\-]/i,
  /^\s*[-*•]?\s*(let'?s|let\s*me)\s+(adjust|think|check|make sure|see|reconsider)\b/i,
  /^\s*\(.*\b(wait|hmm|per\s*directives?|matching\s*persona|need(s)?\s*to\s*be)\b.*\)\s*$/i,
  // Explicit "thinking process" headers, with or without a colon, any casing.
  /^\s*#{0,3}\s*\**\s*(here'?s?\s+(is\s+)?(a|my|the)\s+)?thinking\s*process\s*:?\**\s*$/i,
  /^\s*#{0,3}\s*\**\s*(internal\s+)?(chain[\s-]*of[\s-]*thought|scratchpad|analysis|reflection)\s*:?\**\s*$/i,
  // Numbered/lettered PLANNING steps that describe the approach rather than
  // being the answer itself (e.g. "1. Analyze User Input", "Step 2: Identify intent").
  /^\s*(?:\**)?(?:\d+[.)]|step\s*\d+[.:)]?|[a-z][.)])\s*\**\s*(analyz|identify|determine|assess|review|plan|evaluate|classify|check|extract|parse|understand|figure\s*out|decide|formulate|construct|draft)[a-z]*\s+(the\s+|user'?s?\s+)?(input|intent|query|request|message|context|data|response|reply|answer)\b/i,
];

// ------------------------------------------------------------
// Leading "thinking process" BLOCK detection: a header line (optionally)
// followed by one or more numbered/bulleted planning steps, all before the
// real answer begins. Catches the whole block even when individual step
// lines don't themselves match a LEAK_LINE_PATTERNS entry.
// ------------------------------------------------------------
const THINKING_BLOCK_HEADER = /^\s*#{0,3}\s*\**\s*(here'?s?\s+(is\s+)?(a|my|the)\s+)?(thinking\s*process|internal\s+reasoning|chain[\s-]*of[\s-]*thought|my\s+approach|reasoning\s*steps?)\s*:?\**\s*$/i;
const NUMBERED_STEP_LINE = /^\s*(?:\**)?(?:\d+[.)]|step\s*\d+[.:)]?)\s*\**/i;

const INLINE_LEAK_ASIDE = /\((?:[^()]*\b(?:wait|hmm|per\s*directives?|matching\s*persona|adjust(?:ing)?\s*to)\b[^()]*)\)/gi;

const XML_THOUGHT_TAGS = /<\/?(?:think|plan|reasoning|reflection|analysis|scratchpad|step)>/gi;

/**
 * Removes a leading thinking-process block: scans from the top of the
 * text, and if it finds a recognizable "Thinking Process:"-style header,
 * strips that header plus every immediately-following numbered/bulleted
 * step line, stopping at the first line that is neither a step nor blank
 * (i.e. where the real, final response begins).
 */
function stripLeadingThinkingBlock(text) {
  if (!text) return text;
  const lines = text.split('\n');
  let headerIdx = -1;

  // Only look near the top — a leaked thinking block, if present, precedes
  // the real answer. Scanning the whole message risks eating legitimate
  // numbered content deep in a real response (e.g. a troop-tier list).
  const SCAN_WINDOW = Math.min(lines.length, 6);
  for (let i = 0; i < SCAN_WINDOW; i++) {
    if (THINKING_BLOCK_HEADER.test(lines[i])) { headerIdx = i; break; }
    if (lines[i].trim() !== '') break; // first non-blank line isn't a header — stop looking
  }

  if (headerIdx === -1) return text;

  let cutEnd = headerIdx + 1;
  while (cutEnd < lines.length) {
    const line = lines[cutEnd];
    if (line.trim() === '' || NUMBERED_STEP_LINE.test(line)) {
      cutEnd++;
    } else {
      break;
    }
  }

  return lines.slice(cutEnd).join('\n').trim();
}

/**
 * Strips <think>/<plan>/etc. XML-style tags (and their contents, for the
 * paired <think>...</think> case) plus any leaked reasoning block or
 * leak-flavored line from a model's raw output. Safe to run on already-clean
 * text — it's a no-op there.
 */
function stripLeakedReasoning(text) {
  if (!text) return text;

  let working = text;
  // Paired <think>...</think> (and similar) blocks, including unterminated
  // trailing ones cut off by a token limit.
  working = working.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
  working = working.replace(XML_THOUGHT_TAGS, '');

  working = stripLeadingThinkingBlock(working);

  const cleanedLines = working.split('\n')
    .filter((line) => !LEAK_LINE_PATTERNS.some((pattern) => pattern.test(line)))
    .map((line) => line.replace(INLINE_LEAK_ASIDE, '').trim())
    .filter((line) => line.length > 0);

  return cleanedLines.join('\n').trim();
}

/**
 * Hard gate: returns false if the text still shows unmistakable signs of a
 * leaked reasoning block (used to trigger a retry rather than ship the
 * leak to the user).
 */
function gatekeeperLint(text) {
  if (!text) return false;
  if (/\|---\|/.test(text) || /\|.*\|.*\|/.test(text)) {
    return { ok: false, reason: 'Markdown table detected' };
  }
  if (/<think>|<\/think>|<plan>|<step>|<reasoning>|<reflection>|<analysis>|<scratchpad>/i.test(text)) {
    return { ok: false, reason: 'Leaked XML thought tags detected' };
  }
  if (THINKING_BLOCK_HEADER.test(text) || /\bthinking\s*process\s*:/i.test(text)) {
    return { ok: false, reason: 'Leaked "thinking process" header detected' };
  }
  return { ok: true, reason: null };
}

module.exports = {
  stripLeakedReasoning,
  stripLeadingThinkingBlock,
  gatekeeperLint,
  THINKING_BLOCK_HEADER,
};
