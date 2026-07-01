import { expect, test, describe, beforeEach } from "bun:test";
import { compressRTK, stripAnsi, collapseRepeatedLogs, shortenPaths, pruneStackTraces } from "../pipelines/rtk";
import { compressSerena, extractKeywords, compressJS, compressPython, resolveDependencies } from "../pipelines/serena";
import { compressHeadroom, restoreCCR, clearRegistry, getRegistry, minifyJSON, pruneJSONFields } from "../pipelines/headroom";
import { injectCavemanPrompt, deCavemanize } from "../pipelines/caveman";
import { generateRequestKey, getCachedResponse, setCachedResponse, clearCache, getCacheSize, preserveCacheControl } from "../pipelines/cache";

describe("RTK Pipeline (Log & CLI Compressor)", () => {
  test("should strip ANSI color escape codes", () => {
    const raw = "\u001b[31mError:\u001b[0m \u001b[1mCommand failed\u001b[0m";
    expect(stripAnsi(raw)).toBe("Error: Command failed");
  });

  test("should collapse repeated consecutive log patterns", () => {
    const logs = [
      "[2026-07-01 08:35:42] INFO: Request completed in 10ms",
      "[2026-07-01 08:35:43] INFO: Request completed in 12ms",
      "[2026-07-01 08:35:44] INFO: Request completed in 9ms",
      "[2026-07-01 08:35:45] INFO: Request completed in 15ms",
      "[2026-07-01 08:35:46] INFO: Request completed in 11ms",
      "[2026-07-01 08:35:47] ERROR: Database timeout"
    ].join("\n");

    const compressed = collapseRepeatedLogs(logs, 2);
    expect(compressed).toContain("INFO: Request completed in");
    expect(compressed).toContain("[repeated 4 times");
    expect(compressed).toContain("Database timeout");
  });

  test("should not collapse logs that repeat less than maxConsecutive", () => {
    const logs = [
      "INFO: Processing",
      "INFO: Processing",
      "ERROR: Timeout"
    ].join("\n");
    const compressed = collapseRepeatedLogs(logs, 3);
    expect(compressed).toBe(logs); // Remains identical
  });

  test("should flush remaining repeated logs at the end of the file", () => {
    const logs = [
      "INFO: Working",
      "INFO: Working",
      "INFO: Working",
      "INFO: Working"
    ].join("\n");
    const compressed = collapseRepeatedLogs(logs, 2);
    expect(compressed).toContain("[repeated 3 times");
  });

  test("should flush remaining non-collapsed repeats at the end of the file", () => {
    const logs = [
      "INFO: Working",
      "INFO: Working"
    ].join("\n");
    const compressed = collapseRepeatedLogs(logs, 3);
    expect(compressed).toBe(logs);
  });

  test("should shorten absolute system file paths and preserve short ones", () => {
    const log = "Error occurred at /Users/username/projects/ramu-token/server/index.ts:45:12";
    expect(shortenPaths(log)).toContain("./ramu-token/server/index.ts");
    
    // Short path should be preserved
    expect(shortenPaths("/usr/bin")).toBe("/usr/bin");
  });

  test("should prune stack traces in the middle and end of file", () => {
    const logWithTrace = [
      "Fatal Error:",
      "  at processRequest (index.ts:45:12)",
      "  at handleRoute (index.ts:102:8)",
      "  at dispatch (express.js:284:7)",
      "  at next (express.js:230:5)",
      "  at checkAuth (auth.ts:12:3)",
      "  at runMicrotasks (<anonymous>)",
      "  at processTicksAndRejections (task_queues:95:5)",
      "  at runNext (index.ts:22:2)",
      "Process exited with code 1"
    ].join("\n");

    const compressed = pruneStackTraces(logWithTrace);
    expect(compressed).toContain("Fatal Error:");
    expect(compressed).toContain("Process exited with code 1");
    expect(compressed).toContain("[truncated 3 stack frames]");
  });

  test("should preserve short stack traces without truncation", () => {
    const shortTrace = [
      "at Object.foo (index.js:1:2)",
      "at index.js:1:2"
    ].join("\n");
    expect(pruneStackTraces(shortTrace)).toBe(shortTrace);
  });

  test("should bypass all filters in compressRTK when disabled in options", () => {
    const text = "Error at C:\\Users\\User\\src\\index.ts\nINFO: Log\nINFO: Log";
    const result = compressRTK(text, { logs: false, paths: false, stacks: false });
    expect(result).toBe(text); // Stays exactly same
  });

  test("should apply all filters in compressRTK when explicitly enabled in options", () => {
    const text = "Error at C:\\Users\\User\\src\\index.ts\nINFO: Log\nINFO: Log";
    const result = compressRTK(text, { logs: true, paths: true, stacks: true });
    expect(result).toContain(".\\User\\src\\index.ts");
  });
});

