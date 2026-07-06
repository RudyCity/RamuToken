import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";

/** A saved project root entry — can be user-created or auto-detected. */
export interface ProjectProfile {
  id: string;
  name: string;
  path: string;
  type: string;
  autoDetected: boolean;
}

/** A single custom upstream provider entry (e.g. OpenRouter, Ollama, Together AI). */
export interface CustomProvider {
  id: string;
  name: string;
  url: string;
  key: string;
  header: string;
}

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
    referenceGraphPruning: boolean;
    projectRoot: string;
    projectProfiles: ProjectProfile[];
    activeProfileId: string;
  };
  verification: {
    enabled: boolean;
    testCommand: string;
    maxRetries: number;
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
    level: "low" | "medium" | "high" | "wenyan";
    compressMcpDescriptions: boolean;
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
    /** Active custom provider ID (references an entry in customProviders). */
    activeCustomProviderId: string;
    /** List of all defined custom upstream providers. */
    customProviders: CustomProvider[];
  };
  server: {
    port: number;
    accessToken: string;
  };
  llmlingua: {
    enabled: boolean;
    method: "local" | "api";
    localModel: string;
    rate: number;
    apiModel: string;
    apiPrompt: string;
  };
  image: {
    enabled: boolean;
    triggerModels: string[];
    minCharLength: number;
    maxWidth: number;
    fontSize: number;
    format: "png" | "jpeg";
    quality: number;
    linesPerPage: number;
  };
}

export interface PipelineStep {
  name: string; // "RTK" | "Serena" | "LLMLingua" | "Headroom" | "Caveman" | "Image"
  enabled: boolean;
  inputTokens: number;
  outputTokens: number;
  inputText: string;
  outputText: string;
  /** Base64-encoded images produced by the Image Compression step (raw, no data URI prefix). */
  images?: string[];
  /** MIME sub-type of images (e.g. "png" or "jpeg"). Used to build data URIs in the UI. */
  imageFormat?: "png" | "jpeg";
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
  /** Human-readable error message. Only present when status === "error". */
  errorMessage?: string;
  ccrMappingsCount: number;
  originalPrompt: string;
  compressedPrompt: string;
  pipelineSteps?: PipelineStep[];
}

/** A single LLMLingua compression activity entry. */
export interface LLMLinguaLog {
  id: string;
  timestamp: number;
  method: "local" | "api";
  model: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  durationMs: number;
  status: "success" | "error";
  /** Human-readable error message. Only present when status === "error". */
  errorMessage?: string;
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
    referenceGraphPruning: true,
    projectRoot: "",
    projectProfiles: [],
    activeProfileId: "",
  },
  verification: {
    enabled: false,
    testCommand: "npm test",
    maxRetries: 3,
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
    level: "medium",
    compressMcpDescriptions: false,
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
    activeCustomProviderId: "",
    customProviders: [],
  },
  server: {
    port: 6875,
    accessToken: "",
  },
  llmlingua: {
    enabled: false,
    method: "api",
    localModel: "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
    rate: 0.5,
    apiModel: "auto",
    apiPrompt: "You are an expert context compressor. Your task is to compress the provided text, code, or context to reduce token count while preserving all critical code blocks, semantics, file paths, variables, instructions, and query context. Strip redundant log lines, repetitive details, and conversational fluff. Keep all JSON structures intact. Output ONLY the compressed content, with absolutely no preamble, explanation, or markdown backticks wrapper.",
  },
  image: {
    enabled: false,
    triggerModels: ["gpt-4o", "claude-3-5", "gemini-1.5"],
    minCharLength: 2000,
    maxWidth: 1024,
    fontSize: 13,
    format: "jpeg",
    quality: 80,
    linesPerPage: 50,
  },
};

// In-memory logs history (keep last 200 logs)
export const logsHistory: RequestLog[] = [];
export const maxLogs = 200;

// In-memory LLMLingua activity log (keep last 200 entries)
export const llmLinguaLogsHistory: LLMLinguaLog[] = [];
export const maxLLMLinguaLogs = 200;

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
    verification: { ...settings.verification, ...newSettings.verification },
    llmlingua: { ...settings.llmlingua, ...newSettings.llmlingua },
    image: { ...settings.image, ...newSettings.image },
  };
  saveToDisk();
  return settings;
}

function truncateString(str: any, maxLength: number = 20000): string {
  if (typeof str !== "string") return String(str || "");
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + `\n\n... [Truncated ${str.length - maxLength} characters for memory efficiency]`;
}

