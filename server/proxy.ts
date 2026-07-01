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
export function compressMessageList(
  messages: Message[], 
  userQuery: string
): { compressedMessages: Message[]; originalText: string; compressedText: string; ccrCount: number } {
  let originalAccumulated = "";
  let compressedAccumulated = "";
  let ccrCount = 0;

  // Process message contents
  let processed = messages.map(msg => {
    let content = msg.content || "";
    originalAccumulated += content + "\n";

    if (msg.role !== "system") {
      // 1. RTK Compression (logs, CLI output, paths)
      if (settings.rtk.enabled) {
        content = compressRTK(content, {
          logs: settings.rtk.logs,
          paths: settings.rtk.paths,
          stacks: settings.rtk.stacks
        });
      }

      // 2. Serena Compression (code AST-like pruning based on query keywords)
      if (settings.serena.enabled) {
        content = compressSerena(content, userQuery, { minLines: settings.serena.minLines });
      }

      // 3. Headroom Compression (JSON minifying and CCR reversible substitution)
      if (settings.headroom.enabled) {
        const hrResult = compressHeadroom(content, {
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
    return preserveCacheControl(msg, compressedMsg);
  });

  // 4. Caveman Compression (append system prompt instruction)
  if (settings.caveman.enabled) {
    processed = injectCavemanPrompt(processed);
  }

  return {
    compressedMessages: processed,
    originalText: originalAccumulated,
    compressedText: compressedAccumulated,
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
  const preferBifrost = settings.upstream.preferBifrost && settings.upstream.bifrostUrl;
  let targetUrl = "";
  const requestHeaders = new Headers();

  // Copy standard headers
  headers.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("host") && !key.toLowerCase().startsWith("content-length")) {
      requestHeaders.set(key, value);
    }
  });

  if (preferBifrost) {
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
  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount } = compressMessageList(originalMessages, userQuery);
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
  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount } = compressMessageList(originalMessages, userQuery);
  
  // Compress system prompt if enabled
  let compressedSystem = systemPrompt;
  if (systemPrompt && settings.rtk.enabled) {
    compressedSystem = compressRTK(systemPrompt);
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
