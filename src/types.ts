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
  image?: {
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

export interface Metrics {
  totalRequests: number;
  originalTokensSum: number;
  compressedTokensSum: number;
  cacheHits: number;
  totalSavedTokens: number;
  totalSavedCost: number;
}
