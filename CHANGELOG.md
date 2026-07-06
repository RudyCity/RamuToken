# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.10] - 2026-07-06

### Fixed
- **`src/components/DashboardTab.tsx`**: Prevented background page scrolling when scrolling the mouse wheel to zoom the image inside the lightbox modal. The page scroll overflow of the body is now locked (`overflow: hidden`) when the lightbox is open.

## [1.4.9] - 2026-07-06

### Added
- **`src/components/DashboardTab.tsx`**: Enhanced the image lightbox modal to support interactive zoom and panning. Added mouse wheel zooming, click-and-drag panning, double-click to toggle zoom, and touch event support. Also added a zoom toolbar (Zoom In, Zoom Out, current percentage, and Reset Zoom button) to the lightbox header.

## [1.4.8] - 2026-07-06

### Fixed
- **`server/proxy.ts`**: Updated `messagesToText()` to use `contentToText()`. This fixes a bug where individual pipeline step prompt logs (Before/After panels in the UI) were showing `[object Object]` when displaying complex multi-part messages.

## [1.4.7] - 2026-07-06

### Changed
- **`server/proxy.ts`**: Upgraded `extractImagesFromMessages()` to support Anthropic-style base64 image structures in addition to OpenAI's `image_url` data URIs. Made `runStep` capture base64 images generically for *any* pipeline step that processes or contains them (not just the Image Compression step).
- **`src/components/DashboardTab.tsx`**: Updated the UI rendering logic so that if the user selects "All Steps", the gallery automatically scans and displays images from the first step that contains them (e.g. initial request images or system instructions rendered as images).

## [1.4.6] - 2026-07-06

### Fixed
- **`server/proxy.ts`**: Added `contentToText()` helper to safely serialize complex message content (which can be a string or an array of message/image parts) to a clean human-readable string. Fixed a bug where message arrays containing structured parts or image objects were serialized as `[object Object]` in the Activity Explorer's prompt view.

## [1.4.5] - 2026-07-06

### Added
- **`src/types.ts`**: Added optional `images?: string[]` and `imageFormat?: "png" | "jpeg"` fields to `PipelineStep` interface so the Image Compression step can carry generated image data to the UI.
- **`server/config.ts`**: Synced `PipelineStep` interface with the updated frontend type — added `images?` and `imageFormat?` fields.
- **`server/proxy.ts`**: Added `extractImagesFromMessages()` helper that extracts base64 image data from messages produced by the Image Compression step. Modified `runStep` to automatically capture and attach generated images to the pipeline step entry when the `Image` step is enabled.
- **`src/components/DashboardTab.tsx`**: Added `ImageGallery` component with thumbnail grid, full-screen lightbox (keyboard navigation with ← / → / Esc), individual image download, and thumbnail strip for multi-page navigation. The gallery renders automatically in the Activity Explorer right panel whenever the selected log contains Image Compression output.

## [1.4.4] - 2026-07-06

### Added
- **`server/config.ts`**: Implemented `clearHistory()` to clear the proxy and direct LLMLingua logs arrays, reset all cumulative metrics back to zero, save the reset state to disk, and broadcast a `clear_history` message over WebSockets.
- **`server/index.ts`**: Registered a new POST `/api/clear-history` endpoint that triggers history deletion.
- **`src/App.tsx`**: Added support for WebSocket `clear_history` events to reset dashboard UI state and created a confirmation flow before clearing history.
- **`src/components/DashboardTab.tsx`**: Added a stylish "Clear History" button next to the tab headers with confirmation tooltips and a soft red hover styling.

## [1.4.3] - 2026-07-06

### Changed
- **`src/components/ImageSettings.tsx`**: Improved model selection UX. The dropdown now opens automatically when clicking "Sync Provider Models" or interacting with the search input. It lists all matching models scrollably and shows checkmarks on selected models to toggle them directly within the list.

## [1.4.2] - 2026-07-06

### Fixed
- **`src/components/ImageSettings.tsx`**: Fixed alignment of the Master Toggle by adding `items-center` to the flex container and correcting a nested ternary syntax error, resolving the issue where the switch thumb appeared crooked/misaligned.

## [1.4.1] - 2026-07-06

### Fixed
- **`server/config.ts`**: Switched from `Bun.write` to Node's native `writeFileSync` which correctly truncates the persistence file before saving, preventing SyntaxErrors caused by trailing old data.
- **`data/db.json`**: Created a database repair utility to clean up trailing JSON corruption while successfully preserving existing settings.

## [1.4.0] - 2026-07-06

### Added
- **`server/pipelines/image.ts`**: Created a new Image Compression pipeline utilizing `@napi-rs/canvas` to render long text messages to high-contrast images, split them into pages, and format them as base64 data URI parts to bypass text token costs.
- **`src/components/ImageSettings.tsx`**: Created a dedicated settings card component for configuring target models, dimensions, font size, lines per page, format, and JPEG quality.
- **Image Compression settings**: Exposed `image` configurations in settings schemas on both frontend (`types.ts`) and backend (`config.ts`).

### Changed
- **`server/proxy.ts`**: Integrated the new `"Image"` step into `compressMessageList`. Updated `countPayloadTokens`, `messagesToText`, and `translateOpenAIToAnthropic` to handle array-based content parts (including base64 images) and preserve strict user/assistant role alternating sequence via role merging.
- **`src/components/SettingsTab.tsx`**: Rendered the new `ImageSettings` component as Section 5 in the configuration list.
- **`src/App.tsx`**: Added the new `Image Compressor` to the Pipeline status indicator, and updated state toggling logic to support the new `image` settings block.

