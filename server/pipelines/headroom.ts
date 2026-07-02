/**
 * Headroom - Structural, JSON, and Reversible Context Compression
 * Minifies JSON, prunes meta fields, and replaces long context blocks.
 * Always calls the official headroom-ai package.
 */

import { spawnSync } from "child_process";
import { pythonDaemon } from "./python_daemon";

const ccrRegistry = new Map<string, string>();
export function getRegistry() { return ccrRegistry; }
export function clearRegistry() { ccrRegistry.clear(); }

function getHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

function pruneObject(obj: any, blacklist: string[]): any {
  if (Array.isArray(obj)) {
    return obj
      .map(item => pruneObject(item, blacklist))
      .filter(item => {
        if (item === null || item === undefined || item === "") return false;
        if (Array.isArray(item) && item.length === 0) return false;
        if (typeof item === "object" && Object.keys(item).length === 0) return false;
        return true;
      });
  } else if (obj !== null && typeof obj === "object") {
    const prunedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (blacklist.includes(key)) continue;
      const prunedValue = pruneObject(value, blacklist);
      if (prunedValue === null || prunedValue === undefined || prunedValue === "") continue;
      if (Array.isArray(prunedValue) && prunedValue.length === 0) continue;
      if (typeof prunedValue === "object" && Object.keys(prunedValue).length === 0) continue;
      prunedObj[key] = prunedValue;
    }
    return prunedObj;
  }
  return obj;
}

export function restoreCCR(responseText: string): string {
  if (!responseText) return responseText;
  let restored = responseText;
  let found = true;
  let passes = 0;
  while (found && passes < 10) {
    found = false;
    passes++;
    for (const [placeholder, originalText] of ccrRegistry.entries()) {
      if (restored.includes(placeholder)) {
        restored = restored.replaceAll(placeholder, originalText);
        found = true;
      }
    }
  }
  return restored;
}

export function minifyJSON(text: string): string {
  const trimmed = text.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {}
  }

  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
  return text.replace(jsonBlockRegex, (match, jsonContent) => {
    try {
      const parsed = JSON.parse(jsonContent.trim());
      return `\`\`\`json\n${JSON.stringify(parsed)}\n\`\`\``;
    } catch {
      return match;
    }
  });
}

export function pruneJSONFields(text: string, blacklist: string[] = []): string {
  const trimmed = text.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      const pruned = pruneObject(parsed, blacklist);
      return JSON.stringify(pruned);
    } catch {}
  }

  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
  return text.replace(jsonBlockRegex, (match, jsonContent) => {
    try {
      const parsed = JSON.parse(jsonContent.trim());
      const pruned = pruneObject(parsed, blacklist);
      return `\`\`\`json\n${JSON.stringify(pruned)}\n\`\`\``;
    } catch {
      return match;
    }
  });
}

// Default Headroom proxy port (headroom proxy --port 8787)
const HEADROOM_PROXY_PORT = 8787;

async function headroomViaProxy(text: string): Promise<string | null> {
  try {
    const payload = {
      model: "gpt-4o",
      messages: [{ role: "user", content: text }]
    };
    const response = await fetch(`http://127.0.0.1:${HEADROOM_PROXY_PORT}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer headroom-proxy" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return null;
    const json: any = await response.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// Main Headroom compressor
export async function compressHeadroom(
  text: string, 
  options: { minify?: boolean; prune?: boolean; ccr?: boolean; blacklist?: string[]; minCcrLength?: number } = {}
): Promise<{ text: string; mapping: Record<string, string> }> {
  // Deep integration approach 2: headroom proxy HTTP (if already running on port 8787)
  const proxyResult = await headroomViaProxy(text);
  if (proxyResult !== null) {
    return { text: proxyResult, mapping: {} };
  }

  // Deep integration approach 1: Python headroom-ai library via Daemon
  try {
    const compressed = await pythonDaemon.request("headroom", { text });
    if (compressed !== text) {
      return { text: compressed, mapping: {} };
    }
  } catch (err) {
    console.error("[Headroom] Daemon compression error:", err);
  }

  // Fallback Approach: Native TypeScript implementation
  let processedText = text;
  const mapping: Record<string, string> = {};

  if (options.prune) {
    processedText = pruneJSONFields(processedText, options.blacklist);
  } else if (options.minify) {
    processedText = minifyJSON(processedText);
  }

  if (options.ccr) {
    const minLen = options.minCcrLength ?? 200;
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n```/g;
    processedText = processedText.replace(codeBlockRegex, (match, lang, content) => {
      if (content.length >= minLen) {
        const placeholder = `{{HR_CCR_${getHash(content)}}}`;
        ccrRegistry.set(placeholder, match);
        mapping[placeholder] = match;
        return placeholder;
      }
      return match;
    });
  }

  return { text: processedText, mapping };
}

