/**
 * LLMLingua & AI Prompt Compressor Pipeline
 * Supports offline compression via Python daemon (Microsoft LLMLingua/LLMLingua-2)
 * or online compression via Upstream LLM call.
 * Records every compression attempt to the LLMLingua activity log.
 */

import { settings } from "../config";
import { addLLMLinguaLog } from "../config";
import { pythonDaemon } from "./python_daemon";
import { callUpstreamLLM } from "./upstream";

/** Simple token estimator to avoid circular imports with proxy.ts */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function compressLLMLingua(
  text: string,
  requestedModel?: string
): Promise<string> {
  const activeSettings = settings.llmlingua;
  if (!activeSettings || !activeSettings.enabled) {
    return text;
  }

  if (!text || text.trim().length === 0) {
    return text;
  }

  const originalTokens = estimateTokens(text);

  if (activeSettings.method === "local") {
    const start = Date.now();
    try {
      const compressed = await pythonDaemon.request("llmlingua", {
        text,
        model_name: activeSettings.localModel,
        rate: activeSettings.rate,
      });

      const durationMs = Date.now() - start;

      if (typeof compressed === "string") {
        const compressedTokens = estimateTokens(compressed);
        const savingsPercent =
          originalTokens > 0
            ? ((originalTokens - compressedTokens) / originalTokens) * 100
            : 0;

        addLLMLinguaLog({
          method: "local",
          model: activeSettings.localModel || "llmlingua-2",
          originalTokens,
          compressedTokens,
          savingsPercent,
          durationMs,
          status: "success",
        });

        return compressed;
      }

      // Daemon returned non-string — treat as no-op, log as error
      addLLMLinguaLog({
        method: "local",
        model: activeSettings.localModel || "llmlingua-2",
        originalTokens,
        compressedTokens: originalTokens,
        savingsPercent: 0,
        durationMs: Date.now() - start,
        status: "error",
        errorMessage: "Daemon returned unexpected response type",
      });

      return text;
    } catch (err: any) {
      addLLMLinguaLog({
        method: "local",
        model: activeSettings.localModel || "llmlingua-2",
        originalTokens,
        compressedTokens: originalTokens,
        savingsPercent: 0,
        durationMs: Date.now() - start,
        status: "error",
        errorMessage: err?.message || String(err),
      });
      console.error("[LLMLingua] Local python compression error, returning original text:", err);
      return text;
    }
  } else {
    // API-based compression
    const start = Date.now();
    let targetModel = activeSettings.apiModel;

    try {
      if (!targetModel || targetModel === "auto") {
        if (requestedModel) {
          if (requestedModel.includes("claude-3-5")) {
            targetModel = "claude-3-5-haiku-20241022";
          } else if (requestedModel.includes("claude-3")) {
            targetModel = "claude-3-haiku-20240307";
          } else if (requestedModel.includes("gpt-4o")) {
            targetModel = "gpt-4o-mini";
          } else if (requestedModel.includes("gpt-4")) {
            targetModel = "gpt-4o-mini";
          } else {
            targetModel = requestedModel; // Try to use the requested model
          }
        } else {
          // Default fallback cheap model
          const isAnthropic =
            !!settings.upstream.anthropicKey ||
            (!settings.upstream.openaiKey && settings.upstream.preferBifrost);
          targetModel = isAnthropic ? "claude-3-5-haiku-20241022" : "gpt-4o-mini";
        }
      }

      const compressed = await callUpstreamLLM(text, activeSettings.apiPrompt, targetModel);
      const durationMs = Date.now() - start;

      if (compressed && compressed.trim().length > 0) {
        const compressedTokens = estimateTokens(compressed.trim());
        const savingsPercent =
          originalTokens > 0
            ? ((originalTokens - compressedTokens) / originalTokens) * 100
            : 0;

        addLLMLinguaLog({
          method: "api",
          model: targetModel,
          originalTokens,
          compressedTokens,
          savingsPercent,
          durationMs,
          status: "success",
        });

        return compressed.trim();
      }

      // Empty result — return original, log as error
      addLLMLinguaLog({
        method: "api",
        model: targetModel,
        originalTokens,
        compressedTokens: originalTokens,
        savingsPercent: 0,
        durationMs: Date.now() - start,
        status: "error",
        errorMessage: "API returned empty compressed result",
      });

      return text;
    } catch (err: any) {
      addLLMLinguaLog({
        method: "api",
        model: targetModel || "unknown",
        originalTokens,
        compressedTokens: originalTokens,
        savingsPercent: 0,
        durationMs: Date.now() - start,
        status: "error",
        errorMessage: err?.message || String(err),
      });
      console.error("[LLMLingua] API-based compression error, returning original text:", err);
      return text;
    }
  }
}
