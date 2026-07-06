import { expect, test, describe } from "bun:test";
import { addLog, addLLMLinguaLog, clearHistory, logsHistory, llmLinguaLogsHistory, metrics } from "../config";

describe("History and Metrics Clearing", () => {
  test("should add logs, calculate metrics, and clear them successfully", () => {
    // 1. Initial State Check (could have leftover or be empty)
    const initialLogCount = logsHistory.length;
    const initialLLMLinguaLogCount = llmLinguaLogsHistory.length;

    // 2. Add log and verify it is prepended
    const mockLog = {
      provider: "openai" as const,
      model: "gpt-4o",
      originalTokens: 1000,
      compressedTokens: 400,
      savingsPercent: 60,
      cached: false,
      durationMs: 150,
      status: "success" as const,
      ccrMappingsCount: 2,
      originalPrompt: "Hello world original",
      compressedPrompt: "Hello world comp",
    };

    const added = addLog(mockLog);
    expect(added.id).toBeDefined();
    expect(logsHistory.length).toBe(initialLogCount + 1);
    expect(logsHistory[0].id).toBe(added.id);

    // Verify metrics updated
    expect(metrics.totalRequests).toBeGreaterThan(0);
    expect(metrics.originalTokensSum).toBeGreaterThanOrEqual(1000);
    expect(metrics.compressedTokensSum).toBeGreaterThanOrEqual(400);

    // 3. Add LLMLingua log
    const mockLLMLog = {
      method: "api" as const,
      model: "gpt-4o-mini",
      originalTokens: 500,
      compressedTokens: 250,
      savingsPercent: 50,
      durationMs: 80,
      status: "success" as const,
      originalPrompt: "LLM original",
      compressedPrompt: "LLM comp",
    };

    const addedLLM = addLLMLinguaLog(mockLLMLog);
    expect(addedLLM.id).toBeDefined();
    expect(llmLinguaLogsHistory.length).toBe(initialLLMLinguaLogCount + 1);

    // 4. Clear history
    clearHistory();

    // Verify everything is reset to zero / empty
    expect(logsHistory.length).toBe(0);
    expect(llmLinguaLogsHistory.length).toBe(0);
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.originalTokensSum).toBe(0);
    expect(metrics.compressedTokensSum).toBe(0);
    expect(metrics.cacheHits).toBe(0);
    expect(metrics.totalSavedTokens).toBe(0);
    expect(metrics.totalSavedCost).toBe(0);
  });
});
