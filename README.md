# ⚡ RamuToken (Token Converter & Compressor Gateway)

An intelligent, highly optimized context compression proxy and gateway dashboard designed for AI coding agents (such as Cursor, Claude Code, Cline, etc.) to minimize token consumption, save API costs, and maximize prompt caching efficiency.

Built with **Bun**, **Vite**, **React**, and **Tailwind CSS v4**, this proxy integrates custom implementations of four main compression pipelines and routes payloads natively or via **Bifrost by Maxim AI** to 23+ LLM providers.

---

## 🛠️ Compression Pipelines Stack

1. **RTK (Rust Token Killer style)**: Collapses repeated CLI outputs/logs, strips formatting/ANSI escape codes, normalizes absolute system paths to clean relative routes, and prunes massive stack traces.
2. **Serena (Code AST & Symbol-Level Pruner)**: Identifies files and code blocks (JS/TS and Python), extracts search keywords from the user prompt, and prunes the bodies of methods/functions that are not directly referenced or targeted by the user query. Supports caller-callee dependency resolution to prevent helper functions from being pruned.
3. **Headroom (Structural & Reversible CCR)**: Minifies raw JSON blocks, prunes empty or blacklisted metadata fields, and substitutes long text/code segments with a short `{{HR_CCR_X}}` token (Reversible Context Substitution). It restores them in the LLM response in-flight or exposes them for retrieval.
4. **Caveman (Output Prose Optimizer)**: Injects high-density instructions into the system prompt to force the model to communicate using keywords, short sentences, and code blocks, stripping conversational fluff to save output tokens. Configurable levels (Low, Medium, High) are adjustable in the UI.
5. **Cache & Prompt Optimizer**: Ensures stable and deterministic compression output to maximize upstream prompt caching (e.g., Anthropic Prompt Caching), passes through cache-control markers, and provides a local memory response cache.

---

## 🗺️ Architecture & Process Flow

### Request / Response Flowchart

```mermaid
graph TD
    Agent([AI Agent / Client]) -->|1. HTTP Request| Router{API Router}

    Router -->|/v1/chat/completions| OpenAIProxy[OpenAI Proxy Handler]
    Router -->|/v1/messages| AnthropicProxy[Anthropic Proxy Handler]

    OpenAIProxy & AnthropicProxy -->|2. Count Original Tokens| TokenCalc[js-tiktoken Counter]
    TokenCalc -->|3. Run Pipelines| Pipelines[Pipeline Orchestrator]

    subgraph Pipelines Stack [Compression Pipelines]
        direction TB
        RTK["RTK Pipeline
        - Collapse repeated logs & stack traces
        - Normalize absolute paths"]
        --> Serena["Serena Pipeline
        - AST & Symbol-Level Pruner
        - Prune irrelevant functions"]
        --> Headroom["Headroom Pipeline
        - Minify JSON blocks
        - Reversible substitution {{HR_CCR_X}}"]
        --> Caveman["Caveman Pipeline
        - Inject System Prompt instruction
        - Force terse output style"]
    end

    Pipelines --> PipelinesStack
    PipelinesStack -->|Compressed Payload| CacheCheck{"4. Cache Enabled & Non-Stream?"}

    CacheCheck -->|"Yes – Cache Hit"| ReturnCache[5. Serve from Cache]
    ReturnCache -->|Instant response| Agent

    CacheCheck -->|"No / Cache Miss"| RouteDecision{"6. Upstream Route"}

    RouteDecision -->|"preferBifrost = true"| Bifrost["Bifrost Gateway
    http://localhost:8080"]
    RouteDecision -->|"preferBifrost = false"| DirectProvider["Direct API Provider
    OpenAI / Anthropic"]

    Bifrost & DirectProvider -->|7. LLM Response| ResponseHandler{"8. Response Type"}

    ResponseHandler -->|Streaming| StreamDecoder[Stream Chunk Decoder]
    ResponseHandler -->|Non-Streaming| JSONParser[JSON Response Parser]

    StreamDecoder & JSONParser -->|"9. Restore CCR placeholders"| CCRRestore["CCR Restorer
    Replace {{HR_CCR_X}} → Original Content"]

    CCRRestore -->|10. Save Cache & Write Log| DB[(Local DB + WebSocket Broadcast)]
    CCRRestore -->|11. Final Response| Agent

    classDef highlight fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#fff;
    classDef pipeline fill:#1e1b4b,stroke:#8b5cf6,stroke-width:1px,color:#e9d5ff;
    class PipelinesStack highlight;
    class RTK,Serena,Headroom,Caveman pipeline;
```

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client as AI Agent (Cursor / Cline)
    participant Proxy as RamuToken Server
    participant Pipe as Compression Pipelines
    participant Cache as Local Cache
    participant Upstream as LLM API (OpenAI / Anthropic / Bifrost)
    participant DB as Local Database (db.json)

    Client->>Proxy: POST /v1/chat/completions OR /v1/messages
    Note over Proxy: Count original tokens before compression
    Proxy->>Pipe: Run RTK → Serena → Headroom → Caveman
    Pipe-->>Proxy: Compressed payload + CCR mapping

    alt Cache Hit (Non-Streaming)
        Proxy->>Cache: Lookup compressed payload key
        Cache-->>Proxy: Return cached response
        Proxy-->>Client: Instant response (0 upstream tokens!)
    else Cache Miss or Streaming Request
        Proxy->>Upstream: Forward compressed request
        Upstream-->>Proxy: LLM Response (Stream / JSON)

        loop For each chunk / response text
            Proxy->>Proxy: Scan & restore {{HR_CCR_X}} via restoreCCR()
        end

        opt Caching Enabled
            Proxy->>Cache: Store response
        end

        Proxy->>DB: Write metrics & log entry, broadcast via WebSocket
        Proxy-->>Client: Final response (fully restored content)
    end
