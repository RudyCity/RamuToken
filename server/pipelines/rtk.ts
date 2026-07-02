/**
 * RTK (Rust Token Killer style) - Log & CLI Compressor
 * Compresses terminal outputs, build logs, and stack traces.
 * Always calls the official rtk CLI tool, downloading it if not present.
 */

import { spawn, spawnSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Stubs for functions previously implemented in TypeScript
export function stripAnsi(text: string): string { return text; }
export function shortenPaths(text: string): string { return text; }
export function collapseRepeatedLogs(text: string, maxConsecutive = 3): string { return text; }
export function pruneStackTraces(text: string): string { return text; }

const tempDir = join(import.meta.dirname, "../../data");
const binDir = join(tempDir, "bin");
const localRtkPath = join(binDir, process.platform === "win32" ? "rtk.exe" : "rtk");

let cachedRtkCmd: string | null = null;
let isDownloading = false;

async function checkRtkGlobal(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn("rtk", ["--version"], { shell: true });
      proc.on("close", (code) => {
        resolve(code === 0);
      });
      proc.on("error", () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function ensureRtkAvailable(): Promise<string> {
  if (cachedRtkCmd) return cachedRtkCmd;

  // 1. Check global
  if (await checkRtkGlobal()) {
    cachedRtkCmd = "rtk";
    return "rtk";
  }

  // 2. Check local
  if (existsSync(localRtkPath)) {
    cachedRtkCmd = localRtkPath;
    return localRtkPath;
  }

  // 3. Download if not already downloading
  if (isDownloading) {
    while (isDownloading) {
      await new Promise(r => setTimeout(r, 500));
    }
    if (existsSync(localRtkPath)) {
      cachedRtkCmd = localRtkPath;
      return localRtkPath;
    }
    throw new Error("RTK not available and download failed");
  }

  isDownloading = true;
  console.log("[RTK] RTK binary not found. Starting automatic download...");
  try {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

    // Fetch latest release info from GitHub
    const res = await fetch("https://api.github.com/repos/rtk-ai/rtk/releases/latest", {
      headers: { "User-Agent": "RamuToken-Setup" }
    });
    if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
    const releaseInfo = await res.json() as any;

    let assetUrl = "";
    if (process.platform === "win32") {
      const asset = releaseInfo.assets.find((a: any) => a.name.includes("windows-msvc") && a.name.endsWith(".zip"));
      if (asset) assetUrl = asset.browser_download_url;
    } else if (process.platform === "darwin") {
      const asset = releaseInfo.assets.find((a: any) => a.name.includes("apple-darwin") && a.name.endsWith(".tar.gz"));
      if (asset) assetUrl = asset.browser_download_url;
    } else if (process.platform === "linux") {
      const asset = releaseInfo.assets.find((a: any) => a.name.includes("unknown-linux") && a.name.endsWith(".tar.gz"));
      if (asset) assetUrl = asset.browser_download_url;
    }

    if (!assetUrl) {
      throw new Error(`No compatible release asset found for platform ${process.platform}`);
    }

    console.log(`[RTK] Downloading RTK from ${assetUrl}...`);
    const downloadRes = await fetch(assetUrl);
    if (!downloadRes.ok) throw new Error(`Failed to download binary: ${downloadRes.statusText}`);
    const arrayBuffer = await downloadRes.arrayBuffer();

    const tempZip = join(tempDir, `rtk_download_${Date.now()}.${process.platform === "win32" ? "zip" : "tar.gz"}`);
    await Bun.write(tempZip, new Uint8Array(arrayBuffer));

    console.log(`[RTK] Extracting to ${binDir}...`);
    if (process.platform === "win32") {
      const extractProc = spawnSync("powershell", [
        "-Command",
        `Expand-Archive -Path '${tempZip}' -DestinationPath '${binDir}' -Force`
      ]);
      if (extractProc.status !== 0) {
        throw new Error(`Failed to extract zip file: ${extractProc.stderr?.toString()}`);
      }
    } else {
      const extractProc = spawnSync("tar", [
        "-xzf", tempZip, "-C", binDir
      ]);
      if (extractProc.status !== 0) {
        throw new Error("Failed to extract tar file");
      }
    }

    try { unlinkSync(tempZip); } catch {}

    if (existsSync(localRtkPath)) {
      console.log("[RTK] RTK binary successfully installed locally.");
      cachedRtkCmd = localRtkPath;
      return localRtkPath;
    } else {
      throw new Error("Extraction completed but binary was not found at expected path");
    }
  } catch (err: any) {
    console.error("[RTK] Auto-installation failed:", err);
    throw err;
  } finally {
    isDownloading = false;
  }
}

// Main compression function
export async function compressRTK(text: string, options: { logs?: boolean; paths?: boolean; stacks?: boolean } = {}): Promise<string> {
  const tempFile = join(tempDir, `temp_rtk_${Math.random().toString(36).substring(2, 9)}.txt`);

  return new Promise((resolve) => {
    try {
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
      writeFileSync(tempFile, text, "utf8");

      // Choose log vs read subcommand based on content heuristics
      const isLog = text.includes("INFO:") || text.includes("ERROR:") || text.includes("WARN:") || text.includes("at ") || text.includes("Traceback");
      const cmdArgs = isLog ? ["log", tempFile] : ["read", "-l", "aggressive", tempFile];

      ensureRtkAvailable()
        .then((rtkCmd) => {
          const proc = spawn(rtkCmd, cmdArgs, { shell: true });
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
            console.error("[RTK] Execution failed:", err);
            try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
            resolve(text);
          });
        })
        .catch((err) => {
          console.error("[RTK] RTK command not available:", err);
          try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
          resolve(text);
        });
    } catch (err) {
      console.error("[RTK] Setup failed:", err);
      try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}
      resolve(text);
    }
  });
}


