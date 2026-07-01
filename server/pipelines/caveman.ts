// @ts-ignore
import { compress } from "caveman-shrink/compress";

/**
 * Faithfully reproduced from the JuliusBrussee/caveman SKILL.md files:
 * - low  → "lite" mode: strip filler phrases
 * - medium → "full" mode: default caveman compression
 * - high → "ultra" mode: telegraphic caveman, max compression
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
- Token budget: critical. Every word must earn its place.`
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
function cavemanShrink(text: string, level: string): string | null {
  try {
    const result = compress(text);
    return result.compressed;
  } catch {
    return null;
  }
}


// Injects the caveman instruction into the request messages
export function injectCavemanPrompt(messages: Message[], level: "low" | "medium" | "high" = "medium"): Message[] {
  const result = [...messages];
  const systemMsgIdx = result.findIndex(m => m.role === "system");
  const instruction = CAVEMAN_INSTRUCTIONS[level] ?? CAVEMAN_INSTRUCTIONS.medium;

  if (systemMsgIdx !== -1) {
    const originalContent = result[systemMsgIdx].content;

    // Don't double-inject
    if (originalContent.includes("[CAVEMAN")) return result;

    // Deep integration: try to compress the entire existing system prompt via caveman-shrink
    const shrunkContent = cavemanShrink(originalContent, level);
    const finalContent = shrunkContent ?? originalContent;

    result[systemMsgIdx] = {
      ...result[systemMsgIdx],
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

// Compresses any arbitrary prose string using caveman-shrink (useful for compressing assistant content)
export function cavemanCompressProse(text: string, level: "low" | "medium" | "high" = "medium"): string {
  return cavemanShrink(text, level) ?? text;
}

// Format/Clean up Caveman prose (if needed) for readable client output
export function deCavemanize(text: string): string {
  return text.trim();
}
