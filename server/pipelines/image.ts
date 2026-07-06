import { createCanvas } from "@napi-rs/canvas";
import { Message } from "./caveman";

export interface ImageSettings {
  enabled: boolean;
  triggerModels: string[];
  minCharLength: number;
  maxWidth: number;
  fontSize: number;
  format: "png" | "jpeg";
  quality: number;
  linesPerPage: number;
}

/**
 * Splits text into lines fitting the maximum characters per line.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  const rawLines = text.split(/\r?\n/);
  
  for (const rawLine of rawLines) {
    if (rawLine.length <= maxCharsPerLine) {
      lines.push(rawLine);
    } else {
      let current = "";
      const words = rawLine.split(" ");
      for (const word of words) {
        if (current.length + word.length + 1 <= maxCharsPerLine) {
          current += (current ? " " : "") + word;
        } else {
          if (current) {
            lines.push(current);
          }
          if (word.length > maxCharsPerLine) {
            // Word is too long, split it character-by-character
            let remaining = word;
            while (remaining.length > maxCharsPerLine) {
              lines.push(remaining.substring(0, maxCharsPerLine));
              remaining = remaining.substring(maxCharsPerLine);
            }
            current = remaining;
          } else {
            current = word;
          }
        }
      }
      if (current) {
        lines.push(current);
      }
    }
  }
  return lines.length > 0 ? lines : [""];
}

/**
 * Renders text content to base64 images using @napi-rs/canvas.
 */
export function textToImages(
  text: string,
  options: {
    maxWidth: number;
    fontSize: number;
    format: "png" | "jpeg";
    quality: number;
    linesPerPage: number;
  }
): string[] {
  const { maxWidth, fontSize, format, quality, linesPerPage } = options;
  
  // Monospaced character width is roughly 0.6 * fontSize
  const charWidth = fontSize * 0.6;
  const maxChars = Math.max(20, Math.floor((maxWidth - 40) / charWidth));
  const wrappedLines = wrapText(text, maxChars);

  const imagesBase64: string[] = [];
  const lineHeight = fontSize + 5;
  const padding = 20;
  
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    const pageLines = wrappedLines.slice(i, i + linesPerPage);
    const pageHeight = pageLines.length * lineHeight + padding * 2;
    
    const canvas = createCanvas(maxWidth, pageHeight);
    const ctx = canvas.getContext("2d");
    
    // Draw background (dark theme to match RamuToken aesthetics)
    ctx.fillStyle = "#0f111c";
    ctx.fillRect(0, 0, maxWidth, pageHeight);
    
    // Draw text
    ctx.font = `${fontSize}px Courier New, Courier, monospace`;
    ctx.fillStyle = "#e2e8f0";
    ctx.textBaseline = "top";
    
    let y = padding;
    for (const line of pageLines) {
      ctx.fillText(line, padding, y);
      y += lineHeight;
    }
    
    // Convert to buffer
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    // @napi-rs/canvas toBuffer options
    const buffer = canvas.toBuffer(mimeType, quality);
    imagesBase64.push(buffer.toString("base64"));
  }
  
  return imagesBase64;
}

/**
 * Merges consecutive messages of the same role to maintain API validation.
 * Replaces tool and other messages with 'user' role if they contain image parts.
 */
export function mergeConsecutiveMessages(messages: Message[]): Message[] {
  const merged: Message[] = [];
  
  for (const msg of messages) {
    if (msg.role === "system") {
      merged.push({ ...msg });
      continue;
    }
    
    const last = merged[merged.length - 1];
    // Map non-assistant roles to 'user' since system messages can't contain images
    // and tool messages are transformed into user messages when they have images.
    const normalizedRole = msg.role === "assistant" ? "assistant" : "user";
    
    if (last && last.role === normalizedRole) {
      if (typeof last.content === "string" && typeof msg.content === "string") {
        last.content += "\n\n" + msg.content;
      } else {
        const parts1 = typeof last.content === "string"
          ? [{ type: "text", text: last.content }]
          : last.content;
        const parts2 = typeof msg.content === "string"
          ? [{ type: "text", text: msg.content }]
          : msg.content;
        last.content = [...parts1, ...parts2];
      }
    } else {
      merged.push({
        ...msg,
        role: normalizedRole,
        content: msg.content
      });
    }
  }
  
  if (merged.length > 0 && merged[0].role === "assistant") {
    merged.unshift({ role: "user", content: "Continue" });
  }
  
  return merged;
}

/**
 * Main entry point for the Image Compression Pipeline.
 */
export async function compressToImage(
  messages: Message[],
  options: ImageSettings
): Promise<Message[]> {
  if (!options || !options.enabled) {
    return messages;
  }
  
  const resultMessages: Message[] = [];
  
  for (const msg of messages) {
    const content = msg.content;
    
    // System messages should stay as text.
    // Only compress messages that have content exceeding minCharLength.
    if (
      msg.role !== "system" &&
      typeof content === "string" &&
      content.length >= options.minCharLength
    ) {
      try {
        const images = textToImages(content, {
          maxWidth: options.maxWidth,
          fontSize: options.fontSize,
          format: options.format,
          quality: options.quality,
          linesPerPage: options.linesPerPage
        });
        
        // Format as OpenAI image parts payload.
        const imageParts = images.map((base64) => ({
          type: "image_url",
          image_url: {
            url: `data:image/${options.format};base64,${base64}`
          }
        }));
        
        // Convert to array content
        resultMessages.push({
          ...msg,
          // When attaching images to assistant messages, change role to 'user'
          // since assistant messages typically cannot have image content in API specifications.
          role: msg.role === "assistant" ? "user" : msg.role,
          content: [
            {
              type: "text",
              text: `[Image Compressed Context - original role: ${msg.role}]`
            },
            ...imageParts
          ]
        });
      } catch (err) {
        console.error("[Image Pipeline] Failed to render message to image, leaving as text:", err);
        resultMessages.push({ ...msg });
      }
    } else {
      resultMessages.push({ ...msg });
    }
  }
  
  // Merge consecutive messages to maintain strict alternating user/assistant structure
  return mergeConsecutiveMessages(resultMessages);
}
