/**
 * Proxy Server Routing & Compression Core
 * Intercepts OpenAI/Anthropic payloads, applies compression pipelines,
 * relays requests to Bifrost or direct providers, and tracks token usage.
 */
import { getEncoding } from "js-tiktoken";
import { settings, addLog, RequestLog } from "./config";
import { compressRTK } from "./pipelines/rtk";
import { compressSerena } from "./pipelines/serena";
import { compressHeadroom, restoreCCR } from "./pipelines/headroom";
import { injectCavemanPrompt, Message } from "./pipelines/caveman";
import { generateRequestKey, getCachedResponse, setCachedResponse, preserveCacheControl } from "./pipelines/cache";

// Initialize local tokenizer for token calculations (GPT-4 / Claude compatible base)
const tokenizer = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  try {
    return tokenizer.encode(text).length;
  } catch {
    // Fallback: estimate 4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export function countPayloadTokens(messages: Message[], system?: string): number {
  let count = 0;
  if (system) {
    count += countTokens(system);
  }
  for (const msg of messages) {
    count += countTokens(msg.content || "");
  }
  return count;
}

// Core compression orchestrator for a set of messages
export async function compressMessageList(
  messages: Message[],
  userQuery: string
): Promise<{ compressedMessages: Message[]; originalPrompt: string; compressedPrompt: string; ccrCount: number }> {
  let originalAccumulated = "";
  let compressedAccumulated = "";
  let ccrCount = 0;

  // Process message contents asynchronously
  const processed: Message[] = [];
  for (const msg of messages) {
    let content = msg.content || "";
    originalAccumulated += content + "\n";

    if (msg.role !== "system") {
      // 1. RTK Compression (logs, CLI output, paths)
      if (settings.rtk.enabled) {
        content = await compressRTK(content, {
          logs: settings.rtk.logs,
          paths: settings.rtk.paths,
          stacks: settings.rtk.stacks
        });
      }

      // 2. Serena Compression (code AST-like pruning based on query keywords)
      if (settings.serena.enabled) {
        content = await compressSerena(content, userQuery, { 
          minLines: settings.serena.minLines
        });
      }

      // 3. Headroom Compression (JSON minifying and CCR reversible substitution)
      if (settings.headroom.enabled) {
        const hrResult = await compressHeadroom(content, {
          minify: settings.headroom.minify,
          prune: settings.headroom.prune,
          ccr: settings.headroom.ccr,
          minCcrLength: settings.headroom.minCcrLength,
          blacklist: settings.headroom.blacklist
        });
        content = hrResult.text;
        ccrCount += Object.keys(hrResult.mapping).length;
      }
    }

    compressedAccumulated += content + "\n";

    const compressedMsg: Message = { ...msg, content };
    processed.push(preserveCacheControl(msg, compressedMsg));
  }

  // 4. Caveman Compression (append system prompt instruction)
  let finalProcessed = processed;
  if (settings.caveman.enabled) {
    finalProcessed = injectCavemanPrompt(processed, settings.caveman.level);
  }

  return {
    compressedMessages: finalProcessed,
    originalPrompt: originalAccumulated,
    compressedPrompt: compressedAccumulated,
    ccrCount
  };
}

// Extracts user query keywords from messages to feed Serena symbol matcher
function extractUserQuery(messages: Message[]): string {
  // Find last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content || "";
    }
  }
  return "";
}

