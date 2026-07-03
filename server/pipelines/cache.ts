/**
 * Cache & Prompt Optimizer
 * Manages local response caching, request hashing, and cache-control preservation.
 */
import { Database } from "bun:sqlite";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { Message } from "./caveman";

const dbDir = join(import.meta.dirname, "../../data");
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
const dbPath = join(dbDir, "cache.db");
const db = new Database(dbPath);

// Initialize table
db.run(`
  CREATE TABLE IF NOT EXISTS request_cache (
    request_key TEXT PRIMARY KEY,
    response_payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes TTL
const MAX_CACHE_SIZE = 100;

export function clearCache() {
  db.run("DELETE FROM request_cache");
}

export function getCacheSize(): number {
  const row = db.query("SELECT COUNT(*) as count FROM request_cache").get() as { count: number };
  return row ? row.count : 0;
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
  const row = db.query("SELECT response_payload, created_at FROM request_cache WHERE request_key = ?").get(key) as {
    response_payload: string;
    created_at: number;
  } | null;

  if (!row) return null;

  // Check TTL
  if (Date.now() - row.created_at > CACHE_TTL) {
    db.run("DELETE FROM request_cache WHERE request_key = ?", [key]);
    return null;
  }

  try {
    return JSON.parse(row.response_payload);
  } catch {
    return null;
  }
}

// Set a cached response for a request payload
export function setCachedResponse(key: string, response: any) {
  // Enforce size limit (FIFO eviction based on oldest created_at)
  const currentSize = getCacheSize();
  if (currentSize >= MAX_CACHE_SIZE) {
    const toDelete = currentSize - MAX_CACHE_SIZE + 1;
    db.run(
      "DELETE FROM request_cache WHERE request_key IN (SELECT request_key FROM request_cache ORDER BY created_at ASC LIMIT ?)",
      [toDelete]
    );
  }

  db.run("INSERT OR REPLACE INTO request_cache (request_key, response_payload, created_at) VALUES (?, ?, ?)", [
    key,
    JSON.stringify(response),
    Date.now()
  ]);
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
