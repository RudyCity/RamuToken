import { expect, test, describe, beforeEach } from "bun:test";
import { compressRTK, stripAnsi, collapseRepeatedLogs } from "../pipelines/rtk";
import { compressSerena, extractKeywords } from "../pipelines/serena";
import { compressHeadroom, restoreCCR, clearRegistry } from "../pipelines/headroom";
import { injectCavemanPrompt } from "../pipelines/caveman";
import { generateRequestKey, getCachedResponse, setCachedResponse, clearCache } from "../pipelines/cache";

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

  test("should shorten absolute system file paths", () => {
    const log = "Error occurred at /Users/username/projects/token-compressor/server/index.ts:45:12";
    const compressed = compressRTK(log);
    expect(compressed).toContain("./token-compressor/server/index.ts");
    expect(compressed).not.toContain("/Users/username/projects/token-compressor/server/index.ts");
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
    // If the query is "targetFunction", calculate's body should be pruned, targetFunction preserved
    const query = "explain targetFunction";
    const wrappedCode = `\`\`\`typescript\n${sampleTS}\n\`\`\``;
    
    const compressed = compressSerena(wrappedCode, query, { minLines: 3 });
    
    // "calculate" is not in query, body should be pruned
    expect(compressed).toContain("body compressed");
    // "targetFunction" is in query, should be fully preserved
    expect(compressed).toContain("This is target");
  });
});

describe("Headroom Pipeline (JSON & Reversible Context CCR)", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("should minify JSON blocks", () => {
    const input = "JSON context:\n```json\n{\n  \"name\": \"App\",\n  \"active\": true\n}\n```";
    const compressed = compressHeadroom(input, { ccr: false }).text;
    expect(compressed).toContain('{"name":"App","active":true}');
    expect(compressed).not.toContain("  ");
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
    
    // Verify it was replaced by placeholder
    expect(compressedText).toContain("{{HR_CCR_");
    expect(compressedText).not.toContain("veryLongFunctionName");

    const placeholder = Object.keys(mapping)[0];
    expect(placeholder).toBeDefined();

    // Verify restore works
    const restored = restoreCCR(`Here is my review of the file ${placeholder}: it looks clean.`);
    expect(restored).toContain("veryLongFunctionName");
    expect(restored).not.toContain(placeholder);
  });
});

describe("Caveman Pipeline (Prose Compressor)", () => {
  test("should inject caveman instructions into system message", () => {
    const messages = [
      { role: "system", content: "You are a helpful coding assistant." },
      { role: "user", content: "Explain React." }
    ];

    const injected = injectCavemanPrompt(messages);
    expect(injected[0].content).toContain("CAVEMAN MODE ACTIVE");
    expect(injected[0].content).toContain("You are a helpful coding assistant.");
  });

  test("should prepend system message if none exists", () => {
    const messages = [
      { role: "user", content: "Explain React." }
    ];

    const injected = injectCavemanPrompt(messages);
    expect(injected[0].role).toBe("system");
    expect(injected[0].content).toContain("CAVEMAN MODE ACTIVE");
    expect(injected[1].role).toBe("user");
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

    const key1 = generateRequestKey(payload1);
    const key2 = generateRequestKey(payload2);
    expect(key1).toBe(key2);
  });

  test("should cache and retrieve response", () => {
    const key = "request_123";
    const responsePayload = { id: "chatcmpl-1", choices: [{ message: { content: "Hi" } }] };

    setCachedResponse(key, responsePayload);
    const retrieved = getCachedResponse(key);
    expect(retrieved).toEqual(responsePayload);
  });
});
