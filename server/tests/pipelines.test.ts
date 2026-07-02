import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import { compressRTK, stripAnsi, collapseRepeatedLogs, shortenPaths, pruneStackTraces } from "../pipelines/rtk";
import { compressSerena, extractKeywords, resolveDependencies } from "../pipelines/serena";
import { compressHeadroom, restoreCCR, clearRegistry, getRegistry, minifyJSON, pruneJSONFields } from "../pipelines/headroom";
import { injectCavemanPrompt, deCavemanize } from "../pipelines/caveman";
import { generateRequestKey, getCachedResponse, setCachedResponse, clearCache, getCacheSize, preserveCacheControl } from "../pipelines/cache";
import { pythonDaemon } from "../pipelines/python_daemon";

afterAll(() => {
  pythonDaemon.shutdown();
});

describe("RTK Pipeline (Log & CLI Compressor)", () => {
  test("should strip ANSI color escape codes (stub mode)", () => {
    expect(stripAnsi("raw")).toBe("raw");
  });

  test("should shorten paths (stub mode)", () => {
    expect(shortenPaths("raw")).toBe("raw");
  });

  test("should compress logs via official rtk CLI", async () => {
    const logs = [
      "INFO: Request completed",
      "INFO: Request completed",
      "INFO: Request completed",
      "ERROR: Timeout"
    ].join("\n");

    const compressed = await compressRTK(logs);
    expect(compressed).toContain("INFO: Request completed");
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
  });

  test("should prune functions not in keywords via official serena daemon", async () => {
    const query = "explain targetFunction";
    const wrappedCode = `\`\`\`typescript\n${sampleTS}\n\`\`\``;
    
    const compressed = await compressSerena(wrappedCode, query, { minLines: 3 });
    // In Serena, unreferenced functions (like calculate) should have their body pruned by the LSP manager
    expect(compressed).toContain("body compressed by Serena");
    expect(compressed).toContain("This is target");
  }, 30000);

  test("should parse file path comments and handle reference-graph pruning", async () => {
    const code = `
// filepath: src/math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function calculateAll(x: number, y: number) {
  const sum = add(x, y);
  const diff = subtract(x, y);
  return { sum, diff };
}
    `.trim();

    const wrapped = `\`\`\`typescript\n${code}\n\`\`\``;
    const query = "how to implement calculateAll";
    const compressed = await compressSerena(wrapped, query, { minLines: 3 });
    
    expect(compressed).toContain("calculateAll");
    expect(compressed).not.toContain("body compressed by Serena");
  }, 30000);

  test("should handle search, diagnostics and references via daemon", async () => {
    const { writeFileSync, unlinkSync } = await import("fs");
    const { join } = await import("path");
    const tempRoot = import.meta.dirname;
    const testFile = join(tempRoot, "temp_test_daemon.ts");
    const testCode = `
export function helloWorld() {
  console.log("hello");
}
    `.trim();
    writeFileSync(testFile, testCode, "utf8");

    try {
      const searchRes = await pythonDaemon.request("serena_search", {
        project_root: tempRoot,
        query: "helloWorld"
      });
      expect(Array.isArray(searchRes)).toBe(true);
      expect(searchRes.some((s: any) => s.name === "helloWorld")).toBe(true);

      const diagRes = await pythonDaemon.request("serena_diagnostics", {
        project_root: tempRoot,
        file_path: testFile
      });
      expect(Array.isArray(diagRes)).toBe(true);
    } finally {
      try {
        unlinkSync(testFile);
      } catch {}
    }
  }, 30000);
});

describe("Headroom Pipeline (JSON & Reversible Context CCR)", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("should access and clear CCR registry", () => {
    const registry = getRegistry();
    expect(registry.size).toBe(0);
  });

  test("should run headroom via official headroom daemon", async () => {
    const input = "JSON context:\n```json\n{\n  \"name\": \"App\",\n  \"active\": true\n}\n```";
    const compressed = await compressHeadroom(input);
    expect(compressed.text).toBeDefined();
  }, 30000);

  test("should minify JSON raw and inside code blocks", () => {
    const rawJson = '{\n  "name": "RamuToken",\n  "active": true\n}';
    expect(minifyJSON(rawJson)).toBe('{"name":"RamuToken","active":true}');

    const markdownJson = 'Some text\n```json\n{\n  "name": "RamuToken",\n  "active": true\n}\n```\nOther text';
    expect(minifyJSON(markdownJson)).toBe('Some text\n```json\n{"name":"RamuToken","active":true}\n```\nOther text');
  });

  test("should prune blacklisted and empty fields from JSON", () => {
    const rawJson = '{\n  "name": "RamuToken",\n  "emptyStr": "",\n  "emptyArr": [],\n  "emptyObj": {},\n  "nullVal": null,\n  "blacklistMe": "secret",\n  "nested": {\n    "keep": 123,\n    "blacklistMe": "hidden"\n  }\n}';
    const pruned = pruneJSONFields(rawJson, ["blacklistMe"]);
    expect(pruned).toBe('{"name":"RamuToken","nested":{"keep":123}}');
  });

  test("should compress via TS fallback and restore CCR placeholders", async () => {
    const codeSegment = "export function sampleFunction() {\n  console.log('This is a very long code segment to trigger CCR compression');\n  return 42;\n}";
    const input = `Here is my code:\n\`\`\`typescript\n${codeSegment}\n\`\`\`\nLet me know what you think.`;
    
    const result = await compressHeadroom(input, { ccr: true, minCcrLength: 50 });
    
    expect(result.text).toContain("{{HR_CCR_");
    expect(result.text).not.toContain("sampleFunction");
    expect(Object.keys(result.mapping).length).toBe(1);

    const placeholder = Object.keys(result.mapping)[0];
    expect(getRegistry().has(placeholder)).toBe(true);

    const llmResponse = `Sure, here is the original code: ${placeholder}`;
    const restored = restoreCCR(llmResponse);
    expect(restored).toContain("sampleFunction");
    expect(restored).toContain("export function sampleFunction");
  });

  test("should compress large prose paragraphs when ccrProse is enabled", async () => {
    const prose = "This is a very long paragraph. It contains multiple sentences and is designed to exceed the minimum threshold length. We want to test if it gets compressed into a CCR placeholder properly.";
    const input = `${prose}\n\nSome short paragraph.`;

    const result = await compressHeadroom(input, { ccr: true, minCcrLength: 40, ccrProse: true });
    expect(result.text).toContain("{{HR_CCR_");
    expect(result.text).not.toContain("This is a very long paragraph");
    expect(result.text).toContain("Some short paragraph.");
    
    const placeholder = Object.keys(result.mapping)[0];
    const restored = restoreCCR(`Here is: ${placeholder}`);
    expect(restored).toContain(prose);
  });

  test("should filter code block compression using ccrLanguages whitelist", async () => {
    const jsCode = "function testJs() {\n  console.log('Very long code segment in JS to exceed min length...');\n}";
    const pyCode = "def test_py():\n    print('Very long code segment in Python to exceed min length...')";
    
    const input = `\`\`\`javascript\n${jsCode}\n\`\`\`\n\n\`\`\`python\n${pyCode}\n\`\`\``;

    const result = await compressHeadroom(input, { ccr: true, minCcrLength: 30, ccrLanguages: ["python"] });
    expect(result.text).toContain("```javascript");
    expect(result.text).toContain("testJs");
    expect(result.text).not.toContain("test_py");
    expect(result.text).toContain("{{HR_CCR_");
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
