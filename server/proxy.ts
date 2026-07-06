/**
 * Proxy Server Routing & Compression Core
 * Intercepts OpenAI/Anthropic payloads, applies compression pipelines,
 * relays requests to Bifrost or direct providers, and tracks token usage.
 */
import { getEncoding } from "js-tiktoken";
import { settings, addLog, CompressorSettings, PipelineStep } from "./config";
import { fetchUpstream } from "./pipelines/upstream";
import { compressRTK } from "./pipelines/rtk";
import { compressSerena } from "./pipelines/serena";
import { compressHeadroom, restoreCCR } from "./pipelines/headroom";
import { injectCavemanPrompt, Message, compressToolDescriptions } from "./pipelines/caveman";
import { generateRequestKey, getCachedResponse, setCachedResponse, preserveCacheControl } from "./pipelines/cache";
import { compressLLMLingua } from "./pipelines/llmlingua";
import { compressToImage } from "./pipelines/image";

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
    if (typeof msg.content === "string") {
      count += countTokens(msg.content || "");
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          count += countTokens(part.text || "");
        } else if (part.type === "image_url") {
          count += 765; // OpenAI high detail estimate
        } else if (part.type === "image") {
          count += 1400; // Anthropic estimate
        }
      }
    }
  }
  return count;
}

// Core compression orchestrator for a set of messages
function messagesToText(messages: Message[]): string {
  return messages.map(m => {
    return `[${m.role}]: ${contentToText(m.content)}`;
  }).join("\n\n");
}

/**
 * Extracts all base64 image data from messages produced by the Image Compression step.
 * Returns an array of { base64, format } objects (format = "png" | "jpeg").
 */
function extractImagesFromMessages(messages: Message[]): { base64: string; format: string }[] {
  const result: { base64: string; format: string }[] = [];
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const match = (part.image_url.url as string).match(
            /^data:(image\/[a-zA-Z+-]+);base64,(.+)$/
          );
          if (match) {
            result.push({
              format: match[1].replace("image/", ""),
              base64: match[2],
            });
          }
        } else if (part.type === "image" && part.source?.type === "base64") {
          const mediaType = part.source.media_type || "image/png";
          result.push({
            format: mediaType.replace("image/", ""),
            base64: part.source.data || "",
          });
        }
      }
    }
  }
  return result;
}

/**
 * Helper to convert a message's content (which can be a string or array of parts)
 * to a clean, readable text representation without [object Object] serialization.
 */
function contentToText(content: string | any[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(p => {
      if (typeof p === "string") return p;
      if (p.type === "text") return p.text || "";
      if (p.type === "image_url") {
        if (typeof p.image_url?.url === "string" && p.image_url.url.startsWith("data:")) {
          const mime = p.image_url.url.match(/^data:(image\/[a-zA-Z+-]+);base64,/)?.[1] || "image";
          return `[${mime.toUpperCase()} Image]`;
        }
        return `[Image URL: ${p.image_url?.url || ""}]`;
      }
      if (p.type === "image") return "[Image]";
      return `[Part: ${p.type}]`;
    }).join("\n");
  }
  return String(content);
}

