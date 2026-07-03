import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { join } from "path";

// https://vite.dev/config/
export default defineConfig(({ }) => {
  // Respect BACKEND_PORT env var set by dev.ts so the proxy always targets
  // the correct port even when settings.server.port has been changed.
  const backendPort = process.env.BACKEND_PORT || "6875";
  const backendUrl = `http://localhost:${backendPort}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": join(import.meta.dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      // Proxy api calls to Bun backend during development
      proxy: {
        "/api": {
          target: backendUrl,
          configure: (proxy) => {
            proxy.on("error", (err: any) => {
              if (err.code !== "ECONNRESET" && err.code !== "ECONNABORTED") {
                console.warn(`[Vite Proxy Error][api]: ${err.message}`);
              }
            });
          }
        },
        "/v1": {
          target: backendUrl,
          configure: (proxy) => {
            proxy.on("error", (err: any) => {
              if (err.code !== "ECONNRESET" && err.code !== "ECONNABORTED") {
                console.warn(`[Vite Proxy Error][v1]: ${err.message}`);
              }
            });
          }
        },
        "/openai": {
          target: backendUrl,
          configure: (proxy) => {
            proxy.on("error", (err: any) => {
              if (err.code !== "ECONNRESET" && err.code !== "ECONNABORTED") {
                console.warn(`[Vite Proxy Error][openai]: ${err.message}`);
              }
            });
          }
        },
        "/anthropic": {
          target: backendUrl,
          configure: (proxy) => {
            proxy.on("error", (err: any) => {
              if (err.code !== "ECONNRESET" && err.code !== "ECONNABORTED") {
                console.warn(`[Vite Proxy Error][anthropic]: ${err.message}`);
              }
            });
          }
        },
        "/ws": {
          target: backendUrl.replace("http", "ws"),
          ws: true,
          configure: (proxy) => {
            proxy.on("error", (err: any) => {
              // Silently capture socket resets/aborts when dashboard reconnects/disconnects
              if (err.code !== "ECONNRESET" && err.code !== "ECONNABORTED") {
                console.warn(`[Vite WS Proxy Error]: ${err.message}`);
              }
            });
          }
        },
      },
    },
  };
});