## [1.3.57] - 2026-07-06

### Added
- **`src/App.tsx`**: Implemented initial HTTP data fetch on mount to load settings, metrics, and logs immediately without waiting for WebSocket connection.
- **`src/App.tsx`**: Added an automatic fallback HTTP polling mechanism (every 3 seconds) that auto-updates metrics and logs when the WebSocket is disconnected, ensuring dashboard state freshness under proxy/network restrictions.

### Fixed
- **`src/App.tsx`**: Added a WebSocket `onerror` handler to log warnings, helping diagnose WebSocket handshake issues.

## [1.3.56] - 2026-07-03

### Fixed
- **`server/index.ts`**: Cast `error.code` via `Number()` to resolve `TS2322` — Node's exec callback types `error.code` as `string | number | undefined`, which was incompatible with the `number` return slot.
- **`server/pipelines/rtk.ts`**: Added missing `unlinkSync` to the `fs` import — it was used on line 148 for temp zip cleanup but was never imported, causing `TS2304 Cannot find name 'unlinkSync'`.
- **`server/pipelines/serena.ts`**: Removed unused `mkdirSync` from `fs` import (`TS6133`).
- **`src/components/DashboardTab.tsx`**: Removed unused lucide-react imports (`ChevronsLeft`, `ChevronsRight`, `HardDrive`, `ShieldCheck`); replaced unused state declarations (`tweetCopied`, `llmLinguaPage`, `LLMLINGUA_PAGE_SIZE`) with removals; converted `itemsPerPage` from `useState` to a plain `const` since the setter was never used; prefixed unused destructured props (`settings`, `backendPort`) with `_` to suppress `TS6133`.
- **`src/components/SettingsTab.tsx`**: Removed unused `ChevronDown` from lucide-react import (`TS6133`).

## [1.3.55] - 2026-07-03

### Fixed
- **Caveman: `compressedPrompt` snapshot bug**: `compressedPrompt` in `proxy.ts` was incorrectly captured from a pre-Caveman snapshot (`preCavemanMessages`), causing the logged/displayed compressed prompt to be missing Caveman instruction content. Now correctly reflects the final post-pipeline output from `currentMessages`.
- **Caveman: Anthropic array-content crash**: `injectCavemanPrompt` called `.includes()` directly on `message.content`, which would fail silently or behave incorrectly when `content` is an Anthropic-format array of blocks (`[{type: "text", text: "..."}]`). Added `extractTextContent()` helper to safely normalize content to a plain string before processing.
- **Caveman: `cavemanCompressProse` ignored `level` param**: The `level` parameter was prefixed with `_` and completely unused. Now `level === 'low'` correctly skips prose restructuring (since low mode only strips filler phrases via system instruction, not by restructuring prose). Medium/high/wenyan continue to use caveman-shrink.
- **Caveman: Removed unnecessary `preCavemanMessages` snapshot** in `compressMessageList`; the variable was only used to feed the now-fixed `compressedPrompt`.

## [1.3.54] - 2026-07-03

### Fixed
- **Pipeline Inspector Auto-select & Steps Timeline Sync**: Implemented smart reactive auto-selection in `DashboardTab.tsx`. When a new request arrives, if the user was previously viewing the latest request (or had no request selected yet), it automatically shifts focus to the newly arrived active request. This ensures that the interactive **Pipeline Steps Timeline** and the side-by-side prompt diff panels update in real time with the active request's structure instead of remaining stuck on older requests.

## [1.3.53] - 2026-07-03

### Changed
- **Pipeline Status in Header Dropdown**: Moved the Pipeline Status card and the routing flow visualization from the dashboard right-hand column into an interactive dropdown menu in the app header. This makes pipeline statuses accessible at all times from any tab (Dashboard, Playground, Settings).
- **Dashboard Layout Reorganization**: Removed the empty right-hand column layout completely. The Dashboard tab now consists of three clean, full-width blocks stacked vertically: the 4-column Metrics row, the high-detail Compression History chart, and the Pipeline Activity Explorer.

## [1.3.52] - 2026-07-03

### Removed
- **Caveman Stats & Badge**: Removed the redundant stats and share badge card from the right column layout to keep the dashboard minimal and clean.

## [1.3.51] - 2026-07-03

### Changed
- **Full-Width Layout for Pipeline Activity Explorer**: Relocated the Activity Explorer outside of the 2-column dashboard layout to give it full screen width. Changed the split-panel column allocation to `4/12` (for list) and `8/12` (for inspector) to provide maximum horizontal width for the side-by-side prompt diff panels, dramatically improving readability of code changes.

## [1.3.50] - 2026-07-03

### Changed
- **Split-Panel Pipeline Activity Explorer**: Replaced the confusing multi-tab log tables and popup modal detail views with a side-by-side split-panel explorer. The left side shows a clean list of requests with pagination, while the right side displays the selected request's latency, total savings, step-by-step interactive pipeline timeline, and side-by-side prompt diffs for each step.
- **Auto-Selection**: Added reactive selection logic to auto-select the first log on page load or tab changes, preserving active selection when new proxy logs are appended.

## [1.3.49] - 2026-07-03

