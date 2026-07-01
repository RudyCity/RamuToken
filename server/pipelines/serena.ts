/**
 * Serena - Code AST & Symbol-Level Pruner
 * Parses TS/JS and Python files to extract signatures and collapse function/method bodies.
 */

import { spawnSync, spawn } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Extracts alphanumeric word tokens from the user's query
export function extractKeywords(userQuery: string): Set<string> {
  const keywords = new Set<string>();
  const matches = userQuery.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
  if (matches) {
    matches.forEach(m => keywords.add(m));
  }
  return keywords;
}

// Compress TypeScript/JavaScript code
export function compressJS(code: string, keywords: Set<string>, minLinesToPrune = 5): string {
  const lines = code.split("\n");
  const resultLines: string[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for function or method declarations
    // e.g. "function foo(x) {", "async function bar() {", "export const baz = (x) => {"
    // e.g. class methods: "myMethod(a, b) {" or "constructor() {"
    const funcMatch = line.match(/(?:function\s+|const\s+|let\s+|var\s+|class\s+|interface\s+|type\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|:\s*.*=)?\s*(?:\([^)]*\)|<[^>]*>)?\s*(=>|\{)/) 
      || line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/);

    if (funcMatch && line.includes("{")) {
      const name = funcMatch[1];
      
      // If name is a reserved keyword or standard word, don't use it as unique identifier
      const reserved = ["if", "for", "while", "switch", "catch", "function", "class", "const", "let", "var", "import", "export", "return"];
      
      if (!reserved.includes(name)) {
        // We found a function/block start. Let's find its matching closing brace.
        let braceCount = 0;
        const blockLines: string[] = [];
        let j = i;
        
        while (j < lines.length) {
          const l = lines[j];
          blockLines.push(l);
          
          // Count braces
          const opens = (l.match(/\{/g) || []).length;
          const closes = (l.match(/\}/g) || []).length;
          braceCount += opens - closes;
          
          if (braceCount <= 0 && j > i) {
            break;
          }
          j++;
        }

        // If the block is long and the symbol is NOT mentioned in the user query keywords, prune it!
        const blockLength = blockLines.length;
        const shouldPrune = blockLength >= minLinesToPrune && !keywords.has(name);
        
        if (shouldPrune) {
          // Keep the first line (signature)
          const firstLine = lines[i];
          const indent = firstLine.match(/^\s*/)?.[0] || "";
          resultLines.push(firstLine);
          resultLines.push(`${indent}  // ... body compressed (${blockLength} lines prunned) ...`);
          // Keep the last line (closing brace)
          const lastLine = lines[j];
          if (lastLine && j > i) {
            resultLines.push(lastLine);
          }
          i = j + 1;
          continue;
        }
      }
    }
    
    resultLines.push(line);
    i++;
  }
  
  return resultLines.join("\n");
}

