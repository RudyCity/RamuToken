# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-07-01

### Added
- **Workspace Agent Rules**: Created `.agents/AGENTS.md` containing strict guidelines for commits, automatic SemVer bumping, changelog entries, modular scalability best practices, and a 1000-line limit per file.

## [1.0.0] - 2026-07-01

### Added
- **Integrated Proxy Server**: Added `Bun.serve` server running on port `3000` supporting both OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`) compatible request/response structures.
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
