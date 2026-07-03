import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { settings } from "../config";
import { compressLLMLingua } from "../pipelines/llmlingua";

describe("LLMLingua & AI Prompt Compressor Pipeline", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
    // Mock global fetch to intercept upstream LLM calls
    globalThis.fetch = (async (_url: any, init: any) => {
      try {
        const body = JSON.parse(init.body);
        const messages = body.messages || [];
        const contentText = messages.length > 1 ? messages[1].content : (messages[0]?.content || "");
        const sub = typeof contentText === "string" ? contentText.substring(0, 10) : "";
        
        if (body.model === "mock-llm") {
          const textVal = "Compressed prompt text: " + sub;
          return new Response(JSON.stringify({
            choices: [{ message: { content: textVal } }],
            content: [{ type: "text", text: textVal }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Default compressed prompt" } }],
          content: [{ type: "text", text: "Default compressed prompt" }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Default compressed prompt" } }],
          content: [{ type: "text", text: "Default compressed prompt" }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }) as any;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    // Restore default settings
    settings.llmlingua.enabled = false;
  });

  test("should return original text if llmlingua is disabled", async () => {
    settings.llmlingua.enabled = false;
    const input = "This is a very long prompt with logs and details.";
    const result = await compressLLMLingua(input);
    expect(result).toBe(input);
  });

  test("should run API-based compression using custom model", async () => {
    settings.llmlingua.enabled = true;
    settings.llmlingua.method = "api";
    settings.llmlingua.apiModel = "mock-llm";
    settings.llmlingua.apiPrompt = "Compress this";
    
    const input = "Very long input text that should be compressed by the mock API call.";
    const result = await compressLLMLingua(input);
    expect(result).toBe("Compressed prompt text: Very long");
  });

  test("should select dynamic cheaper model (auto) based on requested model", async () => {
    settings.llmlingua.enabled = true;
    settings.llmlingua.method = "api";
    settings.llmlingua.apiModel = "auto";
    
    let lastRequestedModel = "";
    globalThis.fetch = (async (_url: any, init: any) => {
      try {
        const body = JSON.parse(init.body);
        lastRequestedModel = body.model;
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Compressed: " + lastRequestedModel } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Compressed: error" } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }) as any;

    // Case 1: requestedModel is gpt-4o, should resolve to gpt-4o-mini
    await compressLLMLingua("some prompt", "gpt-4o");
    expect(lastRequestedModel).toBe("gpt-4o-mini");

    // Case 2: requestedModel is claude-3-5-sonnet, should resolve to claude-3-5-haiku-20241022
    await compressLLMLingua("some prompt", "claude-3-5-sonnet");
    expect(lastRequestedModel).toBe("claude-3-5-haiku-20241022");
  });
});
