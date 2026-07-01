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

export interface Metrics {
  totalRequests: number;
  originalTokensSum: number;
  compressedTokensSum: number;
  cacheHits: number;
  totalSavedTokens: number;
  totalSavedCost: number;
}
