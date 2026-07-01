import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { join } from "path";

// https://vite.dev/config/
export default defineConfig({
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
      "/api": "http://localhost:3000",
      "/v1": "http://localhost:3000",
    },
  },
});
