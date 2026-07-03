/** A saved project root entry — can be user-created or auto-detected. */
export interface ProjectProfile {
  id: string;
  name: string;
  path: string;
  type: string;
  autoDetected: boolean;
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
    customUrl: string;
    customKey: string;
    customHeader: string;
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
