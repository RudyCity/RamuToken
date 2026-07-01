/**
 * Caveman - Response Style Prompt Injector
 * Injects guidelines into the system prompt to force the LLM to output in a highly compressed style.
 */

export const CAVEMAN_INSTRUCTIONS = {
  low: "[CAVEMAN MODE: LOW] Omit polite greetings, introductions, and generic helpful statements. Reply directly to the query with minimal preamble.",
  medium: "[CAVEMAN MODE: MEDIUM] Omit pronouns, polite greetings, and generic helpful statements. Keep responses direct and concise. Never explain code blocks unless explicitly requested.",
  high: "[CAVEMAN MODE: HIGH] Speak like caveman. Avoid pronouns, articles (the, a, an), polite greetings, and verbose explanations. Use keywords and direct code blocks. Never explain code unless asked. Keep prose to absolute minimum. Save tokens."
};

export interface Message {
  role: string;
  content: string;
  name?: string;
  cache_control?: any;
}

// Injects the caveman instruction into the request messages
export function injectCavemanPrompt(messages: Message[], level: "low" | "medium" | "high" = "medium"): Message[] {
  const result = [...messages];
  const systemMsgIdx = result.findIndex(m => m.role === "system");
  const instruction = CAVEMAN_INSTRUCTIONS[level] || CAVEMAN_INSTRUCTIONS.medium;

  if (systemMsgIdx !== -1) {
    // Append to existing system prompt
    const originalContent = result[systemMsgIdx].content;
    
    // Ensure we don't double inject
    if (!originalContent.includes("[CAVEMAN MODE")) {
      result[systemMsgIdx] = {
        ...result[systemMsgIdx],
        content: `${originalContent}\n\n${instruction}`
      };
    }
  } else {
    // Prepend a new system prompt
    result.unshift({
      role: "system",
      content: instruction
    });
  }

  return result;
}

// Format/Clean up Caveman prose (if needed) for readable client output
// In true Caveman style, we want to keep the raw short output, but we can do simple cleanups (like ensuring correct capitals)
export function deCavemanize(text: string): string {
  // Usually, we just return the raw response, but we can clean up trailing commas or spacing issues
  return text.trim();
}
