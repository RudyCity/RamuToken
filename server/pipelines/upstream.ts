import { settings } from "../config";

// Relays request to the upstream target (Bifrost or Direct)
export async function fetchUpstream(
  endpoint: string, 
  headers: Headers, 
  body: any, 
  provider: "openai" | "anthropic"
): Promise<Response> {
  // Resolve active custom provider from the list
  const activeProvider = settings.upstream.preferCustom
    ? settings.upstream.customProviders.find(
        (p) => p.id === settings.upstream.activeCustomProviderId
      )
    : undefined;

  const preferCustom = settings.upstream.preferCustom && !!activeProvider;
  const preferBifrost = !preferCustom && settings.upstream.preferBifrost && settings.upstream.bifrostUrl;
  let targetUrl = "";
  const requestHeaders = new Headers();

  // Copy standard headers
  headers.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("host") && !key.toLowerCase().startsWith("content-length")) {
      requestHeaders.set(key, value);
    }
  });

  if (preferCustom && activeProvider) {
    // Route to active custom upstream provider
    const baseUrl = activeProvider.url.replace(/\/$/, "");
    targetUrl = `${baseUrl}${endpoint}`;

    const headerName = activeProvider.header || "Authorization";
    const headerVal = activeProvider.key || headers.get(headerName) || "";
    if (headerVal) {
      if (headerName.toLowerCase() === "authorization" && !headerVal.toLowerCase().startsWith("bearer ")) {
        requestHeaders.set(headerName, `Bearer ${headerVal}`);
      } else {
        requestHeaders.set(headerName, headerVal);
      }
    }
    console.log(`[Proxy] Routing Custom Upstream (${activeProvider.name}): ${targetUrl}`);
  } else if (preferBifrost) {
    // Route to local Bifrost gateway
    // Bifrost maps routes as OpenAI endpoints. OpenAI or Anthropic targets are mapped internally.
    let targetEndpoint = endpoint;
    if (provider === "anthropic" && endpoint.startsWith("/v1/")) {
      targetEndpoint = `/anthropic${endpoint}`;
    }
    targetUrl = `${settings.upstream.bifrostUrl}${targetEndpoint}`;
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
  const activeProvider = settings.upstream.preferCustom
    ? settings.upstream.customProviders.find(
        (p) => p.id === settings.upstream.activeCustomProviderId
      )
    : undefined;
  const preferCustom = settings.upstream.preferCustom && !!activeProvider;
  const isAnthropic = !preferCustom && (!!settings.upstream.anthropicKey || (!settings.upstream.openaiKey && settings.upstream.preferBifrost));
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