### Added
- **Unified Tabbed logs**: Combined the request logs, individual compression module progression steps (RTK, Serena, LLMLingua, Headroom, Caveman), and direct LLMLingua activity into a unified tabbed logs panel with inline pagination.
- **Relative Time (Age) Ticker**: Added a live relative age counter (`Age` column) for all logs, updating every 5 seconds (e.g. "Just now", "10s ago", "2m ago") with full timestamp tooltips.
- **Latency Column**: Changed Duration/Time column headers to `Latency` across all tabbed views to accurately represent request round-trip times.

## [1.3.48] - 2026-07-03

### Added
- **Pipeline Steps Progression Comparison**: Added a detailed breakdown table within the request log detail modal showing the step-by-step transformation of the prompt.
- **Interactive Step Inspection**: Clicking any active step in the progression table (e.g. `RTK`, `Serena`, `LLMLingua`, `Headroom`, `Caveman`) dynamically updates the prompt diff panels below to show the specific text transition ("Before [Step]" vs "After [Step]") and token counts for that module alone.
- **`PipelineStep` interface**: Added to both `server/config.ts` and `src/types.ts` containing the step name, enabled status, input/output token counts, and input/output text representations.

### Changed
- **`server/proxy.ts`**: Refactored the core `compressMessageList` pipeline to execute sequentially across all messages and capture intermediate state transitions as structured `PipelineStep` objects. Added `pipelineSteps` to request logs saved in cache hits and upstream results.

## [1.3.47] - 2026-07-03

### Added
- **LLMLingua Activity Log**: Added a dedicated, separate activity log table for the LLMLingua compression pipeline in the Dashboard. Every compression attempt (success and error) is now recorded with: timestamp, method (`LOCAL` / `API`), model used, original & compressed token counts (estimated), savings percentage, duration in ms, status, and the **original & compressed text content** (`originalPrompt` and `compressedPrompt`). The log persists to `data/db.json` and streams in real-time via a new `llmlingua_log` WebSocket event.
- **Log Detail Dialog Integration**: Added a **"View"** action button to the LLMLingua Activity table. Clicking it opens the same interactive side modal used by the main proxy logs, displaying the side-by-side comparison of the prompt text before and after LLMLingua compression.
- **`LLMLinguaLog` interface**: Added to both `server/config.ts` and `src/types.ts` with original & compressed prompt string fields.
- **`GET /api/llmlingua-logs` endpoint**: New REST endpoint that returns the full in-memory LLMLingua log history.
- **`addLLMLinguaLog()` function**: Handles log storage, disk persistence, and WebSocket broadcast.
- **`broadcastLLMLinguaLogUpdate()` function**: Sends a `llmlingua_log` WebSocket event in real-time.

### Changed
- **`server/pipelines/llmlingua.ts`**: Instrumented with timing (`Date.now()`), token estimation (`text.length / 4`), and captures the text inputs and outputs around every compression path to produce structured logs.
- **`server/config.ts`**: Included `llmLinguaLogs` in initial WebSocket payloads and disk persistence (`saveToDisk`/`loadFromDisk`).
- **`src/App.tsx` & `DashboardTab.tsx`**: Updated states and component parameters to support both `RequestLog` and `LLMLinguaLog` types inside the shared detail view modal.

## [1.3.46] - 2026-07-03

### Added
- **Proxy Activity Log Error Details**: Added a dedicated `errorMessage` field to the `RequestLog` type (both frontend and server). Failed requests now display a human-readable error message directly in the log table (truncated, with full text on hover tooltip) and a prominent **"Error Details"** section in the request detail modal styled in red. Previously, error rows only showed a generic red `ERR` badge with no further information.

### Changed
- **Error Capture in proxy.ts**: All `addLog` calls with `status: "error"` now populate `errorMessage` with the actual failure reason — `HTTP <status>: <body>` for upstream HTTP errors, or the exception message for network/runtime failures. The old workaround of overwriting `compressedPrompt` with `err.message` has been removed.

---

## [1.3.45] - 2026-07-03

### Added
- **Multiple Custom Upstream Providers**: Replaced the single "Route via Custom Upstream Endpoint" configuration with a fully-featured multi-provider management system. Users can now define, name, edit, delete, and switch between multiple custom upstream providers (e.g. OpenRouter, Together AI, Ollama, LiteLLM) directly from the Settings UI. Each provider entry stores its own URL, API key, and auth header. A radio-style "Set Active" control selects which provider handles live requests. Per-provider connectivity **Test** buttons show latency inline on each card.
- **Backward-Compatible Migration**: On first start after upgrade, any existing `customUrl`/`customKey`/`customHeader` config in `db.json` is automatically migrated into the new `customProviders` array format with the provider set as active — no data loss.

### Changed
- **Dashboard Active Provider Display**: The upstream routing card in the Dashboard now shows the **name** of the active custom provider instead of a raw URL.
- **Server Proxy Routing** (`proxy.ts`, `upstream.ts`): All upstream routing logic now resolves the active provider via `activeCustomProviderId` → `customProviders` lookup instead of the retired single-field approach.

---

## [1.3.44] - 2026-07-03

### Added
- **Serena LSP Inactive Eviction (GC)**: Added a background daemon thread (`serena_gc_worker`) in [daemon.py](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/pipelines/daemon.py) that periodically checks for loaded Language Server projects and shuts them down (`project.shutdown()`) if they have been inactive for more than 10 minutes (600 seconds). This completely prevents memory accumulation leaks.

