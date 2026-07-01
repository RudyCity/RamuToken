/**
 * Bun HTTP & WebSocket Server Entrypoint
 * Listens on port 3000, routes API requests, handles WebSockets,
 * and serves the Vite client app.
 */
import { handleOpenAIProxy, handleAnthropicProxy, compressMessageList, countTokens } from "./proxy";
import { settings, updateSettings, metrics, logsHistory, registerSocket, unregisterSocket, broadcastSettingsUpdate } from "./config";
import { join } from "path";

const PORT = process.env.PORT || 3000;
const DIST_DIR = join(import.meta.dirname, "../dist");

console.log(`[Server] Initializing Bun server on port ${PORT}...`);

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. WebSocket endpoint for the Dashboard
    if (path === "/ws") {
      const success = server.upgrade(req);
      if (success) {
        return undefined; // Bun handles upgrade, returns socket connection
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // 2. OpenAI compatible routing
    if (path === "/v1/chat/completions") {
      return handleOpenAIProxy(req).then(res => {
        // Inject CORS headers
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // OpenAI models list
    if (path === "/v1/models") {
      const mockModels = {
        object: "list",
        data: [
          { id: "gpt-4o", object: "model", created: 1715640000, owned_by: "openai" },
          { id: "gpt-4-turbo", object: "model", created: 1711756800, owned_by: "openai" },
          { id: "gpt-3.5-turbo", object: "model", created: 1677610602, owned_by: "openai" },
          { id: "claude-3-5-sonnet", object: "model", created: 1718841600, owned_by: "anthropic" },
          { id: "claude-3-opus", object: "model", created: 1709251200, owned_by: "anthropic" }
        ]
      };
      return new Response(JSON.stringify(mockModels), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. Anthropic compatible routing
    if (path === "/v1/messages") {
      return handleAnthropicProxy(req).then(res => {
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // 4. API Endpoints for Dashboard UI
    if (path === "/api/settings" && req.method === "GET") {
      return new Response(JSON.stringify(settings), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (path === "/api/settings" && req.method === "POST") {
      return req.json()
        .then(body => {
          const updated = updateSettings(body);
          broadcastSettingsUpdate();
          return new Response(JSON.stringify({ success: true, settings: updated }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        });
    }

    if (path === "/api/metrics" && req.method === "GET") {
      return new Response(JSON.stringify(metrics), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (path === "/api/logs" && req.method === "GET") {
      return new Response(JSON.stringify(logsHistory), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Test bench compressor playground
    if (path === "/api/compress-test" && req.method === "POST") {
      return req.json()
        .then(body => {
          const text = body.text || "";
          const userQuery = body.query || "";
          const dummyMessages = [{ role: "user", content: text }];
          
          const start = Date.now();
          const { compressedMessages } = compressMessageList(dummyMessages, userQuery);
          const elapsed = Date.now() - start;

          const originalTokens = countTokens(text);
          const compressedText = compressedMessages[0]?.content || "";
          const compressedTokens = countTokens(compressedText);
          const savingsPercent = originalTokens > 0 ? ((originalTokens - compressedTokens) / originalTokens) * 100 : 0;

          return new Response(JSON.stringify({
            originalText: text,
            compressedText,
            originalTokens,
            compressedTokens,
            savingsPercent,
            durationMs: elapsed
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        });
    }

    // 5. Serve static files in production from "../dist"
    // Check if the file is an asset (e.g. /assets/index.js)
    const filePath = path === "/" ? "/index.html" : path;
    const diskPath = join(DIST_DIR, filePath);
    const file = Bun.file(diskPath);
    
    // Check if the file exists on disk
    if (file.size > 0) {
      return new Response(file);
    }

    // If dist folder doesn't exist (running dev) or route is React SPA router (fall back to index.html)
    const indexFile = Bun.file(join(DIST_DIR, "index.html"));
    if (indexFile.size > 0) {
      return new Response(indexFile);
    }

    // If no client static build is available, serve a fallback HTML greeting
    return new Response(
      `<html>
        <head>
          <title>RamuToken Service</title>
          <style>
            body { font-family: system-ui; background: #0b0f19; color: #f3f4f6; text-align: center; padding-top: 100px; }
            h1 { color: #8b5cf6; }
            p { color: #9ca3af; max-width: 500px; margin: 0 auto 20px; line-height: 1.5; }
            .badge { background: #1e1b4b; border: 1px solid #4c1d95; color: #c084fc; padding: 5px 15px; border-radius: 9999px; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>⚡ RamuToken Proxy & Compressor</h1>
          <p>The backend proxy is running successfully. Direct your AI agents (Cursor, Claude Code, etc.) to <code>http://localhost:3000/v1</code>.</p>
          <p>To view the dashboard, run the client dev server with <code>bun run dev</code> and open <code>http://localhost:5173</code>.</p>
          <span class="badge">Proxy Active (Port ${PORT})</span>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  },
  websocket: {
    open(ws) {
      console.log("[WebSocket] Client dashboard connected");
      registerSocket(ws);
    },
    message(ws, message) {
      console.log(`[WebSocket] Message received: ${message}`);
    },
    close(ws) {
      console.log("[WebSocket] Client dashboard disconnected");
      unregisterSocket(ws);
    },
  },
});

console.log(`⚡ Proxy & API Server listening at http://localhost:${PORT}`);