// Core compression orchestrator for a set of messages
export async function compressMessageList(
  messages: Message[],
  userQuery: string,
  overrideSettings?: CompressorSettings,
  requestedModel?: string
): Promise<{
  compressedMessages: Message[];
  originalPrompt: string;
  compressedPrompt: string;
  ccrCount: number;
  pipelineSteps: PipelineStep[];
}> {
  const activeSettings = overrideSettings || settings;
  const pipelineSteps: PipelineStep[] = [];
  let ccrCount = 0;

  let currentMessages = messages.map(m => ({ ...m }));

  const runStep = async (
    name: "RTK" | "Serena" | "LLMLingua" | "Headroom" | "Caveman" | "Image",
    enabled: boolean,
    transformFn: (msgs: Message[]) => Promise<Message[]>
  ) => {
    const inputText = messagesToText(currentMessages);
    const inputTokens = countPayloadTokens(currentMessages);

    let nextMessages = currentMessages;
    if (enabled) {
      nextMessages = await transformFn(currentMessages);
    }

    const outputText = messagesToText(nextMessages);
    const outputTokens = countPayloadTokens(nextMessages);

    // Capture the base64 images if present in input or output of this step
    let stepImages: string[] | undefined;
    let stepImageFormat: "png" | "jpeg" | undefined;
    const outputImages = extractImagesFromMessages(nextMessages);
    if (outputImages.length > 0) {
      stepImages = outputImages.map(e => e.base64);
      stepImageFormat = outputImages[0].format as "png" | "jpeg";
    } else {
      const inputImages = extractImagesFromMessages(currentMessages);
      if (inputImages.length > 0) {
        stepImages = inputImages.map(e => e.base64);
        stepImageFormat = inputImages[0].format as "png" | "jpeg";
      }
    }

    pipelineSteps.push({
      name,
      enabled,
      inputTokens,
      outputTokens,
      inputText,
      outputText,
      images: stepImages,
      imageFormat: stepImageFormat,
    });

    currentMessages = nextMessages;
  };

  // 1. RTK Compression (logs, CLI output, paths)
  await runStep("RTK", activeSettings.rtk.enabled, async (msgs) => {
    const result: Message[] = [];
    for (const m of msgs) {
      let content = m.content || "";
      if (m.role !== "system" && content.length > 150) {
        content = await compressRTK(content, {
          logs: activeSettings.rtk.logs,
          paths: activeSettings.rtk.paths,
          stacks: activeSettings.rtk.stacks
        });
      }
      result.push({ ...m, content });
    }
    return result;
  });

  // 2. Serena Compression (code AST-like pruning)
  await runStep("Serena", activeSettings.serena.enabled, async (msgs) => {
    const result: Message[] = [];
    for (const m of msgs) {
      let content = m.content || "";
      if (m.role !== "system") {
        content = await compressSerena(content, userQuery, {
          minLines: activeSettings.serena.minLines
        });
      }
      result.push({ ...m, content });
    }
    return result;
  });

  // 3. LLMLingua / AI Context Compression
  await runStep("LLMLingua", !!activeSettings.llmlingua?.enabled, async (msgs) => {
    const result: Message[] = [];
    for (const m of msgs) {
      let content = m.content || "";
      if (m.role !== "system" && (m.role === "user" || m.role === "tool") && content.length > 300) {
        content = await compressLLMLingua(content, requestedModel);
      }
      result.push({ ...m, content });
    }
    return result;
  });

  // 4. Headroom Compression (JSON minifying & CCR)
  await runStep("Headroom", activeSettings.headroom.enabled, async (msgs) => {
    const result: Message[] = [];
    for (const m of msgs) {
      let content = m.content || "";
      if (m.role !== "system") {
        const hrResult = await compressHeadroom(content, {
          minify: activeSettings.headroom.minify,
          prune: activeSettings.headroom.prune,
          ccr: activeSettings.headroom.ccr,
          minCcrLength: activeSettings.headroom.minCcrLength,
          blacklist: activeSettings.headroom.blacklist
        });
        content = hrResult.text;
        ccrCount += Object.keys(hrResult.mapping).length;
      }
      // Preserve cache control logic
      const originalMsg = messages.find(orig => orig.role === m.role);
      const compressedMsg: Message = { ...m, content };
      result.push(preserveCacheControl(originalMsg || m, compressedMsg));
    }
    return result;
  });

  // 5. Caveman Compression (inject system instruction) - run on final list
  await runStep("Caveman", activeSettings.caveman.enabled, async (msgs) => {
    return injectCavemanPrompt(msgs, activeSettings.caveman.level);
  });

  // 6. Image Compression (convert long text messages to images)
  const isImageTriggered = !!(
    requestedModel &&
    activeSettings.image?.enabled &&
    activeSettings.image?.triggerModels.some((keyword) =>
      requestedModel.toLowerCase().includes(keyword.toLowerCase().trim())
    )
  );
  await runStep("Image", isImageTriggered, async (msgs) => {
    return compressToImage(msgs, activeSettings.image!);
  });

  // Form original and compressed accumulated prompts.
  // compressedPrompt reflects the full post-pipeline output (including Caveman injection)
  // so that token savings logs and UI are accurate.
  const originalPrompt = messages.map(m => contentToText(m.content)).join("\n\n");
  const compressedPrompt = currentMessages.map(m => contentToText(m.content)).join("\n\n");

  return {
    compressedMessages: currentMessages,
    originalPrompt,
    compressedPrompt,
    ccrCount,
    pipelineSteps
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

  if (settings.caveman.enabled && settings.caveman.compressMcpDescriptions && body.tools) {
    compressToolDescriptions(body.tools);
  }

  const originalMessages = body.messages || [];
  const model = body.model || "unknown";
  const userQuery = extractUserQuery(originalMessages);
  
  // Calculate original tokens
  const originalTokens = countPayloadTokens(originalMessages);

  // Apply Compression
  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount, pipelineSteps } = await compressMessageList(originalMessages, userQuery, undefined, model);
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
        compressedPrompt: "[Served from Cache]",
        pipelineSteps
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
        errorMessage: `HTTP ${response.status}: ${errText.slice(0, 300)}`,
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt,
        pipelineSteps
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
        compressedPrompt,
        pipelineSteps
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
      compressedPrompt,
      pipelineSteps
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
      errorMessage: err.message,
      ccrMappingsCount: 0,
      originalPrompt,
      compressedPrompt,
      pipelineSteps
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

  if (settings.caveman.enabled && settings.caveman.compressMcpDescriptions && body.tools) {
    compressToolDescriptions(body.tools);
  }

  const originalMessages = body.messages || [];
  const systemPrompt = body.system || "";
  const model = body.model || "unknown";
  const userQuery = extractUserQuery(originalMessages);

  // Convert system prompt string into a message if necessary for pipelines, or count separately
  const originalTokens = countPayloadTokens(originalMessages, systemPrompt);

  // Apply Compression
  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount, pipelineSteps } = await compressMessageList(originalMessages, userQuery, undefined, model);
  
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
        compressedPrompt: "[Served from Cache]",
        pipelineSteps
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
        errorMessage: `HTTP ${response.status}: ${errText.slice(0, 300)}`,
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt,
        pipelineSteps
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
        compressedPrompt,
        pipelineSteps
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
      compressedPrompt,
      pipelineSteps
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
      errorMessage: err.message,
      ccrMappingsCount: 0,
      originalPrompt,
      compressedPrompt,
      pipelineSteps
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
      let sysText = "";
      if (typeof msg.content === "string") {
        sysText = msg.content;
      } else if (Array.isArray(msg.content)) {
        sysText = msg.content.map(p => p.type === "text" ? p.text || "" : "").join("\n");
      }
      system += (system ? "\n" : "") + sysText;
    } else {
      const role = msg.role === "assistant" ? "assistant" : "user";
      let contentParts: any[];
      
      if (typeof msg.content === "string") {
        contentParts = [{ type: "text", text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        contentParts = msg.content.map(part => {
          if (part.type === "text") {
            return { type: "text", text: part.text || "" };
          } else if (part.type === "image_url") {
            const url = part.image_url?.url || "";
            const match = url.match(/^data:(image\/[a-zA-Z+-]+);base64,(.+)$/);
            if (match) {
              return {
                type: "image",
                source: {
                  type: "base64",
                  media_type: match[1],
                  data: match[2]
                }
              };
            }
          }
          return part;
        });
      } else {
        contentParts = [{ type: "text", text: "" }];
      }
      
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        if (Array.isArray(lastMsg.content)) {
          lastMsg.content.push(...contentParts);
        } else {
          lastMsg.content = [{ type: "text", text: lastMsg.content }, ...contentParts];
        }
      } else {
        anthropicMessages.push({ role, content: contentParts });
      }
    }
  }
  
  // Simplify messages: if a message only contains text parts (no images), flatten it to a string.
  for (const msg of anthropicMessages) {
    if (Array.isArray(msg.content)) {
      const hasImage = msg.content.some((p: any) => p.type === "image");
      if (!hasImage) {
        msg.content = msg.content.map((p: any) => p.text || "").join("\n");
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

  const { compressedMessages, originalPrompt, compressedPrompt, ccrCount, pipelineSteps } = await compressMessageList(originalMessages, userQuery);
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
        compressedPrompt: "[Served from Cache]",
        pipelineSteps
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
        errorMessage: `HTTP ${response.status}: ${errText.slice(0, 300)}`,
        ccrMappingsCount: ccrCount,
        originalPrompt,
        compressedPrompt,
        pipelineSteps
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
        compressedPrompt,
        pipelineSteps
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
      compressedPrompt,
      pipelineSteps
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
      errorMessage: err.message,
      ccrMappingsCount: 0,
      originalPrompt,
      compressedPrompt,
      pipelineSteps
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
  const activeProvider = settings.upstream.preferCustom
    ? settings.upstream.customProviders.find(
        (p) => p.id === settings.upstream.activeCustomProviderId
      )
    : undefined;
  const preferCustom = settings.upstream.preferCustom && !!activeProvider;
  const preferBifrost = !preferCustom && settings.upstream.preferBifrost && settings.upstream.bifrostUrl;

  const requestHeaders = new Headers();
  // Forward relevant incoming headers (skip host / content-length)
  incomingHeaders.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("host") && !key.toLowerCase().startsWith("content-length")) {
      requestHeaders.set(key, value);
    }
  });

  let targetBase = "";

  if (preferCustom && activeProvider) {
    targetBase = activeProvider.url.replace(/\/$/, "");
    const headerName = activeProvider.header || "Authorization";
    const headerVal = activeProvider.key || incomingHeaders.get(headerName) || "";
    if (headerVal) {
      if (headerName.toLowerCase() === "authorization" && !headerVal.toLowerCase().startsWith("bearer ")) {
        requestHeaders.set(headerName, `Bearer ${headerVal}`);
      } else {
        requestHeaders.set(headerName, headerVal);
      }
    }
    console.log(`[Proxy] Models → Custom Upstream (${activeProvider.name}): ${targetBase}`);
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
