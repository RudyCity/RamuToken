/**
 * Serena - Code AST & Symbol-Level Pruner
 * Parses TS/JS and Python files to extract signatures and collapse function/method bodies.
 */

import { spawnSync, spawn } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { pythonDaemon } from "./python_daemon";

// Extracts alphanumeric word tokens from the user's query
export function extractKeywords(userQuery: string): Set<string> {
  const keywords = new Set<string>();
  const matches = userQuery.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
  if (matches) {
    matches.forEach(m => keywords.add(m));
  }
  return keywords;
}

// Heuristic fallbacks compressJS and compressPython removed. Serena now always uses the Python LSP daemon.

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

interface CodeBlock {
  lang: string;
  code: string;
  isPython: boolean;
  tempFile: string;
  matchStr: string;
}

// Main Serena compressor
export async function compressSerena(text: string, userQuery: string, options: { minLines?: number } = {}): Promise<string> {
  const minLines = options.minLines ?? 5;
  const initialKeywords = extractKeywords(userQuery);
  const codeBlockRegex = /```(typescript|javascript|js|ts|python|py)\n([\s\S]*?)```/g;

  // Extract all code blocks
  const blocks: Array<{ lang: string; code: string; isPython: boolean; tempFile: string; matchStr: string }> = [];
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [matchStr, lang, code] = match;
    const isPython = lang === "python" || lang === "py";
    const ext = isPython ? ".py" : ".ts";
    const tempFile = join(import.meta.dirname, `../../data/temp_serena_${Math.random().toString(36).substring(2, 9)}_${blocks.length}${ext}`);
    blocks.push({ lang, code, isPython, tempFile, matchStr });
  }

  if (blocks.length === 0) return text;

  const tempDir = join(import.meta.dirname, "../../data");
  try {
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
    for (const block of blocks) {
      writeFileSync(block.tempFile, block.code, "utf8");
    }

    const tempPaths = blocks.map(b => b.tempFile);
    // Always request symbols from the python daemon
    const batchSymbolsMap = await pythonDaemon.request("serena", {
      project_root: tempDir,
      file_paths: tempPaths
    });

    let resultText = text;
    for (const block of blocks) {
      const fileSymbols = batchSymbolsMap[block.tempFile];
      if (Array.isArray(fileSymbols) && fileSymbols.length > 0) {
        try {
          const keywords = resolveDependencies(block.code, initialKeywords, block.isPython);
          const prunedCode = pruneBySerenaSymbols(block.code, fileSymbols, keywords, minLines);
          resultText = resultText.replace(block.matchStr, `\`\`\`${block.lang}\n${prunedCode}\`\`\``);
        } catch (err) {
          console.error("[Serena] Failed to prune block symbols:", err);
        }
      }
    }
    return resultText;
  } catch (err) {
    console.error("[Serena] Daemon symbol retrieval error:", err);
    return text;
  } finally {
    // Cleanup all temp files
    for (const block of blocks) {
      try {
        if (existsSync(block.tempFile)) unlinkSync(block.tempFile);
      } catch {}
    }
  }
}

