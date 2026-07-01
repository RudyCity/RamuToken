# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-01

### Added
- **Custom Upstream Endpoint**: Added support for routing proxy requests to any custom OpenAI-compatible API endpoint (e.g., Together AI, OpenRouter, Ollama, LiteLLM, or any self-hosted gateway).
  - New toggle **"Route via Custom Upstream Endpoint"** in Settings → Upstream Routing section.
  - Configurable **Custom Endpoint URL**, **Auth Header Name** (e.g., `Authorization`, `x-api-key`), and **Custom API Key** fields.
  - `Bearer` prefix is auto-prepended for `Authorization` headers when not already present.
  - Custom upstream and Bifrost toggles are **mutually exclusive** — enabling one automatically disables the other.
  - Dashboard "Target Router" card now shows **Custom Upstream** status (green) alongside Bifrost (cyan) and Direct API (purple), with the active endpoint URL displayed.
  - Bifrost and Direct Fallback Keys sections are hidden in Settings when Custom Upstream is active, keeping the UI clean and focused.

### Changed
- **`server/config.ts`**: Extended `CompressorSettings.upstream` interface with `preferCustom`, `customUrl`, `customKey`, and `customHeader` fields with safe defaults.
- **`server/proxy.ts`**: Updated `fetchUpstream()` routing priority: Custom → Bifrost → Direct API.
- **`src/types.ts`**: Updated frontend `CompressorSettings.upstream` type to include the four new fields.
- **`src/App.tsx`**: Added new fields to initial settings state; updated `toggleSettingsField` to enforce mutual exclusion between `preferCustom` and `preferBifrost`.

---

## [1.2.2] - 2026-07-01

### Added
- **License File**: Created MIT License file with copyright attribution to Rudy H.

### Changed
- **Author Attribution**: Added Rudy H. author attribution across `package.json`, dashboard footer in `App.tsx`, and project `README.md`.

---

## [1.2.1] - 2026-07-01

### Docs
- **README Overhaul**: Recreated and expanded `README.md` to fully document all recent features (Access Token Authentication, Dual API Endpoint Prefixes, OpenAI-to-Anthropic Transpilation Layer, Configurable Ports, and Bifrost Auto-Spawn).

---

## [1.2.0] - 2026-07-01

### Added
- **Dual API Endpoint Prefixes**: Added dedicated prefixes for routing OpenAI and Anthropic requests:
  - OpenAI URL: `http://localhost:<PORT>/openai/v1`
  - Anthropic URL: `http://localhost:<PORT>/anthropic/v1`
- **OpenAI-to-Anthropic Transpilation Layer**: Added full request and response translation handlers (`translateOpenAIToAnthropic`, `translateAnthropicToOpenAI`, and stream mapper `makeAnthropicToOpenAIStream`) inside the proxy. If a client targets `/anthropic/v1/chat/completions` (OpenAI chat completion format), the proxy translates the request payload, fetches from Anthropic, and maps the response chunks back to OpenAI format. This allows seamless integration of Claude models in Cursor without requiring Bifrost.
- **Improved Settings UI**: Exposes copy buttons for both OpenAI and Anthropic endpoint URLs in the settings tab.

---

## [1.1.5] - 2026-07-01

### Added
- **RamuToken Access Token Authentication**: Added support for securing proxy endpoints (`/v1/*`) using a custom authorization key (`settings.server.accessToken`). Included a new card inside the Settings tab featuring endpoint URL copy-paste buttons, visibility toggle, and a cryptographic random key generator ("Gen Key"). Unauthenticated proxy requests receive a 401 Unauthorized response.

---

## [1.1.4] - 2026-07-01

### Fixed
- **Windows Process Spawning ENOENT**: Replaced `npx` with native `bun x` to spawn Bifrost in `dev.ts`. This resolves `ENOENT` process spawning errors on Windows where calling shell wrappers like `npx` directly without `.cmd` fails.

---

## [1.1.3] - 2026-07-01

### Added
- **Configurable Server Port via UI**: Added a new "RamuToken Proxy Port" number input field in `SettingsTab.tsx` next to the Bifrost Endpoint URL. The server now checks `process.env.PORT` first, then falls back to `settings.server.port` loaded from `db.json`, before defaulting to `6875`. If the configured port differs from the running port, a warning badge is displayed indicating that a server restart is required.

---

## [1.1.2] - 2026-07-01

### Added
- **Dynamic Custom Port Info**: Exposed the active backend server port (via environment variables or default `6875`) through the WebSocket handshake. Added `backendPort` state to `App.tsx`, and updated both `DashboardTab` and `SettingsTab` to dynamically display the correct AI Client endpoint base URL (e.g. `http://localhost:<PORT>/v1`) based on the active backend port.

---

## [1.1.1] - 2026-07-01

### Fixed
- **UI Toggle Component**: Added missing dynamic `on` / `off` classes to the `Toggle` component's wrapper in `SettingsTab.tsx` so the toggle switch knob (thumb) animates and repositions correctly on state changes.

---

## [1.1.0] - 2026-07-01

### Changed
- **Full UI Overhaul**: Complete visual redesign across all components.
  - `index.css`: Added Google Fonts import (Outfit + JetBrains Mono), `text-xxs` utility, CSS-only toggle switch, pipeline-dot blink animation, body radial gradient, glassmorphism strengthened with `saturate(180%)`, scan-line code-area overlay, and `glass-panel-glow-pink`.
  - `App.tsx`: Refactored header to a true 3-column layout (logo | nav center | status badge right), improved WebSocket auto-reconnect, navigation tabs have unique `id` attributes, version constant `APP_VERSION` centrally defined.
  - `DashboardTab.tsx`: Metric cards now have mini progress bars; pipeline status panel shows animated blink dots; bar chart bars use dynamic savings colour gradient; log table savings column dynamically coloured (green→amber→pink); entire log row is clickable; detail modal shows savings colour on compressed token count and coloured border on compressed prompt pane.
  - `SettingsTab.tsx`: All boolean toggles replaced with animated `Toggle` switch component; new **Bifrost Test Connection** button pings the configured endpoint and reports online/offline + latency; pipeline sections have colour-tinted background when active; checkboxes replaced with custom styled component; all inputs have unique `id` attributes.
  - `TestBenchTab.tsx`: Output panel border and label colour dynamically reflect compression ratio (HSL red→green); SVG arc gauge displays compression percentage; copy button shows "Copied!" feedback; loading spinner shown in output pane during compression.

