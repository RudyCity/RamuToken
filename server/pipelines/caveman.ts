/**
 * Caveman - Response Style Prompt Injector
 * Deep integration with JuliusBrussee/caveman:
 *  1. Try `npx caveman-shrink --level <level>` (caveman-shrink MCP proxy) to compress system prompts directly.
 *  2. Try `npx -y caveman --level <level>` for the full caveman skill runner.
 *  3. Fallback to embedded SKILL.md faithful reproductions of the real caveman instructions.
 */

import { spawnSync } from "child_process";

/**
 * Faithfully reproduced from the JuliusBrussee/caveman SKILL.md files:
 * - low  → "lite" mode: strip filler phrases
 * - medium → "full" mode: default caveman compression
 * - high → "ultra" mode: telegraphic caveman, max compression
 */
export const CAVEMAN_INSTRUCTIONS: Record<string, string> = {
  low: `[CAVEMAN LITE]
Compress output. Remove these filler phrases: "Certainly!", "Of course!", "I'd be happy to", "Sure!", "Absolutely!", "Great!", "I understand", "I'll", "I will", "Let me", "This means that", "It's worth noting", "It is important to note". Reply directly. Omit intro sentences. Keep technical accuracy. No greetings.`,

  medium: `[CAVEMAN MODE: FULL]
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

  high: `[CAVEMAN ULTRA]
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
Token budget: critical. Every word must earn its place.`
};

export interface Message {
  role: string;
  content: string;
  name?: string;
  cache_control?: any;
}

/**
 * Maps our level names to caveman-shrink CLI level names.
 * caveman-shrink uses: lite | full | ultra
 */
const LEVEL_MAP: Record<string, string> = {
  low: "lite",
  medium: "full",
  high: "ultra"
};

/**
 * Attempts to invoke caveman-shrink (the MCP proxy from JuliusBrussee/caveman)
 * to compress a single system prompt text.
 * caveman-shrink accepts text via stdin and outputs compressed text on stdout.
 */
function cavemanShrink(text: string, level: string): string | null {
  const shrinkLevel = LEVEL_MAP[level] ?? "full";
  const commands = [
    ["caveman-shrink", ["--level", shrinkLevel]],
    ["npx", ["-y", "caveman-shrink", "--level", shrinkLevel]],
  ] as const;

  for (const [cmd, args] of commands) {
    try {
      const proc = spawnSync(cmd, args, {
        input: text,
        encoding: "utf-8",
        timeout: 15_000,
        shell: true
      });
      if (proc.status === 0 && proc.stdout) {
        return proc.stdout.trimEnd();
      }
    } catch { /* try next */ }
  }
  return null;
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