```

---

## ✨ Key Features & Enhancements (v1.1.0 – v1.2.0)

### 🔒 Access Token Authentication
Secure your local proxy endpoints with token authorization to prevent unauthorized access.
- Set a custom token in the settings dashboard (`settings.server.accessToken`).
- Generate strong keys directly using the **"Gen Key"** random generator in the settings card.
- Endpoints check for authorization headers: `Authorization: Bearer <your-token>` or `x-api-key: <your-token>`.
- Unauthorized requests receive a standard `401 Unauthorized` API response.

### 🌐 Dual API Endpoint Prefixes
Dedicated API routes allow separate endpoint targeting for different providers:
- **OpenAI Endpoint**: `http://localhost:<PORT>/openai/v1`
- **Anthropic Endpoint**: `http://localhost:<PORT>/anthropic/v1`
- **Base Endpoint (Shared/Auto)**: `http://localhost:<PORT>/v1`

### 🔄 OpenAI-to-Anthropic Transpilation Layer
Enables OpenAI-compatible clients (like Cursor) to communicate directly with Anthropic's Claude models.
- **Route**: `http://localhost:<PORT>/anthropic/v1/chat/completions`
- Accepts incoming OpenAI-formatted chat completions payloads.
- Automatically translates the payload to Anthropic’s native Messages API format.
- Decodes and maps the resulting Anthropic text/stream chunks back to OpenAI format on-the-fly.
- Allows native Anthropic caching and token savings without needing Bifrost.

### ⚙️ Configurable Server Port
Adjust the default proxy port directly through the Settings Tab.
- Port order of precedence: `process.env.PORT` ➔ `settings.server.port` (from `data/db.json`) ➔ Default `6875`.
- Warning badges are displayed in the dashboard if the server needs to be restarted for port changes to apply.
- Endpoints in the client settings auto-update dynamically based on the active backend port.

### 🚀 Bifrost Auto-Spawn
Running development builds auto-starts the Maxim AI Bifrost gateway.
- `bun run dev` automatically checks if port `8080` is active.
- If inactive, it spawns Bifrost locally using `bun x @maximhq/bifrost` (Windows-compatible execution) and pipes prefixed logs to the terminal.
- Cleans up and kills the child process gracefully upon exiting.

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) (v1.x or higher) installed.
- (Optional) [Bifrost by Maxim AI](https://github.com/maximhq/bifrost) running at `http://localhost:8080` if using Bifrost routing.

### 1. Install Dependencies
```bash
bun install
```

### 2. Run in Development Mode
Starts both the backend proxy (`http://localhost:6875` or configured port) and Vite dev server (`http://localhost:5173`) concurrently with hot-reloading:
```bash
bun run dev
```

### 3. Run in Production Mode
Builds the React frontend bundle and runs the unified Bun server, which serves both the proxy endpoints and the static dashboard UI:
```bash
bun run build
bun start
```

### 4. Run Unit Tests
Verifies the RTK, Serena, Headroom, Caveman, and Cache modules:
```bash
bun test
```

---

## 🔌 Integrating with Coding Agents

Point your AI assistant or agent to the local proxy. It exposes standard OpenAI and Anthropic compatible routes.

### Cursor Settings
If using Cursor:
1. Go to **Settings > Models > OpenAI / Anthropic**.
2. **For OpenAI Models**: Override the Base URL to:
   ```text
   http://localhost:6875/openai/v1
   ```
3. **For Anthropic Models (Native)**: Override the Base URL to:
   ```text
   http://localhost:6875/anthropic/v1
   ```
4. **For Anthropic Models (via OpenAI Transpilation)**:
   - Configure a custom OpenAI model (e.g. `claude-3-5-sonnet`).
   - Set the Base URL to:
     ```text
     http://localhost:6875/anthropic/v1
     ```
5. **Access Token**: If Access Token Auth is enabled, place your RamuToken access token in the API Key input field.

### Cline / VS Code Extensions
Set your provider to `OpenAI Compatible` or `Anthropic Compatible`:
- **Base URL**: `http://localhost:6875/v1` (or provider-specific endpoint)
- **API Key**: Your RamuToken access token (if configured) or your provider key.

### Curl Example (Authenticated OpenAI Format)
```bash
curl http://localhost:6875/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RAMUTOKEN_ACCESS_TOKEN" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "[2026-07-01 08:35] INFO: Processing...\n[2026-07-01 08:35] INFO: Processing...\nError in C:\\Users\\User\\src\\app.ts"
      }
    ]
  }'
```

---

## 📊 Dashboard UI Features

Access the dashboard at `http://localhost:6875` (or `http://localhost:5173` in development mode):
- **Live Metrics Dashboard**: Visualizes saved tokens, compression ratios, cost savings, and cache hit rates in real-time via WebSockets.
- **Sparkline Charts**: Dynamic SVG representation of recent compression performance.
- **Pipeline Configurator**: Toggle pipelines (RTK, Serena, Headroom, Caveman, Cache) and adjust thresholds (e.g., min lines for AST pruning, min length for CCR substitution).
- **Test Bench**: Interactive playground to paste raw logs/code, type search queries, and inspect side-by-side original vs. compressed diff outputs with token metrics.
- **Logs Explorer**: Click any past request to view the full original and compressed payloads side-by-side.
- **Access Card**: Securely copy endpoint routes, view and toggle access token values, or generate random cryptographic keys.