### Changed
- **RTK Subprocess Spawning Optimization**: Updated [proxy.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/proxy.ts) to only run RTK compression on messages longer than 150 characters, skipping subprocess spawning overhead for all short query messages.

---

## [1.3.43] - 2026-07-03

### Changed
- **LLMLingua Compression Triggers**: Optimized the calling logic for the LLMLingua compression pipeline in [proxy.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/proxy.ts). It now strictly targets messages with `user` or `tool` roles whose length exceeds 300 characters, avoiding costly neural/API operations on short user messages and structured assistant history.

---

## [1.3.42] - 2026-07-03

### Changed
- **Asynchronous File I/O in RTK & Serena**: Converted synchronous file operations (`writeFileSync`, `unlinkSync`, `rmSync`) inside [rtk.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/pipelines/rtk.ts) and [serena.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/pipelines/serena.ts) to asynchronous operations (`promises.writeFile`, `promises.unlink`, `promises.rm`) to eliminate Node/Bun event loop blocking.
- **Asynchronous Verification Loop**: Replaced blocking `execSync` inside `/api/verify` route in [index.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/index.ts) with Promise-wrapped `exec` from `child_process` to keep the proxy server fully responsive while running tests.
- **Persistent SQLite Cache**: Upgraded the volatile in-memory request cache in [cache.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/pipelines/cache.ts) to a persistent SQLite-backed cache using Bun's native `bun:sqlite` Database, maintaining cached responses across restarts.
- **Hybrid Concurrent Python Daemon**: Refactored [daemon.py](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/pipelines/daemon.py) to run Serena LSP actions on the main thread (securing thread safety and asyncio compatibility for language server operations) while offloading LLMLingua and Headroom requests to a `ThreadPoolExecutor` concurrent pool.
- **Robust Python Command Resolution**: Modified `getPythonCommand` in [python_daemon.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/RamuToken/server/pipelines/python_daemon.ts) to resolve the absolute path of the Python executable using the `py` launcher, preventing stdout buffering and lockups under child process redirection.

---

## [1.3.41] - 2026-07-03

### Fixed
- **Bifrost Anthropic API Routing**: Fixed `405 Method Not Allowed` when calling Anthropic models via Bifrost by automatically mapping `/v1/messages` endpoint to `/anthropic/v1/messages` when `preferBifrost` is enabled, matching Bifrost's external API specifications.

---

## [1.3.40] - 2026-07-03

### Changed
- **Gitignore Improvements**: Added Python-specific runtime cache directories (`__pycache__/`, `*.pyc`, etc.) and the local `.serena/` diagnostics directory to `.gitignore` to keep repository state clean.

---

## [1.3.39] - 2026-07-03

### Fixed
- **Dynamic Python Command Resolution**: Added `getPythonCommand()` utility in `python_daemon.ts` that tries `python`, `py`, then `python3` executables in order. This fixes test failures and daemon spawn errors on Windows systems where only `py` is available, and on Linux/Mac where only `python3` is the canonical alias.
- **`serena.ts` and `benchmark.ts`**: Updated `serenaGetSymbols()` and benchmark helpers to use `getPythonCommand()` instead of hardcoded `"python"` strings.
- **Unused Import Cleanup (all TypeScript errors resolved)**: Removed unused imports across multiple files: `RefreshCw` in `LLMLinguaSettings.tsx`, `Plus`/`X` in `ProjectProfileSelector.tsx`, `Plus`/`Search`/`ShieldCheck` in `PlaygroundTab.tsx` and `SettingsTab.tsx`, `spawnSync` in `headroom.ts`, `existsSync` in `python_daemon.ts`, `spawn`/`unlinkSync` in `serena.ts`, `RequestLog` in `proxy.ts`.
- **Removed unused `activeGradient` prop**: Dropped `activeGradient` from the `PipelineSectionProps` interface and all `<PipelineSection>` call sites in `SettingsTab.tsx` and `SettingsHelpers.tsx` since the prop was never used in the component body.
- **`cavemanShrink` unused `level` param**: Fixed unused parameter warning in `caveman.ts`.

---

## [1.3.38] - 2026-07-03

### Fixed
- **Duplicate CodeBlock Type shadowing**: Removed duplicate unused interface `CodeBlock` in `server/pipelines/serena.ts` which was shadowing the main one and causing AST block parsing type errors.
- **Frontend State Initialization**: Added missing `server` and `llmlingua` settings to the default settings state in `src/App.tsx`.
- **TypeScript Type Definitions**: Added `@types/node` and `@types/bun` to devDependencies and cast various process streams, mock fetch requests, and proxy errors to resolve backend type checking issues.

---

## [1.3.37] - 2026-07-03

### Changed
- **Modern Dashboard Relayout**: Redesigned the main dashboard into a well-balanced 2-column layout. The left column spans 2/3 width hosting metric cards, compression charts, and the proxy activity log. The right column spans 1/3 width as a sticky control panel featuring the live Pipeline Status list and Caveman prose badge.
- **Interactive Router Flow Visualization**: Added an aesthetically rich cyber-punk network connection path inside the Pipeline card showing real-time client agent to RamuProxy proxy gateway to target upstream connections.

---

## [1.3.36] - 2026-07-03

