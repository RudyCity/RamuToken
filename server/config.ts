/**
 * Configuration & State Management
 * Holds active settings, API keys, upstream URLs, and request metrics history.
 */

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
  };
  headroom: {
    enabled: boolean;
    minify: boolean;
    prune: boolean;
    ccr: boolean;
    minCcrLength: number;
    blacklist: string[];
  };
  caveman: {
    enabled: boolean;
  };
  cache: {
    enabled: boolean;
  };
  upstream: {
    bifrostUrl: string;
    openaiKey: string;
    anthropicKey: string;
    preferBifrost: boolean;
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
  },
  headroom: {
    enabled: true,
    minify: true,
    prune: true,
    ccr: true,
    minCcrLength: 200,
    blacklist: ["metadata", "id_token", "hash"],
  },
  caveman: {
    enabled: false, // Turned off by default, opt-in
  },
  cache: {
    enabled: true,
  },
  upstream: {
    bifrostUrl: "http://localhost:8080",
    openaiKey: process.env.OPENAI_API_KEY || "",
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    preferBifrost: true,
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
  };
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
