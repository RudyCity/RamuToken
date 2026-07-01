import { getEncoding } from "js-tiktoken";

const tokenizer = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  try {
    return tokenizer.encode(text).length;
  } catch {
    // Fallback: estimate 4 characters per token
    return Math.ceil(text.length / 4);
  }
}
