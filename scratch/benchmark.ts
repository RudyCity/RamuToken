import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { compressSerena } from "../server/pipelines/serena";
import { compressHeadroom } from "../server/pipelines/headroom";
import { compressRTK } from "../server/pipelines/rtk";
import { pythonDaemon, getPythonCommand } from "../server/pipelines/python_daemon";

const tsCode = `
\`\`\`typescript
export function computeSum(a: number, b: number): number {
  console.log("Computing sum...");
  const sum = a + b;
  console.log("Result:", sum);
  return sum;
}

export function unusedHelperFunction() {
  console.log("This helper is unused and has a long body...");
  const data = [1, 2, 3, 4, 5];
  const processed = data.map(x => x * 2).filter(x => x > 5);
  console.log("Processed:", processed);
  return processed;
}

export function main() {
  console.log("Main function starting...");
  const result = computeSum(10, 20);
  console.log("Final outcome:", result);
}
\`\`\`
`;

const headroomText = `
Here is a very long text block that should trigger headroom-ai context compression because it is lengthy:
\`\`\`text
The quick brown fox jumps over the lazy dog. This is a very long context block designed to exceed the typical minimum character count requirement for the Headroom context compression. It will be compressed by the official headroom library, saving significant input context tokens in flight.
\`\`\`
`;

console.log("====================================================");
console.log("⚡ RAMUTOKEN OFFICIAL PIPELINES DAEMON BENCHMARK ⚡");
console.log("====================================================\n");

// Unoptimized Serena: spawns python get_symbols.py synchronously
function unoptimizedSerena(tempFile: string, tempDir: string): any {
  const scriptPath = join(import.meta.dirname, "../server/pipelines/get_symbols.py");
  const pythonCmd = getPythonCommand();
  const proc = spawnSync(pythonCmd, [scriptPath, tempDir, tempFile], {
    encoding: "utf-8",
    timeout: 15000
  });
  if (proc.status === 0 && proc.stdout) {
    return JSON.parse(proc.stdout.trim());
  }
  throw new Error("Unoptimized Serena process failed: " + proc.stderr);
}

// Unoptimized Headroom: spawns python -c directly
function unoptimizedHeadroom(text: string): string {
  const pythonScript = [
    "import sys, json",
    "from headroom import compress",
    "inp = sys.stdin.read()",
    "msgs = [{'role': 'user', 'content': inp}]",
    "result = compress(msgs)",
    "print(result.messages[0]['content'] if result and hasattr(result, 'messages') and result.messages else inp)"
  ].join("; ");

  const pythonCmd = getPythonCommand();
  const proc = spawnSync(pythonCmd, ["-c", pythonScript], {
    input: text,
    encoding: "utf-8",
    timeout: 15000
  });
  if (proc.status === 0 && proc.stdout) {
    return proc.stdout.trimEnd();
  }
  throw new Error("Unoptimized Headroom process failed: " + proc.stderr);
}

async function runBenchmark() {
  // --- SERENA BENCHMARK ---
  console.log("--- Running Serena (LSP Symbols) ---");
  const query = "Explain how computeSum works.";
  const tempDir = join(import.meta.dirname, "../data");
  const tempFile = join(tempDir, "temp_serena_bench.ts");

  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  writeFileSync(tempFile, tsCode, "utf8");

  // 1. Unoptimized (Sync Spawn)
  const startUnoptSerena = performance.now();
  const unoptSerenaRes = unoptimizedSerena(tempFile, tempDir);
  const endUnoptSerena = performance.now();
  const timeUnoptSerena = endUnoptSerena - startUnoptSerena;

  // 2. Optimized (Daemon Request - Cold Run)
  const startOptSerenaCold = performance.now();
  const optSerenaResCold = await compressSerena(tsCode, query, { minLines: 3 });
  const endOptSerenaCold = performance.now();
  const timeOptSerenaCold = endOptSerenaCold - startOptSerenaCold;

  // 3. Optimized (Daemon Request - Hot Runs)
  const hotTimesSerena: number[] = [];
  let optSerenaRes = "";
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    optSerenaRes = await compressSerena(tsCode, query, { minLines: 3 });
    hotTimesSerena.push(performance.now() - start);
  }
  const avgHotTimeSerena = hotTimesSerena.reduce((a, b) => a + b, 0) / hotTimesSerena.length;

  try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch {}

  console.log(`[Unoptimized Sync Spawn]       Time: ${timeUnoptSerena.toFixed(2)}ms`);
  console.log(`[Daemon Cold Run (LSP Boot)]   Time: ${timeOptSerenaCold.toFixed(2)}ms`);
  console.log(`[Daemon Hot Run (Subsequent)]  Time: ${avgHotTimeSerena.toFixed(2)}ms`);
  console.log(`🚀 Serena Speedup (Hot Run):   ${(timeUnoptSerena / avgHotTimeSerena).toFixed(1)}x faster!\n`);

  console.log("Compressed Code Output:");
  console.log(optSerenaRes.trim());
  console.log("\n-----------------------------------------\n");

  // --- HEADROOM BENCHMARK ---
  console.log("--- Running Headroom (compress) ---");

  // 1. Unoptimized (Sync Spawn)
  const startUnoptHr = performance.now();
  const unoptHrRes = unoptimizedHeadroom(headroomText);
  const endUnoptHr = performance.now();
  const timeUnoptHr = endUnoptHr - startUnoptHr;

  // 2. Optimized (Daemon Request - Cold Run)
  const startOptHrCold = performance.now();
  const optHrResCold = await compressHeadroom(headroomText);
  const endOptHrCold = performance.now();
  const timeOptHrCold = endOptHrCold - startOptHrCold;

  // 3. Optimized (Daemon Request - Hot Runs)
  const hotTimesHr: number[] = [];
  let optHrRes: any = null;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    optHrRes = await compressHeadroom(headroomText);
    hotTimesHr.push(performance.now() - start);
  }
  const avgHotTimeHr = hotTimesHr.reduce((a, b) => a + b, 0) / hotTimesHr.length;

  console.log(`[Unoptimized Sync Spawn]       Time: ${timeUnoptHr.toFixed(2)}ms`);
  console.log(`[Daemon Cold Run (LSP Boot)]   Time: ${timeOptHrCold.toFixed(2)}ms`);
  console.log(`[Daemon Hot Run (Subsequent)]  Time: ${avgHotTimeHr.toFixed(2)}ms`);
  console.log(`🚀 Headroom Speedup (Hot Run): ${(timeUnoptHr / avgHotTimeHr).toFixed(1)}x faster!\n`);

  console.log("Compressed Text Output:");
  console.log(optHrRes.text.trim());
  console.log("\n-----------------------------------------\n");

  // --- RTK BENCHMARK ---
  console.log("--- Running RTK (CLI Log/Read) ---");
  const logInput = "INFO: app processing\nINFO: app processing\nINFO: app processing\nError at C:\\Users\\User\\src\\index.ts";
  const startRtk = performance.now();
  const rtkRes = await compressRTK(logInput);
  const endRtk = performance.now();
  const timeRtk = endRtk - startRtk;

  console.log(`[RTK CLI Execution] Time: ${timeRtk.toFixed(2)}ms`);
  console.log("RTK Output:");
  console.log(rtkRes);
  console.log("====================================================");

  pythonDaemon.shutdown();
}

runBenchmark().catch(console.error);