// Relays request to the upstream target (Bifrost or Direct)
async function fetchUpstream(
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

// Stream Processor that performs in-flight response decompression/CCR reconstruction
function makeReconstructStream(originalStream: ReadableStream, provider: "openai" | "anthropic"): ReadableStream {
  const reader = originalStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data:")) {
              const dataText = line.substring(5).trim();
              if (dataText === "[DONE]") {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(dataText);
                
                // Traverse and substitute any CCR placeholders in stream chunks
                if (provider === "openai") {
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content && content.includes("{{HR_CCR_")) {
                    parsed.choices[0].delta.content = restoreCCR(content);
                  }
                } else {
                  const content = parsed.delta?.text;
                  if (content && content.includes("{{HR_CCR_")) {
                    parsed.delta.text = restoreCCR(content);
                  }
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n`));
              } catch {
                // Return original line if JSON parsing fails
                controller.enqueue(encoder.encode(line + "\n"));
              }
            } else {
              controller.enqueue(encoder.encode(line + "\n"));
            }
          }
        }

        // Flush remaining buffer
        if (buffer) {
          controller.enqueue(encoder.encode(buffer));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    }
  });
}

// -------------------------------------------------------------
// OpenAI Proxy (/v1/chat/completions)
// -------------------------------------------------------------
export async function handleOpenAIProxy(req: Request): Promise<Response> {
  const startTime = Date.now();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const originalMessages = body.messages || [];
  const model = body.model || "unknown";
  const userQuery = extractUserQuery(originalMessages);
  
  // Calculate original tokens
  const originalTokens = countPayloadTokens(originalMessages);

  // Apply Compression
  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount } = await compressMessageList(originalMessages, userQuery);
  const compressedTokens = countPayloadTokens(compressedMessages);
  const savingsPercent = originalTokens > 0 ? ((originalTokens - compressedTokens) / originalTokens) * 100 : 0;

  // Prepare proxy request payload
  const compressedBody = {
    ...body,
    messages: compressedMessages
  };

  // Local Cache Check
  const cacheKey = generateRequestKey(compressedBody);
  if (settings.cache.enabled && !body.stream) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log(`[Cache Hit] Serving cached response for key ${cacheKey}`);
      addLog({
        provider: "openai",
        model,
        originalTokens,
        compressedTokens: 0, // 0 tokens used!
        savingsPercent: 100,
        cached: true,
        durationMs: Date.now() - startTime,
        status: "success",
        ccrMappingsCount: 0,
        originalPrompt,
        compressedPrompt: "[Served from Cache]"
      });
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  try {
    const response = await fetchUpstream("/v1/chat/completions", req.headers, compressedBody, "openai");
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      addLog({
        provider: "openai",
        model,
        originalTokens,
        compressedTokens,
        savingsPercent,
        cached: false,
        durationMs,
        status: "error",
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt
      });
      return new Response(errText, { status: response.status, headers: response.headers });
    }

    // Handle Streaming Response
    if (body.stream) {
      console.log("[Proxy] Streaming OpenAI response...");
      addLog({
        provider: "openai",
        model,
        originalTokens,
        compressedTokens,
        savingsPercent,
        cached: false,
        durationMs,
        status: "success",
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt
      });

      const reconstructStream = makeReconstructStream(response.body!, "openai");
      return new Response(reconstructStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    // Handle Non-Streaming Response
    const responseJson = await response.json();
    
    // Decompress CCR tokens in response content
    if (responseJson.choices?.[0]?.message?.content) {
      responseJson.choices[0].message.content = restoreCCR(responseJson.choices[0].message.content);
    }

    // Cache Response
    if (settings.cache.enabled) {
      setCachedResponse(cacheKey, responseJson);
    }

    addLog({
      provider: "openai",
      model,
      originalTokens,
      compressedTokens,
      savingsPercent,
      cached: false,
      durationMs,
      status: "success",
      ccrMappingsCount: ccrCount,
      originalPrompt,
      compressedPrompt
    });

    return new Response(JSON.stringify(responseJson), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    addLog({
      provider: "openai",
      model,
      originalTokens,
      compressedTokens,
      savingsPercent: 0,
      cached: false,
      durationMs: Date.now() - startTime,
      status: "error",
      ccrMappingsCount: 0,
      originalPrompt,
      compressedPrompt: err.message
    });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// -------------------------------------------------------------
// Anthropic Proxy (/v1/messages)
// -------------------------------------------------------------
export async function handleAnthropicProxy(req: Request): Promise<Response> {
  const startTime = Date.now();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const originalMessages = body.messages || [];
  const systemPrompt = body.system || "";
  const model = body.model || "unknown";
  const userQuery = extractUserQuery(originalMessages);

  // Convert system prompt string into a message if necessary for pipelines, or count separately
  const originalTokens = countPayloadTokens(originalMessages, systemPrompt);

  // Apply Compression
  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount } = await compressMessageList(originalMessages, userQuery);
  
  // Compress system prompt if enabled
  let compressedSystem = systemPrompt;
  if (systemPrompt && settings.rtk.enabled) {
    compressedSystem = await compressRTK(systemPrompt);
  }

  const compressedTokens = countPayloadTokens(compressedMessages, compressedSystem);
  const savingsPercent = originalTokens > 0 ? ((originalTokens - compressedTokens) / originalTokens) * 100 : 0;

  // Prepare proxy request payload
  const compressedBody = {
    ...body,
    messages: compressedMessages,
    system: compressedSystem
  };

  // Local Cache Check
  const cacheKey = generateRequestKey(compressedBody);
  if (settings.cache.enabled && !body.stream) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log(`[Cache Hit] Serving cached response for key ${cacheKey}`);
      addLog({
        provider: "anthropic",
        model,
        originalTokens,
        compressedTokens: 0,
        savingsPercent: 100,
        cached: true,
        durationMs: Date.now() - startTime,
        status: "success",
        ccrMappingsCount: 0,
        originalPrompt,
        compressedPrompt: "[Served from Cache]"
      });
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  try {
    const response = await fetchUpstream("/v1/messages", req.headers, compressedBody, "anthropic");
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      addLog({
        provider: "anthropic",
        model,
        originalTokens,
        compressedTokens,
        savingsPercent,
        cached: false,
        durationMs,
        status: "error",
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt
      });
      return new Response(errText, { status: response.status, headers: response.headers });
    }

    // Handle Streaming Response
    if (body.stream) {
      console.log("[Proxy] Streaming Anthropic response...");
      addLog({
        provider: "anthropic",
        model,
        originalTokens,
        compressedTokens,
        savingsPercent,
        cached: false,
        durationMs,
        status: "success",
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt
      });

      const reconstructStream = makeReconstructStream(response.body!, "anthropic");
      return new Response(reconstructStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    // Handle Non-Streaming Response
    const responseJson = await response.json();

    // Decompress CCR tokens in Anthropic response format
    // e.g. responseJson.content = [ { type: "text", text: "..." } ]
    if (Array.isArray(responseJson.content)) {
      responseJson.content.forEach((block: any) => {
        if (block.type === "text" && block.text.includes("{{HR_CCR_")) {
          block.text = restoreCCR(block.text);
        }
      });
    }

    // Cache Response
    if (settings.cache.enabled) {
      setCachedResponse(cacheKey, responseJson);
    }

    addLog({
      provider: "anthropic",
      model,
      originalTokens,
      compressedTokens,
      savingsPercent,
      cached: false,
      durationMs,
      status: "success",
      ccrMappingsCount: ccrCount,
      originalPrompt,
      compressedPrompt
    });

    return new Response(JSON.stringify(responseJson), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    addLog({
      provider: "anthropic",
      model,
      originalTokens,
      compressedTokens,
      savingsPercent: 0,
      cached: false,
      durationMs: Date.now() - startTime,
      status: "error",
      ccrMappingsCount: 0,
      originalPrompt,
      compressedPrompt: err.message
    });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// OpenAI-to-Anthropic Request/Response Transpilation Layer
// -----------------------------------------------------------------------------

export function translateOpenAIToAnthropic(openAiBody: any): any {
  const model = openAiBody.model || "claude-3-5-sonnet";
  
  let system = "";
  const anthropicMessages: any[] = [];
  const originalMessages = openAiBody.messages || [];
  
  for (const msg of originalMessages) {
    if (msg.role === "system") {
      system += (system ? "\n" : "") + (msg.content || "");
    } else {
      const role = msg.role === "assistant" ? "assistant" : "user";
      const content = msg.content || "";
      
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        lastMsg.content += "\n" + content;
      } else {
        anthropicMessages.push({ role, content });
      }
    }
  }
  
  if (anthropicMessages.length > 0 && anthropicMessages[0].role === "assistant") {
    anthropicMessages.unshift({ role: "user", content: "Continue" });
  }
  
  const maxTokens = openAiBody.max_completion_tokens || openAiBody.max_tokens || 4096;
  const temperature = openAiBody.temperature !== undefined ? openAiBody.temperature : 1.0;
  
  const anthropicBody: any = {
    model,
    messages: anthropicMessages,
    max_tokens: maxTokens,
    temperature,
  };
  
  if (system) {
    anthropicBody.system = system;
  }
  
  if (openAiBody.stream) {
    anthropicBody.stream = true;
  }
  
  return anthropicBody;
}

export function translateAnthropicToOpenAI(anthropicRes: any): any {
  const textContent = Array.isArray(anthropicRes.content)
    ? anthropicRes.content.map((c: any) => c.text || "").join("")
    : "";
    
  return {
    id: anthropicRes.id || `chatcmpl-${Math.random().toString(36).substring(2, 15)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: anthropicRes.model || "claude-3-5-sonnet",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent
        },
        finish_reason: anthropicRes.stop_reason === "end_turn" ? "stop" : (anthropicRes.stop_reason || "stop")
      }
    ],
    usage: {
      prompt_tokens: anthropicRes.usage?.input_tokens || 0,
      completion_tokens: anthropicRes.usage?.output_tokens || 0,
      total_tokens: (anthropicRes.usage?.input_tokens || 0) + (anthropicRes.usage?.output_tokens || 0)
    }
  };
}