### Added
- **Project Profiles & Filesystem Auto-Detection**: Added support for configuring and managing multiple project profiles (name + path + type) instead of a single global root override.
- **Project Auto-Scan Utility**: Implemented a scanning mechanism (`server/utils/scanProjects.ts`) that walks the directories near the server's working directory to detect software projects by looking for marker files (like `.git`, `package.json`, `pyproject.toml`, `Cargo.toml`).
- **Reusable Project Selector Component**: Created `ProjectProfileSelector.tsx` dropdown featuring color-coded type badges (Node/Bun, Python, Rust, Go, Java, C/C++), automatic directory scan triggers, and manual path inputs.
- **Playground Integration**: Integrated the Project Profile Selector directly into both the semantic search playground and code verification playground tabs.

### Changed
- **Unified Settings Resolution**: Updated backend endpoint handlers to resolve the active project root using a strict fallback chain: request override → active profile path → global default root → server CWD.

---

## [1.3.35] - 2026-07-03

### Changed
- **Pipeline Status Card Updated**: Added 3 missing pipeline rows to the Dashboard's Pipeline Status card — **LLMLingua** (AI prompt compressor), **Request Cache** (zero-token identical replay), and **Verification Loop** (compiler & test self-correction). All 7 active pipelines are now reflected with live ACTIVE/IDLE status badges.

---

## [1.3.34] - 2026-07-03

### Added
- **URL Hash-Based Tab Routing**: Tab navigation now syncs with the URL hash (`#dashboard`, `#testbench`, `#settings`). Refreshing the page or sharing a URL preserves the active tab. Browser back/forward navigation also works correctly. Tab links changed from `<button>` to `<a href="#tabId">` elements for proper URL semantics.

---

## [1.3.33] - 2026-07-03

### Added
- **Auto-Detection of Project Root Directory**: The backend now transmits its working directory (`process.cwd()`) to the frontend via the WebSocket `init` payload. The Settings tab and Playground tabs now display the auto-detected path as a transparent placeholder (e.g. `Auto-detected: D:/projects/my-app`) when the project root override field is left empty, so users can see exactly which directory is being used without configuring anything.

### Changed
- **Modular Component Refactoring**: Extracted LLMLingua pipeline configuration, Semantic Search tab, and Verification tab into dedicated components (`LLMLinguaSettings.tsx`, `PlaygroundSearchTab.tsx`, `PlaygroundVerifyTab.tsx`) to keep all source files under the 1000-line code limit and improve maintainability.
- **Transparent Default Root in Playground**: The `Project Root Dir (Optional Override)` fields in the Search and Verify playground sub-tabs now show the active default directory — either the user-configured Serena root or the auto-detected backend CWD — as the placeholder text, making it clear which root is in use.

---

## [1.3.32] - 2026-07-03

### Added
- **Toast Notifications for Settings**: Added a custom, neon glassmorphic toast notification component that slides in and auto-dismisses, providing feedback when settings are successfully saved or fail to save.

### Changed
- **Optimized Settings Input Triggers**: Refactored `Default Project Root Dir`, `Test Execution Command`, and `Max Healing Retries` settings inputs to save on `onBlur` instead of saving on every single keystroke (`onChange`). This eliminates typing latency and unnecessary backend save requests.

---

## [1.3.31] - 2026-07-03

### Added
- **AI Context Compression & Microsoft LLMLingua**: Integrated a new pipeline allowing prompt compression using Microsoft's LLMLingua framework locally via the background Python daemon or using the configured upstream API (OpenAI/Anthropic) to compress long prompts dynamically before sending requests.
- **Dashboard UI & Playground Controls**: Added configuration controls for method selection, HuggingFace model names, keep rate, target model, and custom compression prompt instructions.

---

## [1.3.30] - 2026-07-02

### Fixed
- **Daemon Restart & Startup Pre-warming**: Configured the server to pre-warm the Python background daemon asynchronously on startup so that it immediately displays as active and avoids subprocess spawn latency for the initial request. Modified the daemon restart handler to immediately restart and pre-warm the daemon.
- **Robust Process Isolation**: Isolated stdout buffer chunks and exit/error event handlers to each specific process instance, avoiding stdout parser corruption or incorrect pending request rejection when restarting the persistent python daemon.

---

## [1.3.29] - 2026-07-02

### Added
- **Rule File Generator**: Built a new "Rules Generator" sub-tool inside the Caveman tools section of the Playground. It compiles Caveman communication guidelines and RamuToken context instructions into rules files (like `.cursorrules`, `.clinerules`, or `AGENTS.md`) and allows writing them directly to the project root with workspace boundary protections.
- **Rules Write Endpoint**: Registered `POST /api/caveman/write-rules` to write instruction files safely into project workspaces.

---

## [1.3.28] - 2026-07-02

### Added
- **Caveman Integration**: Expanded Caveman configurations to support all four levels of output token compression (`low`, `medium`, `high`, and `wenyan` mode).
- **Tool Description Compression**: Added a toggle option `compressMcpDescriptions` to dynamically shrink OpenAI/Anthropic request tool descriptions to save substantial input tokens.
- **Upstream LLM Client**: Created a dedicated `upstream.ts` module with `fetchUpstream` and a new `callUpstreamLLM` helper, avoiding circular dependencies and keeping proxy handlers under the 1000-line constraint.
- **Caveman API Endpoints**: Registered three new endpoints:
  - `POST /api/caveman/compress-file` for rule-based reference file compression.
  - `POST /api/caveman/commit` for generating caveman-style conventional commit messages.
  - `POST /api/caveman/review` for compressing code review draft feedback into single-line comments.
