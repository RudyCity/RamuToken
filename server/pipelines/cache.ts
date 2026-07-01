/**
 * Cache & Prompt Optimizer
 * Manages local response caching, request hashing, and cache-control preservation.
 */
import { Message } from "./caveman";

interface CacheEntry {
  response: any;
  timestamp: number;
}

// In-memory cache for compressed requests
const cacheStore = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes TTL
const MAX_CACHE_SIZE = 100;

export function clearCache() {
  cacheStore.clear();
}

export function getCacheSize() {
  return cacheStore.size;
}

// Generate a SHA-256 hash or simple stable string key from the compressed request payload
export function generateRequestKey(payload: {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}): string {
  // Extract and normalize relevant request features
  const normalized = {
    model: payload.model,
    messages: payload.messages.map(m => ({
      role: m.role,
      content: m.content,
      // Include cache_control in key if present
      cache_control: m.cache_control
    })),
    temperature: payload.temperature ?? 1.0,
    max_tokens: payload.max_tokens ?? 0,
    // Add other fields that alter response
    stream: payload.stream ?? false
  };

  return Bun.hash(JSON.stringify(normalized)).toString();
}

// Attempt to get cached response for a request payload
export function getCachedResponse(key: string): any | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cacheStore.delete(key);
    return null;
  }

  return entry.response;
}

// Set a cached response for a request payload
export function setCachedResponse(key: string, response: any) {
  // Enforce size limit (FIFO eviction)
  if (cacheStore.size >= MAX_CACHE_SIZE) {
    const firstKey = cacheStore.keys().next().value;
    if (firstKey) cacheStore.delete(firstKey);
  }

  cacheStore.set(key, {
    response,
    timestamp: Date.now(),
  });
}

// Preserves cache-control attributes during compression mapping
// If a message had cache_control, we attach it to the compressed message.
export function preserveCacheControl(originalMessage: Message, compressedMessage: Message): Message {
  if (originalMessage.cache_control) {
    return {
      ...compressedMessage,
      cache_control: originalMessage.cache_control
    };
  }
  return compressedMessage;
}
