/**
 * LLMLingua & AI Prompt Compressor Pipeline
 * Supports offline compression via Python daemon (Microsoft LLMLingua/LLMLingua-2)
 * or online compression via Upstream LLM call.
 */

import { settings } from "../config";
import { pythonDaemon } from "./python_daemon";
import { callUpstreamLLM } from "./upstream";

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

  if (activeSettings.method === "local") {
    try {
      const compressed = await pythonDaemon.request("llmlingua", {
        text,
        model_name: activeSettings.localModel,
        rate: activeSettings.rate,
      });
      if (typeof compressed === "string") {
        return compressed;
      }
      return text;
    } catch (err) {
      console.error("[LLMLingua] Local python compression error, returning original text:", err);
      return text;
    }
  } else {
    // API-based compression
    try {
      let targetModel = activeSettings.apiModel;
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
          const isAnthropic = !!settings.upstream.anthropicKey || (!settings.upstream.openaiKey && settings.upstream.preferBifrost);
          targetModel = isAnthropic ? "claude-3-5-haiku-20241022" : "gpt-4o-mini";
        }
      }

      const compressed = await callUpstreamLLM(text, activeSettings.apiPrompt, targetModel);
      if (compressed && compressed.trim().length > 0) {
        return compressed.trim();
      }
      return text;
    } catch (err) {
      console.error("[LLMLingua] API-based compression error, returning original text:", err);
      return text;
    }
  }
}