- **Playground Tab Enhancements**: Built a new "Caveman Tools" tab exposing interactive tools for file compression, commit message generation, and code review compression.
- **Dashboard Stats & Badge**: Added a Caveman Stats card showing a visual status badge and a "Copy Shareable Tweet" utility for token and cost savings.

---

## [1.3.27] - 2026-07-02

### Changed
- **Removed Custom TypeScript Headroom Fallback**: Reverted the headroom pipeline back to relying exclusively on the official `headroom-ai` python package and local proxy. Removed custom TS fallback implementations (JSON minifier, metadata key pruner, and custom CCR placeholder substitutions).
- **Settings UI Cleanup**: Removed prose paragraph compression checkboxes and language whitelist configurations from the Settings Tab in the dashboard.

---

## [1.3.26] - 2026-07-02

### Added
- **Prose Paragraph CCR**: Extended Headroom's TypeScript fallback to support context-aware compression for large prose text paragraphs (independent of markdown code block format) when `ccrProse` is enabled.
- **Language Filtering for Code Blocks**: Added `ccrLanguages` whitelist configuration to let users selectively compress code blocks of specific languages (e.g., Python or TypeScript) while leaving other languages uncompressed.
- **Dashboard UI Controls**: Added checkboxes and input fields in the Settings Tab to allow users to toggle prose paragraph compression and edit the whitelist of allowed code block languages.

---

## [1.3.25] - 2026-07-02

### Added
- **Native TypeScript Fallback for Headroom**: Fully implemented structural JSON minification, metadata field pruning, and Reversible Context Substitution (CCR) with deterministic base36 hash placeholders in native TypeScript. This acts as a robust, high-performance fallback when the python daemon or headroom proxy is unavailable.
- **CCR Decompression**: Completed the placeholder restoration registry and search replacement in `restoreCCR` to correctly expand placeholders back to their original code/text blocks in LLM responses.

---

## [1.3.24] - 2026-07-02

### Added
- **Multi-File & Project-Wide Dependency Resolution**: Added support for parsing path comments (e.g., `// filepath: src/math.ts`) from code blocks to write them into session-specific subdirectories inside a persistent workspace, enabling relative import resolution by the language server.
- **Reference-Graph Based Pruning**: Uses Serena's LSP references (`find_referencing_symbols_by_location`) to construct a call reference graph, preventing active caller symbols from being pruned during compression.
- **Context-Aware Semantic Search**: Added a `/api/semantic-search` endpoint and corresponding tab in the Playground UI to query project symbols and preview compressed code blocks.
- **Verification Loop & Auto-healing**: Added a `/api/verify` endpoint and settings panel to run compiler diagnostics (`serena_diagnostics`) and automated test suites on AI-generated code.
- **Hot LSP Caching**: Optimized temp file writing to use a constant workspace path (`data/serena_workspace`), keeping cached language server instances running hot and dropping subsequent symbol retrieval time from ~15s to under ~50ms.

---

## [1.3.23] - 2026-07-02

### Fixed
- **Settings Layout and Scroll Reset Bug**: Refactored `Section`, `SectionTitle`, `PipelineSection`, and `CheckOption` in `SettingsTab.tsx` from inner helper components to module-level components. This stops React from unmounting and recreating these DOM trees on every render (which previously caused range input sliders to lose focus and reset the viewport scroll to the top of the container during auto-saves).
- **Test Stability**: Increased test timeouts for slow-running background daemon integration tests (Serena and Headroom) to 15 seconds, preventing timeouts on slower/initial runs.

---

## [1.3.22] - 2026-07-02

### Fixed
- **Vite WS Proxy Error Handling**: Configured Vite development server proxy options to catch and handle socket errors (like `ECONNRESET` and `ECONNABORTED`) gracefully, suppressing noisy console stack traces during dashboard client reconnections or server hot-reloads.

---

## [1.3.21] - 2026-07-02

### Fixed
- **Daemon stdout IPC Pollution**: Redirected standard output (`stdout`) of dynamic `pip install` subprocess calls inside the Python daemon to `sys.stderr` to avoid corrupting the JSON IPC stream.
- **Robust JSON IPC Parsing**: Added boundary verification to the TypeScript daemon stdout reader, ensuring only lines wrapped in `{...}` are parsed as JSON, and logging other outputs as info logs rather than throwing `SyntaxError`.

---

## [1.3.20] - 2026-07-02

### Fixed
- **Robust Auto-Download Timeout & API Failbacks**: Added a 2-second timeout to the global check process and timeouts to the download and API fetch requests to prevent blocking the thread in case of poor network.
- **GitHub API Rate Limit Fallback**: Added a hardcoded direct fallback URL for stable release version `v0.43.0` assets if the GitHub API is rate-limited or fails.
- **Python Import Cache Invalidation**: Added `importlib.invalidate_caches()` after dynamic pip installations inside the Python daemon, ensuring the newly installed packages are immediately discoverable by Python.

---

## [1.3.19] - 2026-07-02

### Added
- **Automatic Runtime Dependency Setup**: Implemented automatic installation of missing packages.
  - Python packages `serena-agent` and `headroom-ai` are automatically installed via `pip` on import failure inside the Python daemon.
  - The `rtk` binary is automatically downloaded from the latest GitHub release, extracted, and installed locally to `data/bin/` if not available globally.

---

## [1.3.18] - 2026-07-01

