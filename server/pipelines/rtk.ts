/**
 * RTK (Rust Token Killer style) - Log & CLI Compressor
 * Compresses terminal outputs, build logs, and stack traces.
 */

// Strip ANSI escape codes (colors, styling, cursor movements)
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

// Shorten absolute file paths to relative/basename paths
export function shortenPaths(text: string): string {
  // Matches typical Windows/Unix absolute paths in code/logs
  // e.g., C:\Users\USER\projects\app\src\index.ts -> .\src\index.ts
  // e.g., /Users/user/projects/app/src/index.ts -> ./src/index.ts
  const winPathRegex = /[A-Z]:\\[^\s)]+/g;
  const unixPathRegex = /\/[a-zA-Z0-9_-]+\/[^\s)]+/g;

  let result = text;

  // Function to get a relative-looking path
  const normalizePath = (p: string) => {
    const parts = p.split(/[/\\]/);
    if (parts.length > 3) {
      // Keep last 3 parts
      return (p.includes("\\") ? ".\\" : "./") + parts.slice(-3).join(p.includes("\\") ? "\\" : "/");
    }
    return p;
  };

  result = result.replace(winPathRegex, (match) => normalizePath(match));
  result = result.replace(unixPathRegex, (match) => normalizePath(match));

  return result;
}

// Collapse repeated consecutive log lines
export function collapseRepeatedLogs(text: string, maxConsecutive = 3): string {
  const lines = text.split("\n");
  const resultLines: string[] = [];
  
  let repeatCount = 0;
  let lastPattern: string | null = null;
  let lastRawLine = "";

  // Helper to abstract dynamic elements like timestamps, hex addresses, numbers
  // e.g., "2026-07-01 08:35:42 INFO Request completed in 12ms" -> "INFO Request completed in ms"
  const getPattern = (line: string): string => {
    return line
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:?\d{2}|Z)?/g, "[TIME]")
      .replace(/\b0x[a-fA-F0-9]+\b/g, "[HEX]")
      .replace(/\d+(?:\.\d+)?/g, "[NUM]")
      .trim();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pattern = getPattern(line);

    if (pattern && pattern === lastPattern) {
      repeatCount++;
    } else {
      if (repeatCount > maxConsecutive) {
        resultLines.push(`... [repeated ${repeatCount - maxConsecutive + 1} times: ${lastRawLine.trim().substring(0, 80)}]`);
      } else if (repeatCount > 1) {
        // Append the actual repeated lines if below threshold
        for (let r = 1; r < repeatCount; r++) {
          resultLines.push(lastRawLine);
        }
      }
      resultLines.push(line);
      repeatCount = 1;
      lastPattern = pattern || null;
      lastRawLine = line;
    }
  }

  // Flush remaining repeats
  if (repeatCount > maxConsecutive) {
    resultLines.push(`... [repeated ${repeatCount - maxConsecutive + 1} times: ${lastRawLine.trim().substring(0, 80)}]`);
  } else if (repeatCount > 1) {
    for (let r = 1; r < repeatCount; r++) {
      resultLines.push(lastRawLine);
    }
  }

  return resultLines.join("\n");
}

// Collapse stack traces to keep first 3 and last 2 frames
export function pruneStackTraces(text: string): string {
  const lines = text.split("\n");
  const resultLines: string[] = [];
  
  let inStackTrace = false;
  let currentTrace: string[] = [];

  const isStackTraceLine = (line: string): boolean => {
    const trimmed = line.trim();
    // JS/TS stack frame e.g. "at Object.foo (index.js:1:2)" or "at index.js:1:2"
    // Python stack frame e.g. "File \"foo.py\", line 12, in <module>"
    return trimmed.startsWith("at ") || trimmed.startsWith("File \"") || (trimmed.startsWith("Traceback (") && trimmed.endsWith(":"));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isStackTraceLine(line)) {
      inStackTrace = true;
      currentTrace.push(line);
    } else {
      if (inStackTrace) {
        // We exited a stack trace block, process it
        processStackTrace(currentTrace, resultLines);
        currentTrace = [];
        inStackTrace = false;
      }
      resultLines.push(line);
    }
  }

  if (inStackTrace) {
    processStackTrace(currentTrace, resultLines);
  }

  return resultLines.join("\n");
}

function processStackTrace(trace: string[], target: string[]) {
  if (trace.length <= 6) {
    target.push(...trace);
  } else {
    // Keep first 3
    target.push(...trace.slice(0, 3));
    // Truncate message
    target.push(`    ... [truncated ${trace.length - 5} stack frames]`);
    // Keep last 2
    target.push(...trace.slice(-2));
  }
}

// Main compression function
export function compressRTK(text: string, options: { logs?: boolean; paths?: boolean; stacks?: boolean } = {}): string {
  const opts = { logs: true, paths: true, stacks: true, ...options };
  let result = stripAnsi(text);
  
  if (opts.stacks) {
    result = pruneStackTraces(result);
  }
  if (opts.logs) {
    result = collapseRepeatedLogs(result);
  }
  if (opts.paths) {
    result = shortenPaths(result);
  }
  
  return result;
}
