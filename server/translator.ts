/**
 * OpenAI-to-Anthropic Request/Response Translation Layer
 * Moved from server/proxy.ts to keep file sizes under 1000 lines.
 */

import { restoreCCR } from "./pipelines/headroom";
import { Message } from "./pipelines/caveman";

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