// Compress Python code
export function compressPython(code: string, keywords: Set<string>, minLinesToPrune = 5): string {
  const lines = code.split("\n");
  const resultLines: string[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Matches: "def function_name(...):" or "class ClassName:"
    const defMatch = line.match(/^\s*(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    
    if (defMatch) {
      const name = defMatch[1];
      const sigIndent = line.match(/^\s*/)?.[0] || "";
      const sigIndentLen = sigIndent.length;

      // Find the range of the function/class body (lines with deeper indentation)
      let j = i + 1;
      const bodyLines: string[] = [];
      
      while (j < lines.length) {
        const l = lines[j];
        const trimmed = l.trim();
        
        if (trimmed === "") {
          bodyLines.push(l);
          j++;
          continue;
        }
        
        const lineIndent = l.match(/^\s*/)?.[0] || "";
        if (lineIndent.length <= sigIndentLen) {
          break; // Body ended (same or less indentation)
        }
        
        bodyLines.push(l);
        j++;
      }

      const bodyLength = bodyLines.length;
      const shouldPrune = bodyLength >= minLinesToPrune && !keywords.has(name);

      if (shouldPrune) {
        // Push the signature line (which might span multiple lines if backslashes or open parens exist)
        // For simplicity, we just push the signature line we matched
        resultLines.push(line);
        // Push a collapsed indicator
        const nextIndent = sigIndent + "    ";
        resultLines.push(`${nextIndent}pass  # ... body compressed (${bodyLength} lines prunned) ...`);
        
        // Skip the body lines in the loop
        i = j;
        continue;
      }
    }
    
    resultLines.push(line);
    i++;
  }
  
  return resultLines.join("\n");
}

interface CodeBlock {
  name: string;
  lines: string[];
}

const getJSBlocks = (code: string): CodeBlock[] => {
  const lines = code.split("\n");
  const blocks: CodeBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const funcMatch = line.match(/(?:function\s+|const\s+|let\s+|var\s+|class\s+|interface\s+|type\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|:\s*.*=)?\s*(?:\([^)]*\)|<[^>]*>)?\s*(=>|\{)/) 
      || line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/);
    if (funcMatch && line.includes("{")) {
      const name = funcMatch[1];
      const reserved = ["if", "for", "while", "switch", "catch", "function", "class", "const", "let", "var", "import", "export", "return"];
      if (!reserved.includes(name)) {
        let braceCount = 0;
        const blockLines: string[] = [];
        let j = i;
        while (j < lines.length) {
          const l = lines[j];
          blockLines.push(l);
          const opens = (l.match(/\{/g) || []).length;
          const closes = (l.match(/\}/g) || []).length;
          braceCount += opens - closes;
          if (braceCount <= 0 && j > i) {
            break;
          }
          j++;
        }
        blocks.push({ name, lines: blockLines });
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return blocks;
};

const getPythonBlocks = (code: string): CodeBlock[] => {
  const lines = code.split("\n");
  const blocks: CodeBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const defMatch = line.match(/^\s*(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (defMatch) {
      const name = defMatch[1];
      const sigIndent = line.match(/^\s*/)?.[0] || "";
      const sigIndentLen = sigIndent.length;
      let j = i + 1;
      const blockLines: string[] = [line];
      while (j < lines.length) {
        const l = lines[j];
        const trimmed = l.trim();
        if (trimmed === "") {
          blockLines.push(l);
          j++;
          continue;
        }
        const lineIndent = l.match(/^\s*/)?.[0] || "";
        if (lineIndent.length <= sigIndentLen) {
          break;
        }
        blockLines.push(l);
        j++;
      }
      blocks.push({ name, lines: blockLines });
      i = j;
      continue;
    }
    i++;
  }
  return blocks;
};

export function resolveDependencies(code: string, keywords: Set<string>, isPython: boolean): Set<string> {
  const activeKeywords = new Set(keywords);
  const blocks = isPython ? getPythonBlocks(code) : getJSBlocks(code);
  if (blocks.length === 0) return activeKeywords;

  const declaredNames = new Set(blocks.map(b => b.name));

  let newKeywordsAdded = true;
  let depth = 0;
  const maxDepth = 5;

  while (newKeywordsAdded && depth < maxDepth) {
    newKeywordsAdded = false;
    depth++;

    for (const block of blocks) {
      if (activeKeywords.has(block.name)) {
        const blockText = block.lines.join("\n");
        const words = blockText.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (words) {
          for (const word of words) {
            if (declaredNames.has(word) && !activeKeywords.has(word)) {
              activeKeywords.add(word);
              newKeywordsAdded = true;
            }
          }
        }
      }
    }
  }

  return activeKeywords;
}

function serenaGetSymbols(filePath: string, projectDir: string): Array<{ name: string; start_line: number; end_line: number; kind: string }> | null {
  try {
    const scriptPath = join(import.meta.dirname, "get_symbols.py");
    const proc = spawnSync("python", [scriptPath, projectDir, filePath], {
      encoding: "utf-8",
      timeout: 15_000
    });

    if (proc.status === 0 && proc.stdout) {
      return JSON.parse(proc.stdout.trim());
    }
  } catch { /* serena not installed — return null */ }
  return null;
}

/**
 * Prune code lines using Serena symbol map:
 * Remove bodies of symbols NOT referenced by keyword set, keep only signature + closing brace.
 */
function pruneBySerenaSymbols(
  code: string,
  symbols: Array<{ name: string; start_line: number; end_line: number; kind: string }>,
  keywords: Set<string>,
  minLines: number
): string {
  const lines = code.split("\n");

  // Build a sorted set of line ranges to prune (0-indexed)
  const pruneRanges: Array<{ from: number; to: number; name: string }> = [];
  for (const sym of symbols) {
    const bodyLen = sym.end_line - sym.start_line;
    if (bodyLen >= minLines && !keywords.has(sym.name)) {
      // Keep first line (signature) and last line (closing brace), prune the body in between
      if (sym.start_line + 1 < sym.end_line - 1) {
        pruneRanges.push({ from: sym.start_line, to: sym.end_line - 1, name: sym.name });
      }
    }
  }
  // Sort descending so we can splice without invalidating indices
  pruneRanges.sort((a, b) => b.from - a.from);

  const result = [...lines];
  for (const range of pruneRanges) {
    const prunedCount = range.to - range.from - 1;
    if (prunedCount > 0) {
      result.splice(range.from + 1, prunedCount,
        `  // ... body compressed by Serena (${prunedCount} lines) ...`
      );
    }
  }
  return result.join("\n");
}

// Main Serena compressor
export function compressSerena(text: string, userQuery: string, options: { minLines?: number } = {}): string {
  const minLines = options.minLines ?? 5;
  const initialKeywords = extractKeywords(userQuery);

  // Deep integration: write each code block to a temp file, ask serena-mcp-server for symbol overview,
  // prune irrelevant functions by their exact line spans reported by the LSP backend.
  const tempDir = join(import.meta.dirname, "../../data");
  const codeBlockRegex = /```(typescript|javascript|js|ts|python|py)\n([\s\S]*?)```/g;

  return text.replace(codeBlockRegex, (match, lang, code) => {
    const isPython = lang === "python" || lang === "py";
    const ext = isPython ? ".py" : ".ts";
    const tempFile = join(tempDir, `temp_serena_${Math.random().toString(36).substring(2, 9)}${ext}`);

    try {
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
      writeFileSync(tempFile, code, "utf8");

      // Ask Serena MCP server for symbol map of the temp file
      const symbols = serenaGetSymbols(tempFile, tempDir);
      if (symbols && symbols.length > 0) {
        const keywords = resolveDependencies(code, initialKeywords, isPython);
        const pruned = pruneBySerenaSymbols(code, symbols, keywords, minLines);
        return `\`\`\`${lang}\n${pruned}\`\`\``;
      }
    } catch { /* fall through to local pruner */ } finally {
      try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
    }

    // Fallback: custom AST-style local pruner
    const keywords = resolveDependencies(code, initialKeywords, isPython);
    const compressedCode = isPython
      ? compressPython(code, keywords, minLines)
      : compressJS(code, keywords, minLines);
    return `\`\`\`${lang}\n${compressedCode}\`\`\``;
  });
}

