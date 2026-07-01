/**
 * RTK (Rust Token Killer style) - Log & CLI Compressor
 * Compresses terminal outputs, build logs, and stack traces.
 * Always calls the official rtk CLI tool.
 */

import { spawn } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Stubs for functions previously implemented in TypeScript
export function stripAnsi(text: string): string { return text; }
export function shortenPaths(text: string): string { return text; }
export function collapseRepeatedLogs(text: string, maxConsecutive = 3): string { return text; }
export function pruneStackTraces(text: string): string { return text; }

// Main compression function
export async function compressRTK(text: string, options: { logs?: boolean; paths?: boolean; stacks?: boolean } = {}): Promise<string> {
  const tempDir = join(import.meta.dirname, "../../data");
  const tempFile = join(tempDir, `temp_rtk_${Math.random().toString(36).substring(2, 9)}.txt`);

  return new Promise((resolve) => {
    try {
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
      writeFileSync(tempFile, text, "utf8");

      // Choose log vs read subcommand based on content heuristics
      const isLog = text.includes("INFO:") || text.includes("ERROR:") || text.includes("WARN:") || text.includes("at ") || text.includes("Traceback");
      const cmdArgs = isLog ? ["log", tempFile] : ["read", "-l", "aggressive", tempFile];

      const proc = spawn("rtk", cmdArgs, { shell: true });
      let stdout = "";
      
      proc.stdout!.on("data", (data) => {
        stdout += data.toString("utf8");
      });

      proc.on("close", () => {
        try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
        
        let output = stdout.trim();
        // Remove hook warning banner
        output = output.replace(/\[rtk\].*?\n/g, "").trim();
        resolve(output || text);
      });

      proc.on("error", (err) => {
        console.error("[RTK] Spawning failed:", err);
        try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
        resolve(text);
      });
    } catch (err) {
      console.error("[RTK] Write failed:", err);
      try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
      resolve(text);
    }
  });
}

