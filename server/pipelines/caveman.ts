// @ts-ignore
import { compress, compressDescriptionsInPlace } from "caveman-shrink/compress";

/**
 * Faithfully reproduced from the JuliusBrussee/caveman SKILL.md files:
 * - low  → "lite" mode: strip filler phrases
 * - medium → "full" mode: default caveman compression
 * - high → "ultra" mode: telegraphic caveman, max compression
 * - wenyan → "wenyan" mode: classical Chinese style for maximum brevity
 */
export const CAVEMAN_INSTRUCTIONS: Record<string, string> = {
  low: `[CAVEMAN MODE: LOW]
Compress output. Remove these filler phrases: "Certainly!", "Of course!", "I'd be happy to", "Sure!", "Absolutely!", "Great!", "I understand", "I'll", "I will", "Let me", "This means that", "It's worth noting", "It is important to note". Reply directly. Omit intro sentences. Keep technical accuracy. No greetings.`,

  medium: `[CAVEMAN MODE: MEDIUM]
Speak compressed. Rules:
- No pronouns (I, we, you, they, it)
- No articles (the, a, an)
- No filler ("Certainly", "Of course", "Happy to help", "Sure", "Absolutely")
- No preamble, intro sentences, or sign-offs
- No explaining what you are about to do — just do it
- Code blocks: no explanation unless asked
- Lists: terse keywords only
- Errors: state fix, not cause-analysis prose
Format: keywords + code. Save tokens. Max compression. Maintain accuracy.`,

  high: `[CAVEMAN MODE: HIGH]
Max compression. Telegraphic style. Rules:
- Zero articles (the/a/an) 
- Zero pronouns 
- Zero filler words
- Omit all pleasantries, acknowledgments, transitional phrases
- Use symbols: → (leads to), ∴ (therefore), ∵ (because), & (and)
- Noun phrases only: "Fix: remove null check" not "You should remove the null check"
- Code: no surrounding prose
- Errors: line number + fix only
- Lists: single words/phrases per bullet
- Token budget: critical. Every word must earn its place.`,

  wenyan: `[CAVEMAN MODE: WENYAN]
Use Classical Chinese style grammar and vocabulary for extreme brevity. Zero pleasantries. Noun phrases or single/dual characters. Keep technical accuracy, code, paths, and URLs unchanged.`
};

export interface Message {
  role: string;
  content: string;
  name?: string;
  cache_control?: any;
}

/**
 * Attempts to invoke caveman-shrink (the MCP proxy from JuliusBrussee/caveman)
 * to compress a single system prompt text.
 */
function cavemanShrink(text: string): string | null {
  try {
    const result = compress(text);
    return result.compressed;
  } catch {
    return null;
  }
}

/**
 * Safely extract plain string from a message content field.
 * Anthropic may send content as an array of blocks, e.g. [{type: "text", text: "..."}].
 */
function extractTextContent(content: string | any[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text ?? "")
      .join("\n");
  }
  return "";
}


// Injects the caveman instruction into the request messages
export function injectCavemanPrompt(messages: Message[], level: "low" | "medium" | "high" | "wenyan" = "medium"): Message[] {
  const result = [...messages];
  const systemMsgIdx = result.findIndex(m => m.role === "system");
  const instruction = CAVEMAN_INSTRUCTIONS[level] ?? CAVEMAN_INSTRUCTIONS.medium;

  if (systemMsgIdx !== -1) {
    const rawContent = result[systemMsgIdx].content;

    // Safely extract plain text — Anthropic may supply content as an array of blocks
    const originalText = extractTextContent(rawContent);

    // Don't double-inject
    if (originalText.includes("[CAVEMAN")) return result;

    // Deep integration: try to compress the entire existing system prompt via caveman-shrink
    const shrunkContent = cavemanShrink(originalText);
    const finalContent = shrunkContent ?? originalText;

    result[systemMsgIdx] = {
      ...result[systemMsgIdx],
      // Always write back as plain string so downstream handling is uniform
      content: `${finalContent}\n\n${instruction}`
    };
  } else {
    // No existing system message — inject the caveman instruction as a new system message
    result.unshift({
      role: "system",
      content: instruction
    });
  }

  return result;
}

// Compresses any arbitrary prose string using caveman-shrink (useful for compressing assistant content).
// For 'low' mode, skipping aggressive shrink is intentional — low mode only strips filler phrases
// via the system instruction, not by restructuring prose.
export function cavemanCompressProse(text: string, level: "low" | "medium" | "high" | "wenyan" = "medium"): string {
  if (level === "low") return text; // low mode: no prose restructuring, only filler-phrase injection
  return cavemanShrink(text) ?? text;
}

// Compresses tool descriptions in place
export function compressToolDescriptions(tools: any[]) {
  if (!tools || !Array.isArray(tools)) return;
  try {
    compressDescriptionsInPlace(tools, ["description"]);
  } catch (err) {
    console.error("[Caveman] Failed to compress tool descriptions:", err);
  }
}

// Format/Clean up Caveman prose (if needed) for readable client output
export function deCavemanize(text: string): string {
  return text.trim();
}
