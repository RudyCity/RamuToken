/**
 * Bun HTTP & WebSocket Server Entrypoint
 * Listens on port 6875, routes API requests, handles WebSockets,
 * and serves the Vite client app.
 */
import { handleOpenAIProxy, handleAnthropicProxy, compressMessageList, countTokens, handleAnthropicTranspiledProxy, handleModelsProxy } from "./proxy";
import { callUpstreamLLM } from "./pipelines/upstream";
// @ts-ignore
import { compress } from "caveman-shrink/compress";
import { settings, updateSettings, metrics, logsHistory, llmLinguaLogsHistory, registerSocket, unregisterSocket, broadcastSettingsUpdate, clearHistory } from "./config";
import { join } from "path";
import { pythonDaemon } from "./pipelines/python_daemon";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { scanProjects } from "./utils/scanProjects";

const PORT = process.env.PORT || settings.server?.port || 6875;
const DIST_DIR = join(import.meta.dirname, "../dist");

console.log(`[Server] Initializing Bun server on port ${PORT}...`);

Bun.serve({
  port: PORT,
  async fetch(req, server) {
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

    // Auth verification for client endpoints
    const isProxyPath = path.startsWith("/v1/") || path === "/v1" ||
                        path.startsWith("/openai/") ||
                        path.startsWith("/anthropic/");
                        
    if (isProxyPath) {
      const authRequired = settings.server?.accessToken && settings.server.accessToken.trim() !== "";
      if (authRequired) {
        const authHeader = req.headers.get("Authorization") || "";
        const apiKeyHeader = req.headers.get("x-api-key") || "";

        let providedToken = "";
        if (authHeader.startsWith("Bearer ")) {
          providedToken = authHeader.substring(7).trim();
        } else if (authHeader.startsWith("Bearer")) {
          providedToken = authHeader.substring(6).trim();
        } else if (authHeader) {
          providedToken = authHeader.trim();
        } else if (apiKeyHeader) {
          providedToken = apiKeyHeader.trim();
        }

        if (providedToken !== settings.server.accessToken.trim()) {
          console.warn(`[Auth] Blocked unauthorized request to ${path}`);
          return new Response(JSON.stringify({
            error: {
              message: "Unauthorized: Invalid or missing RamuToken Access Token.",
              type: "invalid_request_error",
              code: "unauthorized"
            }
          }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }
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
    if (path === "/v1/chat/completions" || path === "/openai/v1/chat/completions") {
      return handleOpenAIProxy(req).then(res => {
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // OpenAI models list — forward to upstream
    if (path === "/v1/models" || path === "/openai/v1/models") {
      return handleModelsProxy(req, "openai").then(res => {
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // 3. Anthropic compatible routing
    if (path === "/v1/messages" || path === "/anthropic/v1/messages") {
      return handleAnthropicProxy(req).then(res => {
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // Anthropic Transpiled Route (allows OpenAI clients to use Anthropic models directly)
    if (path === "/anthropic/v1/chat/completions") {
      return handleAnthropicTranspiledProxy(req).then(res => {
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // Anthropic models list — forward to upstream
    if (path === "/anthropic/v1/models") {
      return handleModelsProxy(req, "anthropic").then(res => {
        const newHeaders = new Headers(res.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(res.body, { status: res.status, headers: newHeaders });
      });
    }

    // 4. API Endpoints for Dashboard UI
    if (path === "/api/upstream-models" && req.method === "GET") {
      const isAnthropic = !!settings.upstream.anthropicKey && !settings.upstream.preferCustom && !settings.upstream.preferBifrost;
      const provider = isAnthropic ? "anthropic" : "openai";
      try {
        const dummyReq = new Request(req.url, { headers: req.headers });
        const response = await handleModelsProxy(dummyReq, provider);
        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch models from upstream" }), {
            status: response.status,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const data = await response.json();
        let models: string[] = [];
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map((m: any) => m.id).filter(Boolean);
        } else if (Array.isArray(data)) {
          models = data.map((m: any) => m.id).filter(Boolean);
        }
        return new Response(JSON.stringify({ success: true, models }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

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

    if (path === "/api/llmlingua-logs" && req.method === "GET") {
      return new Response(JSON.stringify(llmLinguaLogsHistory), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (path === "/api/clear-history" && req.method === "POST") {
      clearHistory();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Live Daemon Status & Restart endpoints
    if (path === "/api/daemon-status" && req.method === "GET") {
      const isActive = pythonDaemon.isActive();
      let daemonDetails = null;
      if (isActive) {
        try {
          daemonDetails = await pythonDaemon.request("status", {});
        } catch (err) {
          console.error("[Daemon] Failed to fetch status:", err);
        }
      }
      return new Response(JSON.stringify({
        isActive,
        pid: daemonDetails?.pid || null,
        projects: daemonDetails?.projects || [],
        platform: daemonDetails?.platform || null,
        python_version: daemonDetails?.python_version || null
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (path === "/api/daemon-restart" && req.method === "POST") {
      pythonDaemon.shutdown();
      try {
        await pythonDaemon.request("status", {});
      } catch (err) {
        console.error("[Daemon] Failed to pre-warm daemon process on restart:", err);
      }
      return new Response(JSON.stringify({ success: true, message: "Daemon restarted successfully" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Scan local filesystem for project directories
    if (path === "/api/scan-projects" && req.method === "GET") {
      try {
        const detected = scanProjects(process.cwd());
        // Merge with existing profiles: keep user-added ones, add newly detected ones
        const existingPaths = new Set(
          (settings.serena.projectProfiles || []).map(p => p.path.toLowerCase())
        );
        const newProfiles = detected.filter(p => !existingPaths.has(p.path.toLowerCase()));
        const merged = [...(settings.serena.projectProfiles || []), ...newProfiles];
        const updated = updateSettings({
          serena: { ...settings.serena, projectProfiles: merged }
        });
        broadcastSettingsUpdate();
        return new Response(JSON.stringify({
          success: true,
          detected: detected.length,
          added: newProfiles.length,
          profiles: updated.serena.projectProfiles
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (path === "/api/semantic-search" && req.method === "POST") {
      return req.json()
        .then(async body => {
          const query = body.query || "";
          // Priority: per-request override → active profile → global default → cwd
          const activeProfile = (settings.serena.projectProfiles || []).find(
            p => p.id === settings.serena.activeProfileId
          );
          const projectRoot = body.projectRoot || activeProfile?.path || settings.serena.projectRoot || process.cwd();
          
          if (!query) {
            return new Response(JSON.stringify({ error: "Missing query parameter" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const symbols = await pythonDaemon.request("serena_search", {
            project_root: projectRoot,
            query
          });

          const enriched = [];
          if (Array.isArray(symbols)) {
            for (const sym of symbols) {
              try {
                if (existsSync(sym.file_path)) {
                  const fileContent = readFileSync(sym.file_path, "utf8");
                  const lines = fileContent.split("\n");
                  const snippetLines = lines.slice(sym.start_line, sym.end_line + 1);
                  const snippet = snippetLines.join("\n");
                  enriched.push({ ...sym, snippet });
                } else {
                  enriched.push(sym);
                }
              } catch {
                enriched.push(sym);
              }
            }
          }

          return new Response(JSON.stringify({ success: true, symbols: enriched }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        });
    }

    if (path === "/api/verify" && req.method === "POST") {
      return req.json()
        .then(async body => {
          const filePath = body.filePath || "";
          const code = body.code || "";
          // Priority: per-request override → active profile → global default → cwd
          const activeProfile = (settings.serena.projectProfiles || []).find(
            p => p.id === settings.serena.activeProfileId
          );
          const projectRoot = body.projectRoot || activeProfile?.path || settings.serena.projectRoot || process.cwd();

          if (!filePath || !code) {
            return new Response(JSON.stringify({ error: "Missing filePath or code" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const { resolve, dirname } = await import("path");
          const resolvedProjectRoot = resolve(projectRoot);
          const resolvedFilePath = resolve(filePath);
          if (!resolvedFilePath.startsWith(resolvedProjectRoot)) {
            return new Response(JSON.stringify({ error: "Access Denied: File path is outside the project root" }), {
              status: 403,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const parentDir = dirname(resolvedFilePath);
          if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true });
          }
          writeFileSync(resolvedFilePath, code, "utf8");

          let diagnostics = [];
          try {
            diagnostics = await pythonDaemon.request("serena_diagnostics", {
              project_root: resolvedProjectRoot,
              file_path: resolvedFilePath
            });
          } catch (diagErr: any) {
            console.error("[Verify] Diagnostics error:", diagErr);
          }

          const errors = (diagnostics || []).filter((d: any) => d.severity === 1 || d.severity === 2);
          const hasErrors = errors.length > 0;

          let testOutput = "";
          let testExitCode = 0;

          if (!hasErrors && settings.verification.enabled && settings.verification.testCommand) {
            const { exec } = await import("child_process");
            try {
              const execPromise = new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
                exec(settings.verification.testCommand, {
                  cwd: resolvedProjectRoot,
                  timeout: 30000
                }, (error, stdout, stderr) => {
                  resolve({
                    stdout: stdout || "",
                    stderr: stderr || "",
                    code: error ? (Number(error.code) || 1) : 0
                  });
                });
              });
              const result = await execPromise;
              testOutput = result.stdout + (result.stderr ? "\n" + result.stderr : "");
              testExitCode = result.code;
            } catch (execErr: any) {
              testOutput = execErr.message;
              testExitCode = 1;
            }
          }

          const success = !hasErrors && testExitCode === 0;

          return new Response(JSON.stringify({
            success,
            diagnostics: diagnostics || [],
            testOutput,
            testExitCode
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        });
    }

    // Test bench compressor playground
    if (path === "/api/compress-test" && req.method === "POST") {
      return req.json()
        .then(async body => {
          const text = body.text || "";
          const userQuery = body.query || "";
          const playgroundSettings = body.settings || undefined;
          const dummyMessages = [{ role: "user", content: text }];
          
          const start = Date.now();
          const { compressedMessages } = await compressMessageList(dummyMessages, userQuery, playgroundSettings);
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

    // Caveman File Compression Tool
    if (path === "/api/caveman/compress-file" && req.method === "POST") {
      return req.json()
        .then(body => {
          const text = body.text || "";
          
          const start = Date.now();
          const res = compress(text);
          const elapsed = Date.now() - start;

          const originalTokens = countTokens(text);
          const compressedText = res.compressed;
          const compressedTokens = countTokens(compressedText);
          const savingsPercent = originalTokens > 0 ? ((originalTokens - compressedTokens) / originalTokens) * 100 : 0;

          return new Response(JSON.stringify({
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

    // Caveman Git Commit Generator Tool
    if (path === "/api/caveman/commit" && req.method === "POST") {
      return req.json()
        .then(async body => {
          const diff = body.diff || "";
          if (!diff.trim()) {
            return new Response(JSON.stringify({ error: "Git diff cannot be empty." }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const systemPrompt = "You are Caveman Commit Generator. Generate a Conventional Commit message based on the provided diff. Rules:\n- Format: <type>: <subject> (e.g. feat: add auth, fix: solve null ref)\n- Subject must be ≤ 50 characters\n- Speak in caveman style (extreme brevity, direct keywords, focus on why over what)\n- Return ONLY the raw commit message (no markdown blocks, no intro/outro).";
          const commitMessage = await callUpstreamLLM(diff, systemPrompt);

          return new Response(JSON.stringify({ commitMessage: commitMessage.trim() }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        });
    }

    // Caveman PR Review Commenter Tool
    if (path === "/api/caveman/review" && req.method === "POST") {
      return req.json()
        .then(async body => {
          const commentDraft = body.commentDraft || "";
          if (!commentDraft.trim()) {
            return new Response(JSON.stringify({ error: "Review comment draft cannot be empty." }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const systemPrompt = "You are Caveman Review Commenter. Compress the provided code review feedback draft into a single-line, highly concise caveman-speak comment. Rules:\n- Return ONLY a single line (no introductory text, no markdown code blocks except minimal inline backticks if referencing symbols)\n- Focus on direct instruction, e.g., 'L42: bug: user null. Add guard.'\n- Speak in caveman style (no articles, no pronouns, direct keywords).";
          const reviewComment = await callUpstreamLLM(commentDraft, systemPrompt);

          return new Response(JSON.stringify({ reviewComment: reviewComment.trim() }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        });
    }

    // Caveman Write Rule File Tool
    if (path === "/api/caveman/write-rules" && req.method === "POST") {
      return req.json()
        .then(async body => {
          const fileName = body.fileName || "";
          const content = body.content || "";
          const projectRoot = body.projectRoot || settings.serena.projectRoot || process.cwd();

          if (!fileName || !content) {
            return new Response(JSON.stringify({ error: "Missing fileName or content" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const { resolve, dirname } = await import("path");
          const resolvedProjectRoot = resolve(projectRoot);
          const resolvedFilePath = resolve(resolvedProjectRoot, fileName);
          if (!resolvedFilePath.startsWith(resolvedProjectRoot)) {
            return new Response(JSON.stringify({ error: "Access Denied: File path is outside the project root" }), {
              status: 403,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const parentDir = dirname(resolvedFilePath);
          if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true });
          }
          writeFileSync(resolvedFilePath, content, "utf8");

          return new Response(JSON.stringify({ success: true, filePath: resolvedFilePath }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
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
          <p>The backend proxy is running successfully. Direct your AI agents (Cursor, Claude Code, etc.) to <code>http://localhost:6875/v1</code>.</p>
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
    message(_ws, message) {
      console.log(`[WebSocket] Message received: ${message}`);
    },
    close(ws) {
      console.log("[WebSocket] Client dashboard disconnected");
      unregisterSocket(ws);
    },
  },
});

console.log(`⚡ Proxy & API Server listening at http://localhost:${PORT}`);

// Pre-warm the background python daemon asynchronously on startup
pythonDaemon.request("status", {}).then(() => {
  console.log("[Daemon] Background Python daemon pre-warmed and running (hot).");
}).catch(err => {
  console.error("[Daemon] Failed to pre-warm background Python daemon on startup:", err);
});