describe("Serena Pipeline (Code AST & Symbol Pruner)", () => {
  const sampleTS = `
function calculate(x: number): number {
  console.log("Starting calculation");
  const result = x * 2;
  console.log("Calculated:", result);
  return result;
}

function targetFunction() {
  console.log("This is target");
}
  `.trim();

  test("should extract search keywords from query", () => {
    const query = "how to implement targetFunction and foo?";
    const keywords = extractKeywords(query);
    expect(keywords.has("targetFunction")).toBe(true);
    expect(keywords.has("foo")).toBe(true);
    expect(keywords.has("how")).toBe(true);
  });

  test("should prune functions not in keywords and preserve targeted functions", () => {
    const query = "explain targetFunction";
    const wrappedCode = `\`\`\`typescript\n${sampleTS}\n\`\`\``;
    
    const compressed = compressSerena(wrappedCode, query, { minLines: 3 });
    expect(compressed).toContain("body compressed");
    expect(compressed).toContain("This is target");
  });

  test("should handle nested braces and break TS parse loop correctly", () => {
    const nestedCode = `
function outer() {
  if (true) {
    console.log("inner");
  }
}
function inner() {}
    `.trim();
    const keywords = new Set<string>(["inner"]);
    const compressed = compressJS(nestedCode, keywords, 2);
    expect(compressed).toContain("inner()"); // Inner should be preserved
    expect(compressed).toContain("body compressed"); // Outer should be pruned
  });

  test("should compress Python code definitions when not in keywords", () => {
    const pythonCode = [
      "class Worker:",
      "    def work(self):",
      "        print('Working')",
      "        return True",
      "",
      "    def rest(self):",
      "        print('Resting')",
      "        return False"
    ].join("\n");

    const keywords = new Set<string>(["Worker", "work"]);
    const compressed = compressPython(pythonCode, keywords, 2);
    
    // 'rest' is not in keywords, should be collapsed
    expect(compressed).toContain("pass  # ... body compressed");
    // 'work' is in keywords, should be fully preserved
    expect(compressed).toContain("print('Working')");
  });

  test("should recursively resolve caller-callee dependencies", () => {
    const code = [
      "function parent() {",
      "  console.log('parent');",
      "  child();",
      "}",
      "",
      "function child() {",
      "  console.log('child');",
      "}",
      "",
      "function stranger() {",
      "  console.log('stranger');",
      "}"
    ].join("\n");

    const initialKeywords = new Set<string>(["parent"]);
    const resolvedKeywords = resolveDependencies(code, initialKeywords, false);

    expect(resolvedKeywords.has("parent")).toBe(true);
    expect(resolvedKeywords.has("child")).toBe(true); // Dependency resolved
    expect(resolvedKeywords.has("stranger")).toBe(false); // Unrelated block
  });
});