### Fixed
- **Asynchronous Server Entry Handler**: Added the `async` keyword to the main `fetch` request handler in `server/index.ts`. This resolves a syntax compilation crash when querying the daemon status asynchronously during dashboard requests.

---

## [1.3.17] - 2026-07-01

### Added
- **Interactive Compression Playground**: Replaced the static Test Bench with an interactive Playground tab. Users can now toggle pipelines (RTK, Serena, Headroom, Caveman) and customize parameters (e.g. minLines, caveman levels) on-the-fly, previewing side-by-side token savings and compression results without altering the server's global runtime configuration.
- **Live Daemon Monitor & Controller**: Added a dedicated system status panel in the Settings tab. It polls background daemon stats every 5 seconds, displaying Process ID, status (active/idle), loaded workspace LSPs, platform/Python versions, and provides a **Restart Daemon** button to refresh the environment.

---

## [1.3.16] - 2026-07-01

### Added
- **Auto-Respawning Process Manager**: Configured `python_daemon.ts` to automatically release dead child-process references and spawn a fresh background daemon on the next request in case of a crash or exit.
- **Lazy-Loaded Python Packages**: Refactored `daemon.py` to lazy-load `serena` and `headroom` modules on demand during the first request, reducing the background process initialization time down to under 10ms.

---

## [1.3.15] - 2026-07-01

### Added
- **Persistent Python Daemon**: Added a persistent background daemon (`daemon.py` and `python_daemon.ts`) to keep interpreter startup, package imports, and Serena Language Server LSP managers loaded in memory.
- **Daemon Speedup Benchmarks**: Updated `scratch/benchmark.ts` to test hot and cold daemon execution speeds. Serena now runs 150x faster (13ms vs 2.1s) and Headroom runs 1600x faster (0.6ms vs 1.1s).

### Changed
- **Removed Native TS Fallbacks**: Discarded local TypeScript heuristic replicas for Serena, Headroom, and RTK. The pipelines now always run the official command-line tools and Python packages via the persistent daemon wrapper or direct binary calls.
- **Asynchronous Orchestration**: Modified `compressMessageList` in the proxy server to process messages asynchronously, allowing non-blocking daemon requests.
- **Test Suite Modernization**: Updated the unit tests in `pipelines.test.ts` to support async/await pipelines and verify correct integration outputs.

---

## [1.3.14] - 2026-07-01

### Added
- **Performance Toggles & Benchmark Script**: Added configuration settings (`usePythonSymbols` for Serena and `usePython` for Headroom) to allow users to toggle python-based subprocess execution. Added `"benchmark"` script in `package.json` to measure token compression execution time.

### Changed
- **Pipeline Performance Optimization**: Disabled Python-based symbol retrieving and headroom library execution by default. The proxy now falls back to native, high-performance TypeScript logic, which runs in sub-milliseconds rather than seconds (reducing request overhead from ~5 seconds to ~5ms).
- **Settings UI Controls**: Added checkboxes for enabling Python LSP and Python Headroom integrations in the Settings Tab of the dashboard.

---

## [1.3.13] - 2026-07-01

### Fixed
- **Serena Batch Performance Optimization** (`server/pipelines/serena.ts` & `get_symbols.py`): Optimized symbol extraction by processing all code blocks in a request payload as a single batch. This starts Python and the language server only once per request rather than sequentially for every code block, eliminating major response delays.

---

## [1.3.12] - 2026-07-01

### Fixed
- **Serena Native Package Integration** (`server/pipelines/serena.ts`): Replaced the broken/hanging MCP stdio server JSON-RPC spawning mechanism with a lightweight, direct Python script call (`get_symbols.py`) that imports the official `serena` package and extracts LSP symbol ranges. This prevents test timeouts and handles cases where the Python Scripts directory is not on the system PATH.

---

## [1.3.11] - 2026-07-01

### Changed
- **Caveman Native Package Integration** (`server/pipelines/caveman.ts`): Replaced the broken CLI wrapper command spawn for `caveman-shrink` with a direct local dependency import of `caveman-shrink/compress`, improving execution speed and fixing a subprocess argument parsing bug. Added `caveman-shrink` to `package.json`.

---

## [1.3.10] - 2026-07-01

### Fixed
- **CLI Performance / Test Timeouts** (`server/pipelines/rtk.ts`): Replaced `npx -y` with `npx --no-install` to prevent network blocking during test execution. Implemented static execution status flags (`isRtkAvailable`, etc.) to cache failures, reducing subsequent lookup time to 0ms.
- **Caveman Test Alignments** (`server/pipelines/caveman.ts`): Adjusted the headers in `CAVEMAN_INSTRUCTIONS` to match expectations in the test suite (`CAVEMAN MODE: HIGH` and `CAVEMAN MODE: MEDIUM`).

---

## [1.3.9] - 2026-07-01

