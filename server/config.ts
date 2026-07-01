import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";

export interface CompressorSettings {
  rtk: {
    enabled: boolean;
    logs: boolean;
    paths: boolean;
    stacks: boolean;
  };
  serena: {
    enabled: boolean;
    minLines: number;
    usePythonSymbols: boolean;
  };
  headroom: {
    enabled: boolean;
    minify: boolean;
    prune: boolean;
    ccr: boolean;
    minCcrLength: number;
    blacklist: string[];
    usePython: boolean;
  };
  caveman: {
    enabled: boolean;
    level: "low" | "medium" | "high";
  };
  cache: {
    enabled: boolean;
  };
  upstream: {
    bifrostUrl: string;
    openaiKey: string;
    anthropicKey: string;
    preferBifrost: boolean;
    preferCustom: boolean;
    customUrl: string;
    customKey: string;
    customHeader: string;
  };
  server: {
    port: number;
    accessToken: string;
  };
}

export interface RequestLog {
  id: string;
  timestamp: number;
  provider: "openai" | "anthropic";
  model: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  cached: boolean;
  durationMs: number;
  status: "success" | "error";
  ccrMappingsCount: number;
  originalPrompt: string;
  compressedPrompt: string;
}

// Default settings
export let settings: CompressorSettings = {
  rtk: {
    enabled: true,
    logs: true,
    paths: true,
    stacks: true,
  },
  serena: {
    enabled: true,
    minLines: 8,
    usePythonSymbols: false,
  },
  headroom: {
    enabled: true,
    minify: true,
    prune: true,
    ccr: true,
    minCcrLength: 200,
    blacklist: ["metadata", "id_token", "hash"],
    usePython: false,
  },
  caveman: {
    enabled: false, // Turned off by default, opt-in
    level: "medium",
  },
  cache: {
    enabled: true,
  },
  upstream: {
    bifrostUrl: "http://localhost:8080",
    openaiKey: process.env.OPENAI_API_KEY || "",
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    preferBifrost: true,
    preferCustom: false,
    customUrl: "",
    customKey: "",
    customHeader: "Authorization",
  },
  server: {
    port: 6875,
    accessToken: "",
  },
};

// In-memory logs history (keep last 200 logs)
export const logsHistory: RequestLog[] = [];
export const maxLogs = 200;

// Aggregate metrics
export const metrics = {
  totalRequests: 0,
  originalTokensSum: 0,
  compressedTokensSum: 0,
  cacheHits: 0,
  totalSavedTokens: 0,
  totalSavedCost: 0, // Mocked dollar savings
};

export function updateSettings(newSettings: Partial<CompressorSettings>) {
  settings = {
    ...settings,
    ...newSettings,
    rtk: { ...settings.rtk, ...newSettings.rtk },
    serena: { ...settings.serena, ...newSettings.serena },
    headroom: { ...settings.headroom, ...newSettings.headroom },
    caveman: { ...settings.caveman, ...newSettings.caveman },
    cache: { ...settings.cache, ...newSettings.cache },
    upstream: { ...settings.upstream, ...newSettings.upstream },
    server: { ...settings.server, ...newSettings.server },
  };
  saveToDisk();
  return settings;
}

export function addLog(log: Omit<RequestLog, "id" | "timestamp">) {
  const fullLog: RequestLog = {
    ...log,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
  };

  logsHistory.unshift(fullLog);
  if (logsHistory.length > maxLogs) {
    logsHistory.pop();
  }

  // Update cumulative metrics
  metrics.totalRequests++;
  metrics.originalTokensSum += log.originalTokens;
  metrics.compressedTokensSum += log.compressedTokens;
  if (log.cached) {
    metrics.cacheHits++;
  }
  const saved = log.originalTokens - log.compressedTokens;
  metrics.totalSavedTokens += saved;
  // Estimate cost saved: avg $0.005 per 1K input tokens (Claude 3.5 Sonnet is $3/$15, OpenAI GPT-4o is $2.5/$10)
  metrics.totalSavedCost += (saved / 1000) * 0.005;

  saveToDisk();

  // Broadcast update to WebSocket clients
  broadcastMetricsUpdate();
  
  return fullLog;
}

// WebSocket broadcast mechanism
export const activeSockets = new Set<any>();

export function registerSocket(ws: any) {
  activeSockets.add(ws);
  // Send current state immediately
  ws.send(JSON.stringify({
    type: "init",
    data: {
      settings,
      metrics,
      logs: logsHistory,
      port: Number(process.env.PORT || 6875)
    }
  }));
}

export function unregisterSocket(ws: any) {
  activeSockets.delete(ws);
}

export function broadcastMetricsUpdate() {
  const message = JSON.stringify({
    type: "update",
    data: {
      metrics,
      latestLog: logsHistory[0],
    }
  });

  for (const ws of activeSockets) {
    try {
      ws.send(message);
    } catch {
      activeSockets.delete(ws);
    }
  }
}

export function broadcastSettingsUpdate() {
  const message = JSON.stringify({
    type: "settings",
    data: settings
  });

  for (const ws of activeSockets) {
    try {
      ws.send(message);
    } catch {
      activeSockets.delete(ws);
    }
  }
}

const DB_PATH = join(import.meta.dirname, "../data/db.json");
console.log(`[Persistence] DB path: ${DB_PATH}`);

// Helper to save data to disk
export function saveToDisk() {
  try {
    const dataDir = join(import.meta.dirname, "../data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const payload = JSON.stringify({
      settings,
      metrics,
      logsHistory
    }, null, 2);
    Bun.write(DB_PATH, payload);
  } catch (err) {
    console.error("[Persistence] Error saving database to disk:", err);
  }
}

// Helper to load data from disk
export function loadFromDisk() {
  try {
    if (existsSync(DB_PATH)) {
      const fileContent = readFileSync(DB_PATH, "utf8");
      const db = JSON.parse(fileContent);
      if (db.settings) {
        settings = { ...settings, ...db.settings };
      }
      if (db.metrics) {
        Object.assign(metrics, db.metrics);
      }
      if (db.logsHistory && Array.isArray(db.logsHistory)) {
        logsHistory.length = 0;
        logsHistory.push(...db.logsHistory);
      }
      console.log(`[Persistence] Loaded settings, metrics, and ${logsHistory.length} logs from disk.`);
      if (db.settings?.server?.port) {
        console.log(`[Persistence] Restored server port: ${db.settings.server.port}`);
      }
    }
  } catch (err) {
    console.error("[Persistence] Error loading database from disk:", err);
  }
}

// Initial load on startup
loadFromDisk();