---

## [1.0.9] - 2026-07-01

### Added
- **Bifrost Auto-Spawn in Dev Mode**: `dev.ts` now automatically detects if Bifrost is already running on port 8080. If not, it spawns Bifrost via `npx -y @maximhq/bifrost` before starting the proxy server and Vite client. Bifrost stdout/stderr is prefixed and piped to the console. Includes a 30-second readiness timeout with a graceful warning if Bifrost does not become ready in time. Bifrost is killed on process exit alongside the other services.

---

## [1.0.8] - 2026-07-01

### Added
- **Architecture Diagrams in README**: Added Mermaid flowchart and sequence diagram to `README.md` documenting the full request/response lifecycle, including compression pipelines, caching, upstream routing, CCR restoration, and WebSocket broadcasting.

---

## [1.0.7] - 2026-07-01

### Added
- **Settings & Metrics Persistence**: Implemented local JSON database (`data/db.json`) saving settings, logs, and cumulative statistics across proxy server restarts.
- **AST Dependency Resolution**: Upgraded Serena pipeline to recursively resolve caller-callee dependencies, preventing dependent helper functions from being pruned.
- **Eviction Cache Policy**: Bounded CCR registry size to 1,000 mappings and added a 30-minute Time-To-Live (TTL) expiration on substitutions to prevent memory leaks in production.
- **Customizable Caveman Levels**: Added settings panel level configurations (Low, Medium, High) for the Caveman prompt injector.

## [1.0.6] - 2026-07-01

### Fixed
- **countTokens Reference Error**: Resolved client-side `ReferenceError: countTokens is not defined` bug in the Test Bench tab.

### Changed
- **Modularized Dashboard**: Refactored `src/App.tsx` by splitting the monolithic file into smaller modular files (`src/types.ts`, `src/utils/token.ts`, `src/components/DashboardTab.tsx`, `src/components/TestBenchTab.tsx`, `src/components/SettingsTab.tsx`) to strictly obey the 1000-line codebase file limit.

## [1.0.5] - 2026-07-01

### Changed
- **Documentation Port References**: Updated historical and legacy references to port `3000` to `6875` in all documentation files.

## [1.0.4] - 2026-07-01

### Changed
- **Default Backend Port**: Changed the default proxy backend server port from `3000` to `6875` to resolve port conflicts. Updated all configurations, dashboard connection fallbacks, and documentation.

## [1.0.3] - 2026-07-01

### Added
- **Full Test Coverage**: Expanded the unit test suite to cover all edge cases across RTK, Serena, Headroom, Caveman, and Cache modules, reaching 100% test coverage.

## [1.0.2] - 2026-07-01

### Changed
- **Project Rename**: Renamed the project from "Token Compressor" to **RamuToken** (`ramu-token` for package name) across configuration settings, title headers, footers, test scripts, and agent rules.

## [1.0.1] - 2026-07-01

### Added
- **Workspace Agent Rules**: Created `.agents/AGENTS.md` containing strict guidelines for commits, automatic SemVer bumping, changelog entries, modular scalability best practices, and a 1000-line limit per file.

## [1.0.0] - 2026-07-01

### Added
- **Integrated Proxy Server**: Added `Bun.serve` server running on port `6875` supporting both OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`) compatible request/response structures.
- **WebSocket Streaming**: Created live WebSocket communication for feeding metrics, configuration settings, and logs history to the frontend dashboard.
- **Upstream Router**: Implemented flexible routing targeting **Bifrost by Maxim AI** (`http://localhost:8080`) or direct provider fallback keys (OpenAI & Anthropic).
- **RTK Compression Engine**: Implemented ANSI control code stripping, log line collapsing (grouping timestamp/number/hex matches), relative path normalization, and stack trace pruner (retaining top 3 and bottom 2 frames).
- **Serena AST Pruner**: Created JS/TS and Python function/method pruner that prunes bodies not referenced in the user's prompt keywords.
- **Headroom Structural Layer**: Implemented JSON whitespace minifying, empty/null metadata key pruner, and Reversible Context Substitution (CCR) replacing long blocks with dynamic `{{HR_CCR_X}}` tokens.
- **Caveman prose Injector**: Implemented system prompt modifier forcing models to speak in low-token keywords and omit conversational fluff.
- **Cache & Prompt Optimizer**: Implemented deterministic hashing key generator and local response cache to prevent redundant API calls.
- **Integrated Dashboard**: Built React, Vite, and Tailwind CSS v4 dashboard client. Features include:
  - Real-time token metrics, cost estimations, and cache hit statistics.
  - Interactive SVG Sparkline charts showing savings rate history.
  - Test Bench sandbox with side-by-side original/compressed visualizer and token estimator.
  - Pipelines toggle and parameter configurations panel.
  - Auto-updating logs table with a detail model viewer.
- **Test Suite**: Created Vitest-compatible unit tests under `server/tests/pipelines.test.ts` running via `bun test`.
- **Workspace Tooling**: Added `dev.ts` concurrent process runner and detailed `IMPLEMENTATION_PLAN.md`.
