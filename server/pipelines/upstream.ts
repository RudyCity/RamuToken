import { settings } from "../config";

// Relays request to the upstream target (Bifrost or Direct)
export async function fetchUpstream(
  endpoint: string, 
  headers: Headers, 
  body: any, 
  provider: "openai" | "anthropic"
): Promise<Response> {
  const preferCustom = settings.upstream.preferCustom && settings.upstream.customUrl;
  const preferBifrost = !preferCustom && settings.upstream.preferBifrost && settings.upstream.bifrostUrl;
  let targetUrl = "";
  const requestHeaders = new Headers();

  // Copy standard headers
  headers.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("host") && !key.toLowerCase().startsWith("content-length")) {
      requestHeaders.set(key, value);
    }
  });

  if (preferCustom) {
    // Route to custom upstream URL
    // Strip trailing slash if present
    const baseUrl = settings.upstream.customUrl.replace(/\/$/, "");
    targetUrl = `${baseUrl}${endpoint}`;
    
    const headerName = settings.upstream.customHeader || "Authorization";
    const headerVal = settings.upstream.customKey || headers.get(headerName) || "";
    if (headerVal) {
      if (headerName.toLowerCase() === "authorization" && !headerVal.toLowerCase().startsWith("bearer ")) {
        requestHeaders.set(headerName, `Bearer ${headerVal}`);
      } else {
        requestHeaders.set(headerName, headerVal);
      }
    }
    console.log(`[Proxy] Routing Custom Upstream: ${targetUrl}`);
  } else if (preferBifrost) {
    // Route to local Bifrost gateway
    // Bifrost maps routes as OpenAI endpoints. OpenAI or Anthropic targets are mapped internally.
    targetUrl = `${settings.upstream.bifrostUrl}${endpoint}`;
    console.log(`[Proxy] Routing via Bifrost: ${targetUrl}`);
  } else {
    // Route directly to official provider APIs
    if (provider === "openai") {
      targetUrl = `https://api.openai.com${endpoint}`;
      requestHeaders.set("Authorization", `Bearer ${settings.upstream.openaiKey || headers.get("Authorization")?.replace("Bearer ", "")}`);
    } else {
      targetUrl = `https://api.anthropic.com${endpoint}`;
      requestHeaders.set("x-api-key", settings.upstream.anthropicKey || headers.get("x-api-key") || "");
      requestHeaders.set("anthropic-version", headers.get("anthropic-version") || "2023-06-01");
    }
    console.log(`[Proxy] Routing Direct: ${targetUrl}`);
  }

  requestHeaders.set("Content-Type", "application/json");

  return fetch(targetUrl, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

/**
 * Calls the user-configured upstream model directly to process custom prompts.
 */
export async function callUpstreamLLM(prompt: string, system?: string, model?: string): Promise<string> {
  const isAnthropic = !!settings.upstream.anthropicKey || (!settings.upstream.openaiKey && settings.upstream.preferBifrost);
  const endpoint = isAnthropic ? "/v1/messages" : "/v1/chat/completions";
  const provider = isAnthropic ? "anthropic" : "openai";

  const headers = new Headers();
  if (isAnthropic) {
    headers.set("x-api-key", settings.upstream.anthropicKey);
    headers.set("anthropic-version", "2023-06-01");
  } else {
    headers.set("Authorization", `Bearer ${settings.upstream.openaiKey}`);
  }

  let targetModel = model;
  if (!targetModel || targetModel === "auto") {
    targetModel = isAnthropic ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini"; // Default fallback models
  }
  
  const body = isAnthropic ? {
    model: targetModel,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: prompt }]
  } : {
    model: targetModel,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt }
    ]
  };

  const response = await fetchUpstream(endpoint, headers, body, provider);
  if (!response.ok) {
    throw new Error(`Upstream LLM error: ${await response.text()}`);
  }

  const json = await response.json();
  if (isAnthropic) {
    return json.content?.[0]?.text || "";
  } else {
    return json.choices?.[0]?.message?.content || "";
  }
}
