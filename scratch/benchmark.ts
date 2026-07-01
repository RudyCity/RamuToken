import { compressSerena } from "../server/pipelines/serena";
import { compressHeadroom } from "../server/pipelines/headroom";

// Sample TS code block for Serena
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

// Sample JSON and long text for Headroom
const headroomText = `
Here is some JSON configuration:
\`\`\`json
{
  "name": "Production Server Configuration",
  "version": "4.2.1",
  "metadata": {
    "ip_address": "192.168.1.100",
    "id_token": "abc123xyz_token_secret",
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "tags": ["prod", "web", "primary"],
  "endpoints": [
    { "path": "/api/v1", "active": true, "timeout": null },
    { "path": "/api/v2", "active": false, "timeout": 30 }
  ],
  "empty_object": {},
  "empty_array": []
}
\`\`\`

Here is a very long text block that should trigger Client Context Retrieval (CCR) substitution because it exceeds the minimum character threshold:
\`\`\`text
The quick brown fox jumps over the lazy dog. This is a very long context block designed to exceed the typical minimum character count requirement for the Headroom CCR placeholder replacement. It will be substituted with a short, unique token like {{HR_CCR_X}} and then restored automatically on the return response path from the LLM, saving significant input context tokens in flight.
\`\`\`
`;

console.log("====================================================");
console.log("⚡ RAMUTOKEN PIPELINE OPTIMIZATION BENCHMARK ⚡");
console.log("====================================================\n");

function benchmarkSerena() {
  console.log("--- Running Serena Pipeline Benchmark ---");
  const query = "Explain how computeSum and main work.";
  
  // 1. With Python Symbols (using subprocess)
  const startPy = typeof performance !== "undefined" ? performance.now() : Date.now();
  const resPy = compressSerena(tsCode, query, { minLines: 3, usePythonSymbols: true });
  const endPy = typeof performance !== "undefined" ? performance.now() : Date.now();
  const timePy = endPy - startPy;

  // 2. Without Python Symbols (Fast Local TS AST)
  const startTs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const resTs = compressSerena(tsCode, query, { minLines: 3, usePythonSymbols: false });
  const endTs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const timeTs = endTs - startTs;

  console.log(`[Python Symbols Enabled]  Time: ${timePy.toFixed(2)}ms | Result length: ${resPy.length} chars`);
  console.log(`[Local TS Mode (Default)] Time: ${timeTs.toFixed(2)}ms | Result length: ${resTs.length} chars`);
  console.log(`🚀 Serena Speedup Factor: ${(timePy / timeTs).toFixed(1)}x faster!\n`);
  
  console.log("Compressed Code (Local TS):");
  console.log(resTs.trim());
  console.log("\n-----------------------------------------\n");
}

function benchmarkHeadroom() {
  console.log("--- Running Headroom Pipeline Benchmark ---");
  
  // 1. With Python Headroom (using subprocess)
  const startPy = typeof performance !== "undefined" ? performance.now() : Date.now();
  const resPy = compressHeadroom(headroomText, { minCcrLength: 150, usePython: true });
  const endPy = typeof performance !== "undefined" ? performance.now() : Date.now();
  const timePy = endPy - startPy;

  // 2. Without Python Headroom (Fast Local TS)
  const startTs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const resTs = compressHeadroom(headroomText, { minCcrLength: 150, usePython: false });
  const endTs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const timeTs = endTs - startTs;

  console.log(`[Python Headroom Enabled] Time: ${timePy.toFixed(2)}ms | Result length: ${resPy.text.length} chars`);
  console.log(`[Local TS Mode (Default)] Time: ${timeTs.toFixed(2)}ms | Result length: ${resTs.text.length} chars`);
  console.log(`🚀 Headroom Speedup Factor: ${(timePy / timeTs).toFixed(1)}x faster!\n`);

  console.log("Compressed Text (Local TS):");
  console.log(resTs.text.trim());
  console.log("\nCCR Mappings generated:", Object.keys(resTs.mapping));
  console.log("====================================================");
}

benchmarkSerena();
benchmarkHeadroom();