export function addLog(log: Omit<RequestLog, "id" | "timestamp">) {
  const logId = Math.random().toString(36).substring(2, 9);
  const imagesDir = join(import.meta.dirname, "../data/images");

  const processedSteps = log.pipelineSteps?.map(step => {
    let stepImages = step.images;
    if (stepImages && stepImages.length > 0) {
      if (!existsSync(imagesDir)) {
        mkdirSync(imagesDir, { recursive: true });
      }
      const format = step.imageFormat || "png";
      stepImages = stepImages.map((b64, idx) => {
        if (b64.startsWith("/api/") || b64.startsWith("http")) {
          return b64;
        }
        let rawBase64 = b64;
        if (b64.startsWith("data:")) {
          const match = b64.match(/^data:image\/[a-zA-Z+-]+;base64,(.+)$/);
          if (match) {
            rawBase64 = match[1];
          }
        }
        const filename = `${logId}_${step.name}_${idx}.${format}`;
        const filePath = join(imagesDir, filename);
        try {
          writeFileSync(filePath, Buffer.from(rawBase64, "base64"));
          return `/api/images/${logId}/${step.name}/${idx}.${format}`;
        } catch (err) {
          console.error("[Persistence] Error writing image file:", err);
          return b64;
        }
      });
    }
    return {
      ...step,
      inputText: truncateString(step.inputText, 10000),
      outputText: truncateString(step.outputText, 10000),
      images: stepImages
    };
  });

  const fullLog: RequestLog = {
    ...log,
    id: logId,
    timestamp: Date.now(),
    originalPrompt: truncateString(log.originalPrompt, 20000),
    compressedPrompt: truncateString(log.compressedPrompt, 20000),
    pipelineSteps: processedSteps
  };

  logsHistory.unshift(fullLog);
  if (logsHistory.length > maxLogs) {
    const evicted = logsHistory.pop();
    if (evicted && evicted.pipelineSteps) {
      for (const step of evicted.pipelineSteps) {
        if (step.images) {
          const format = step.imageFormat || "png";
          step.images.forEach((_, idx) => {
            const filePath = join(imagesDir, `${evicted.id}_${step.name}_${idx}.${format}`);
            if (existsSync(filePath)) {
              try {
                unlinkSync(filePath);
              } catch (err) {
                console.error("[Persistence] Error deleting evicted image file:", err);
              }
            }
          });
        }
      }
    }
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

/** Record a single LLMLingua compression activity. */
export function addLLMLinguaLog(log: Omit<LLMLinguaLog, "id" | "timestamp">) {
  const fullLog: LLMLinguaLog = {
    ...log,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    originalPrompt: truncateString(log.originalPrompt, 20000),
    compressedPrompt: truncateString(log.compressedPrompt, 20000),
  };

  llmLinguaLogsHistory.unshift(fullLog);
  if (llmLinguaLogsHistory.length > maxLLMLinguaLogs) {
    llmLinguaLogsHistory.pop();
  }

  saveToDisk();
  broadcastLLMLinguaLogUpdate(fullLog);

  return fullLog;
}

/** Clear all logs history and reset cumulative metrics. */
export function clearHistory() {
  logsHistory.length = 0;
  llmLinguaLogsHistory.length = 0;
  metrics.totalRequests = 0;
  metrics.originalTokensSum = 0;
  metrics.compressedTokensSum = 0;
  metrics.cacheHits = 0;
  metrics.totalSavedTokens = 0;
  metrics.totalSavedCost = 0;

  // Clear images directory as well
  const imagesDir = join(import.meta.dirname, "../data/images");
  if (existsSync(imagesDir)) {
    try {
      const files = readdirSync(imagesDir);
      for (const file of files) {
        unlinkSync(join(imagesDir, file));
      }
    } catch (err) {
      console.error("[Persistence] Error clearing images directory:", err);
    }
  }

  saveToDisk();

  // Broadcast to all active sockets
  const message = JSON.stringify({
    type: "clear_history",
    data: {
      metrics,
      logs: [],
      llmLinguaLogs: [],
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
      llmLinguaLogs: llmLinguaLogsHistory,
      port: Number(process.env.PORT || 6875),
      cwd: process.cwd()
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

/** Broadcast a new LLMLingua log entry to all connected WebSocket clients. */
export function broadcastLLMLinguaLogUpdate(latestLog: LLMLinguaLog) {
  const message = JSON.stringify({
    type: "llmlingua_log",
    data: { latestLog }
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
      logsHistory,
      llmLinguaLogsHistory
    }, null, 2);
    writeFileSync(DB_PATH, payload);
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
      if (db.llmLinguaLogsHistory && Array.isArray(db.llmLinguaLogsHistory)) {
        llmLinguaLogsHistory.length = 0;
        llmLinguaLogsHistory.push(...db.llmLinguaLogsHistory);
      }
      console.log(`[Persistence] Loaded settings, metrics, ${logsHistory.length} proxy logs, and ${llmLinguaLogsHistory.length} LLMLingua logs from disk.`);
      if (db.settings?.server?.port) {
        console.log(`[Persistence] Restored server port: ${db.settings.server.port}`);
      }

      // ── Backward-compat migration: single customUrl → customProviders array ──
      const u = settings.upstream as any;
      if (u.customUrl && (!u.customProviders || u.customProviders.length === 0)) {
        const migratedId = Math.random().toString(36).substring(2, 10);
        const migratedProvider: CustomProvider = {
          id: migratedId,
          name: "Custom Upstream",
          url: u.customUrl || "",
          key: u.customKey || "",
          header: u.customHeader || "Authorization",
        };
        settings.upstream.customProviders = [migratedProvider];
        settings.upstream.activeCustomProviderId = migratedId;
        // Remove legacy fields
        delete u.customUrl;
        delete u.customKey;
        delete u.customHeader;
        console.log("[Persistence] Migrated legacy customUrl to customProviders array.");
        saveToDisk();
      }
    }
  } catch (err) {
    console.error("[Persistence] Error loading database from disk:", err);
  }
}

// Initial load on startup
loadFromDisk();