export function makeAnthropicToOpenAIStream(anthropicStream: ReadableStream, model: string): ReadableStream {
  const reader = anthropicStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const id = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data:")) {
              const dataText = line.substring(5).trim();
              if (dataText === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataText);
                
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  let content = parsed.delta.text;
                  if (content.includes("{{HR_CCR_")) {
                    content = restoreCCR(content);
                  }
                  
                  const openAiChunk = {
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: { content },
                        finish_reason: null
                      }
                    ]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
                } else if (parsed.type === "message_delta" && parsed.delta?.stop_reason) {
                  const finish_reason = parsed.delta.stop_reason === "end_turn" ? "stop" : parsed.delta.stop_reason;
                  const openAiChunk = {
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: {},
                        finish_reason
                      }
                    ]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    }
  });
}

// -----------------------------------------------------------------------------
// Anthropic Transpiled Proxy (/anthropic/v1/chat/completions)
// -----------------------------------------------------------------------------
export async function handleAnthropicTranspiledProxy(req: Request): Promise<Response> {
  const startTime = Date.now();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const originalMessages = body.messages || [];
  const model = body.model || "claude-3-5-sonnet";
  const userQuery = extractUserQuery(originalMessages);
  
  const originalTokens = countPayloadTokens(originalMessages);

  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount } = await compressMessageList(originalMessages, userQuery);
  const compressedTokens = countPayloadTokens(compressedMessages);
  const savingsPercent = originalTokens > 0 ? ((originalTokens - compressedTokens) / originalTokens) * 100 : 0;

  const compressedOpenAiBody = {
    ...body,
    messages: compressedMessages
  };

  const anthropicBody = translateOpenAIToAnthropic(compressedOpenAiBody);

  const cacheKey = generateRequestKey(compressedOpenAiBody);
  if (settings.cache.enabled && !body.stream) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log(`[Cache Hit] Serving cached response for key ${cacheKey}`);
      addLog({
        provider: "anthropic",
        model,
        originalTokens,
        compressedTokens: 0,
        savingsPercent: 100,
        cached: true,
        durationMs: Date.now() - startTime,
        status: "success",
        ccrMappingsCount: 0,
        originalPrompt,
        compressedPrompt: "[Served from Cache]"
      });
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  try {
    const response = await fetchUpstream("/v1/messages", req.headers, anthropicBody, "anthropic");
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      addLog({
        provider: "anthropic",
        model,
        originalTokens,
        compressedTokens,
        savingsPercent,
        cached: false,
        durationMs,
        status: "error",
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt
      });
      return new Response(errText, { status: response.status, headers: response.headers });
    }

    if (body.stream) {
      console.log("[Proxy] Streaming Transpiled Anthropic response...");
      addLog({
        provider: "anthropic",
        model,
        originalTokens,
        compressedTokens,
        savingsPercent,
        cached: false,
        durationMs,
        status: "success",
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt
      });

      const openAiStream = makeAnthropicToOpenAIStream(response.body!, model);
      return new Response(openAiStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    const responseJson = await response.json();
    
    if (Array.isArray(responseJson.content)) {
      responseJson.content.forEach((block: any) => {
        if (block.type === "text" && block.text.includes("{{HR_CCR_")) {
          block.text = restoreCCR(block.text);
        }
      });
    }

    const openAiResponse = translateAnthropicToOpenAI(responseJson);

    if (settings.cache.enabled) {
      setCachedResponse(cacheKey, openAiResponse);
    }

    addLog({
      provider: "anthropic",
      model,
      originalTokens,
      compressedTokens,
      savingsPercent,
      cached: false,
      durationMs,
      status: "success",
      ccrMappingsCount: ccrCount,
      originalPrompt,
      compressedPrompt
    });

    return new Response(JSON.stringify(openAiResponse), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    addLog({
      provider: "anthropic",
      model,
      originalTokens,
      compressedTokens,
      savingsPercent: 0,
      cached: false,
      durationMs: Date.now() - startTime,
      status: "error",
      ccrMappingsCount: 0,
      originalPrompt,
      compressedPrompt: err.message
    });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// Models List Proxy — forwards GET /v1/models to upstream provider
// Falls back to a static list only if the upstream request fails.
// -----------------------------------------------------------------------------

/** Build request headers for a GET request to the upstream (no body). */
async function buildGetHeaders(
  incomingHeaders: Headers,
  provider: "openai" | "anthropic"
): Promise<{ targetBase: string; headers: Headers }> {
  const preferCustom = settings.upstream.preferCustom && settings.upstream.customUrl;
  const preferBifrost = !preferCustom && settings.upstream.preferBifrost && settings.upstream.bifrostUrl;

  const requestHeaders = new Headers();
  // Forward relevant incoming headers (skip host / content-length)
  incomingHeaders.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("host") && !key.toLowerCase().startsWith("content-length")) {
      requestHeaders.set(key, value);
    }
  });

  let targetBase = "";

  if (preferCustom) {
    targetBase = settings.upstream.customUrl.replace(/\/$/, "");
    const headerName = settings.upstream.customHeader || "Authorization";
    const headerVal = settings.upstream.customKey || incomingHeaders.get(headerName) || "";
    if (headerVal) {
      if (headerName.toLowerCase() === "authorization" && !headerVal.toLowerCase().startsWith("bearer ")) {
        requestHeaders.set(headerName, `Bearer ${headerVal}`);
      } else {
        requestHeaders.set(headerName, headerVal);
      }
    }
    console.log(`[Proxy] Models → Custom Upstream: ${targetBase}`);
  } else if (preferBifrost) {
    targetBase = settings.upstream.bifrostUrl.replace(/\/$/, "");
    console.log(`[Proxy] Models → Bifrost: ${targetBase}`);
  } else if (provider === "openai") {
    targetBase = "https://api.openai.com";
    requestHeaders.set(
      "Authorization",
      `Bearer ${settings.upstream.openaiKey || incomingHeaders.get("Authorization")?.replace("Bearer ", "") || ""}`
    );
    console.log(`[Proxy] Models → OpenAI direct`);
  } else {
    targetBase = "https://api.anthropic.com";
    requestHeaders.set("x-api-key", settings.upstream.anthropicKey || incomingHeaders.get("x-api-key") || "");
    requestHeaders.set("anthropic-version", incomingHeaders.get("anthropic-version") || "2023-06-01");
    console.log(`[Proxy] Models → Anthropic direct`);
  }

  return { targetBase, headers: requestHeaders };
}

/**
 * Forwards a GET /v1/models (or /anthropic/v1/models) request to the upstream.
 * @param req      - original incoming request (for headers / auth)
 * @param provider - "openai" | "anthropic"
 */
export async function handleModelsProxy(req: Request, provider: "openai" | "anthropic"): Promise<Response> {
  try {
    const { targetBase, headers } = await buildGetHeaders(req.headers, provider);
    const endpoint = "/v1/models";
    const upstreamUrl = `${targetBase}${endpoint}`;

    const upstreamRes = await fetch(upstreamUrl, { method: "GET", headers });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      console.warn(`[Proxy] Models upstream error ${upstreamRes.status}: ${errText}`);
      return new Response(errText, {
        status: upstreamRes.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const json = await upstreamRes.json();
    return new Response(JSON.stringify(json), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error(`[Proxy] Models fetch failed: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { status: 502 });
  }
}