describe("Headroom Pipeline (JSON & Reversible Context CCR)", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("should access and clear CCR registry", () => {
    const registry = getRegistry();
    expect(registry.size).toBe(0);
  });

  test("should minify JSON blocks and handle invalid JSON parsing fallbacks", () => {
    const input = "JSON context:\n```json\n{\n  \"name\": \"App\",\n  \"active\": true\n}\n```";
    const compressed = compressHeadroom(input, { ccr: false }).text;
    expect(compressed).toContain('{"name":"App","active":true}');

    // Test invalid JSON fallback
    const invalidInput = "```json\n{invalidJSON: true,\n```";
    const minifiedInvalid = minifyJSON(invalidInput);
    expect(minifiedInvalid).toContain("invalidJSON");
  });

  test("should prune metadata, nulls, empty arrays and empty objects from JSON", () => {
    const objText = "```json\n" + JSON.stringify({
      name: "Server",
      metadata: { id: 1 },
      items: [null, {}, 42],
      emptyArray: [],
      emptyObject: {}
    }) + "\n```";

    const pruned = pruneJSONFields(objText, ["metadata"]);
    expect(pruned).toContain("Server");
    expect(pruned).not.toContain("metadata");
    expect(pruned).not.toContain("emptyArray");
    expect(pruned).not.toContain("emptyObject");
  });

  test("should fallback in json pruning if JSON parsing throws error", () => {
    const invalidJson = "```json\n{unparsable\n```";
    expect(pruneJSONFields(invalidJson)).toBe(invalidJson);
  });

  test("should substitute long code blocks with a CCR token and restore it", () => {
    const longCode = `
\`\`\`typescript
export function veryLongFunctionName() {
  console.log("This is a very long text block that should exceed the character threshold of 200 characters.");
  console.log("Additional log statement to increase size of this code block to verify CCR substitution.");
  console.log("It will be replaced with a placeholder token that can be reversed later.");
  return true;
}
\`\`\`
    `.trim();

    const input = `Here is the code file:\n${longCode}\nPlease audit it.`;
    const { text: compressedText, mapping } = compressHeadroom(input, { minCcrLength: 100 });
    
    expect(compressedText).toContain("{{HR_CCR_");
    expect(compressedText).not.toContain("veryLongFunctionName");

    const placeholder = Object.keys(mapping)[0];
    const restored = restoreCCR(`Here is my review of the file ${placeholder}: it looks clean.`);
    expect(restored).toContain("veryLongFunctionName");
    expect(restored).not.toContain(placeholder);
  });

  test("should bypass CCR substitution if block is shorter than minCcrLength", () => {
    const shortCode = "```js\nconst x = 1;\n```";
    const compressed = compressHeadroom(shortCode, { minCcrLength: 500 });
    expect(compressed.text).toBe(shortCode);
  });
});

describe("Caveman Pipeline (Prose Compressor)", () => {
  test("should inject caveman instructions into system message", () => {
    const messages = [
      { role: "system", content: "You are a helpful coding assistant." },
      { role: "user", content: "Explain React." }
    ];

    const injected = injectCavemanPrompt(messages, "high");
    expect(injected[0].content).toContain("CAVEMAN MODE: HIGH");
  });

  test("should prepend system message if none exists", () => {
    const messages = [
      { role: "user", content: "Explain React." }
    ];

    const injected = injectCavemanPrompt(messages, "medium");
    expect(injected[0].role).toBe("system");
    expect(injected[0].content).toContain("CAVEMAN MODE: MEDIUM");
  });

  test("should run deCavemanize helper formatting", () => {
    expect(deCavemanize("   Caveman text   ")).toBe("Caveman text");
  });
});

describe("Local Cache Pipeline", () => {
  beforeEach(() => {
    clearCache();
  });

  test("should generate request key deterministically", () => {
    const payload1 = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.5
    };
    
    const payload2 = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.5
    };

    expect(generateRequestKey(payload1)).toBe(generateRequestKey(payload2));
  });

  test("should cache and retrieve response", () => {
    const key = "request_123";
    const responsePayload = { id: "chatcmpl-1", choices: [{ message: { content: "Hi" } }] };

    setCachedResponse(key, responsePayload);
    expect(getCachedResponse(key)).toEqual(responsePayload);
    expect(getCacheSize()).toBe(1);
  });

  test("should invalidate cache entries after TTL expiration", () => {
    const key = "request_123";
    const responsePayload = { id: "chatcmpl-1" };
    
    const originalNow = Date.now;
    try {
      Date.now = () => 1000;
      setCachedResponse(key, responsePayload);

      // Expire the item by advancing time past TTL (5 minutes)
      Date.now = () => 1000 + (1000 * 60 * 6);
      expect(getCachedResponse(key)).toBeNull();
      expect(getCacheSize()).toBe(0);
    } finally {
      Date.now = originalNow;
    }
  });

  test("should evict oldest entry when cache size limit is exceeded", () => {
    // Inject 101 entries to force eviction
    for (let i = 0; i <= 100; i++) {
      setCachedResponse(`key_${i}`, { index: i });
    }
    // Size should cap at 100
    expect(getCacheSize()).toBe(100);
    // Key 0 (oldest) should be evicted
    expect(getCachedResponse("key_0")).toBeNull();
    // Key 100 (newest) should still exist
    expect(getCachedResponse("key_100")).toBeDefined();
  });

  test("should preserve cache control metadata", () => {
    const original = { role: "user", content: "hi", cache_control: { type: "ephemeral" } };
    const compressed = { role: "user", content: "hi" };
    
    const preserved = preserveCacheControl(original, compressed);
    expect(preserved.cache_control).toEqual({ type: "ephemeral" });

    // Should return unchanged if no cache control is present
    const unchanged = { role: "user", content: "hi" };
    expect(preserveCacheControl(unchanged, compressed).cache_control).toBeUndefined();
  });
});
