/**
 * Headroom - Structural, JSON, and Reversible Context Compression
 * Minifies JSON, prunes meta fields, and replaces long context blocks with reversible tokens.
 */

// Memory registry for CCR (Client Context Retrieval) mappings
// Map: placeholder -> original content
const ccrRegistry = new Map<string, string>();
let ccrCounter = 0;

export function getRegistry() {
  return ccrRegistry;
}

export function clearRegistry() {
  ccrRegistry.clear();
  ccrCounter = 0;
}

// Minifies JSON blocks in markdown or raw JSON strings
export function minifyJSON(text: string): string {
  // Matches ```json ... ```
  const jsonBlockRegex = /```json\n([\s\S]*?)```/g;
  
  let result = text.replace(jsonBlockRegex, (match, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const minified = JSON.stringify(parsed);
      return `\`\`\`json\n${minified}\n\`\`\``;
    } catch {
      // If parsing fails, fall back to simple regex whitespace stripping
      const cleaned = jsonStr.replace(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/g, "");
      return `\`\`\`json\n${cleaned}\n\`\`\``;
    }
  });

  return result;
}

// Prunes non-essential fields from JSON strings (nulls, empty arrays, blacklisted keys)
export function pruneJSONFields(text: string, blacklist: string[] = ["metadata", "id_token"]): string {
  const jsonBlockRegex = /```json\n([\s\S]*?)```/g;

  const cleanObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(cleanObject).filter(item => {
        // filter out nulls or empty objects/arrays from arrays
        if (item === null) return false;
        if (typeof item === "object" && Object.keys(item).length === 0) return false;
        return true;
      });
    } else if (obj !== null && typeof obj === "object") {
      const newObj: any = {};
      for (const key in obj) {
        if (blacklist.includes(key)) {
          continue; // Strip blacklisted key
        }
        const val = obj[key];
        if (val === null || val === undefined) {
          continue; // Strip nulls
        }
        if (Array.isArray(val) && val.length === 0) {
          continue; // Strip empty arrays
        }
        if (typeof val === "object" && Object.keys(val).length === 0) {
          continue; // Strip empty objects
        }
        newObj[key] = cleanObject(val);
      }
      return newObj;
    }
    return obj;
  };

  return text.replace(jsonBlockRegex, (match, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const cleaned = cleanObject(parsed);
      return `\`\`\`json\n${JSON.stringify(cleaned)}\n\`\`\``;
    } catch {
      return match; // Fallback to original
    }
  });
}

// Reversible Context Substitution (CCR)
// Replaces long text blocks (> threshold) with a placeholder {{HR_CCR_X}}
export function compressCCR(text: string, minLength = 300): { compressedText: string; mapping: Record<string, string> } {
  const mapping: Record<string, string> = {};
  
  // Find markdown code blocks or long paragraphs
  // Matches ```lang ... ``` OR large paragraphs of text
  const blockRegex = /(```[a-zA-Z0-9_-]*\n[\s\S]*?\n```)/g;
  
  let compressedText = text.replace(blockRegex, (match) => {
    if (match.length >= minLength) {
      const placeholder = `{{HR_CCR_${ccrCounter++}}}`;
      ccrRegistry.set(placeholder, match);
      mapping[placeholder] = match;
      return placeholder;
    }
    return match;
  });

  return { compressedText, mapping };
}

// Restores any placeholder tokens in the LLM response back to their original text
export function restoreCCR(responseText: string): string {
  let restored = responseText;
  
  // Iterate and replace keys in response
  ccrRegistry.forEach((originalValue, placeholder) => {
    if (restored.includes(placeholder)) {
      restored = restored.replaceAll(placeholder, originalValue);
    }
  });

  return restored;
}

// Main Headroom compressor
export function compressHeadroom(
  text: string, 
  options: { minify?: boolean; prune?: boolean; ccr?: boolean; blacklist?: string[]; minCcrLength?: number } = {}
): { text: string; mapping: Record<string, string> } {
  const opts = { minify: true, prune: true, ccr: true, blacklist: ["metadata", "id_token"], minCcrLength: 300, ...options };
  
  let result = text;
  
  if (opts.prune) {
    result = pruneJSONFields(result, opts.blacklist);
  }
  if (opts.minify) {
    result = minifyJSON(result);
  }
  
  let ccrMapping: Record<string, string> = {};
  if (opts.ccr) {
    const ccrResult = compressCCR(result, opts.minCcrLength);
    result = ccrResult.compressedText;
    ccrMapping = ccrResult.mapping;
  }
  
  return { text: result, mapping: ccrMapping };
}