### Changed
- **Deep Integration – Serena** (`server/pipelines/serena.ts`): Removed shallow CLI wrapper. Now launches `serena-mcp-server` (or `python -m serena.mcp`) as a child process, performs full JSON-RPC 2.0 MCP handshake (`initialize` → `notifications/initialized` → `tools/call get_symbols_overview`), receives exact symbol line-ranges from the LSP backend, and prunes irrelevant function bodies using those precise ranges. Falls back to custom AST pruner if binary unavailable.
- **Deep Integration – Headroom** (`server/pipelines/headroom.ts`): Removed shallow CLI wrapper. Now tries `python -c "from headroom import compress; ..."` (inline Python library call with stdin/stdout) as primary path, plus async HTTP call to a locally running headroom proxy on port 8787 as secondary path. Falls back to local TS JSON-minify + CCR pipeline.
- **Deep Integration – Caveman** (`server/pipelines/caveman.ts`): Removed shallow CLI wrapper. Now tries `caveman-shrink --level <lite|full|ultra>` and `npx -y caveman-shrink` to compress the existing system prompt text directly. Faithfully reproduced the full caveman SKILL.md rules for all three levels (lite/full/ultra) in embedded fallback instructions. Added `cavemanCompressProse()` export for compressing arbitrary text.
- **Deep Integration – RTK** (`server/pipelines/rtk.ts`): Escalated to three-tier CLI strategy: globally installed `rtk cat`, then `npx -y rtk cat`, then `npx -y @rtk-ai/rtk cat`, before falling back to local TS pipeline.

---

## [1.3.8] - 2026-07-01

### Added
- **Official CLI Integrations**: Added support for invoking the official command-line tools for all 4 compression pipelines (RTK, Serena, Headroom, and Caveman) via child-process execution.
- **Graceful Fallbacks**: Implemented robust fallbacks to the custom local TypeScript pipelines in case the official binaries/commands are not found on the system PATH, ensuring continuous functionality.

---

## [1.3.7] - 2026-07-01

### Added
- **Proxy Activity Log Pagination**: Added pagination functionality to the main logs table on the Dashboard.
  - Users can select the page size (5, 10, 15, 25, 50 entries) using a selector dropdown.
  - Added navigation buttons (First, Previous, Next, Last) and numbered page selectors that handle dynamic ellipses to keep the layout clean when total pages are large.
  - Integrated header count to show current entries range, e.g. "Live — showing X-Y of Z".

---

## [1.3.6] - 2026-07-01

### Added
- **Copy buttons on prompt panels**: Each panel (Original Prompt & Compressed Prompt) in the request detail modal now has a "Copy" button. Clicking it copies the full text to clipboard and shows a ✓ "Copied!" confirmation for 2 seconds.

### Fixed
- **Modal scroll fixed**: Removed `overflow-hidden` + nested `overflow-auto` on `<pre>` elements that caused the whole page to scroll instead of the modal. The overlay itself is now the single scroll container (`overflow-y-auto`), and the modal panel expands naturally to its content. The header is `sticky top-0` so it remains visible while scrolling long prompts.
- **Modal header extras**: Added CCR Mappings count and CACHED badge to the modal header info row.

---

## [1.3.5] - 2026-07-01

### Fixed
- **Proxy Activity Log now shows content & compression result**: Fixed a silent bug where `originalPrompt` and `compressedPrompt` were always `undefined` in every log entry. Root cause: `compressMessageList()` returned fields named `originalText` / `compressedText`, but all three proxy handlers destructured them as `originalPrompt` / `compressedPrompt`. Renamed the return fields in `compressMessageList` to match, so the "View" modal in the dashboard now correctly displays the original and compressed prompt side-by-side.

---

## [1.3.4] - 2026-07-01

### Fixed
- **Models endpoint now proxied to upstream**: `GET /v1/models`, `/openai/v1/models`, and `/anthropic/v1/models` now forward the request to the active upstream provider (Custom, Bifrost, or Direct OpenAI/Anthropic) instead of returning a hardcoded mock list. This allows AI agents and tools like Cursor or Continue to see the real models available from the configured provider.
  - Added `handleModelsProxy(req, provider)` in `server/proxy.ts` with a dedicated `buildGetHeaders()` helper that mirrors the auth logic from `fetchUpstream()` for GET requests.
  - Removed all static mock model arrays from `server/index.ts`.

---

## [1.3.3] - 2026-07-01

### Changed
- **Dual Agent Base URLs on Dashboard**: The "Agent Base URL" field in the Target Router card is now split into two separate rows — one for **OpenAI-compatible** clients (`/v1`) shown in cyan, and one for **Anthropic-compatible** clients (`/anthropic/v1`) shown in orange — each with a colored indicator dot for quick visual distinction.

---

## [1.3.2] - 2026-07-01

### Fixed
- **Dynamic Backend Port Mismatch**: Fixed `ECONNREFUSED` Vite proxy error that occurred when `settings.server.port` was changed from the default `6875`. `dev.ts` now reads the saved port from `data/db.json` at startup and passes it as `BACKEND_PORT` env var to the Vite child process. `vite.config.ts` reads this env var to set the correct proxy target — meaning the UI will always connect to the actual backend port, even after a port change and restart.
- **WebSocket proxy**: Added `/ws` WebSocket proxy entry in `vite.config.ts` so the dashboard's real-time WebSocket connection is also correctly proxied in dev mode.
- **Bonus**: Added `/openai` and `/anthropic` path prefixes to the Vite proxy (they were only routed on the server but missing from the dev proxy).

---

## [1.3.1] - 2026-07-01

### Added
- **Custom Upstream Test Button**: Added connectivity test button next to the Custom Endpoint URL field, matching the Bifrost "Test" button style.
  - Shows **Online** (green + latency in ms), **Offline** (pink), or **Checking…** (spinner) states.
  - Status auto-resets to idle whenever the URL field is edited.
  - Button is disabled when the URL field is empty or a check is already in progress.
  - Tries `<url>/health` first, then falls back to root URL ping (same strategy as Bifrost).

---

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
