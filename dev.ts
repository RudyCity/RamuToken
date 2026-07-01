/**
 * Development Orchestrator
 * Starts Bifrost (via npx), the Bun proxy server, and the Vite client dev server.
 * Bifrost is auto-downloaded on first run via @maximhq/bifrost npx package.
 */

const BIFROST_PORT = 8080;
const BIFROST_CHECK_INTERVAL_MS = 500;
const BIFROST_READY_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Determine backend port from saved settings (fallback to 6875)
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function resolveBackendPort(): number {
  try {
    const dbPath = join(import.meta.dirname, "data/db.json");
    if (existsSync(dbPath)) {
      const db = JSON.parse(readFileSync(dbPath, "utf8"));
      const saved = db?.settings?.server?.port;
      if (typeof saved === "number" && saved > 0) return saved;
    }
  } catch {
    // ignore — fall through to default
  }
  return 6875;
}

const BACKEND_PORT = resolveBackendPort();

console.log("🚀 Starting RamuToken Services...\n");

// ---------------------------------------------------------------------------
// Helper: Check if Bifrost is already listening on its port
// ---------------------------------------------------------------------------
async function isBifrostReady(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${BIFROST_PORT}/health`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    // Also try root in case /health is not exposed
    try {
      await fetch(`http://localhost:${BIFROST_PORT}`, {
        signal: AbortSignal.timeout(800),
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Wait until Bifrost is ready or timeout
// ---------------------------------------------------------------------------
async function waitForBifrost(): Promise<boolean> {
  const deadline = Date.now() + BIFROST_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isBifrostReady()) return true;
    await Bun.sleep(BIFROST_CHECK_INTERVAL_MS);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step 1: Check if Bifrost is already running externally
// ---------------------------------------------------------------------------
let bifrostProcess: ReturnType<typeof Bun.spawn> | null = null;

const alreadyRunning = await isBifrostReady();

if (alreadyRunning) {
  console.log(`✅ [Bifrost] Already running on port ${BIFROST_PORT} — skipping spawn.`);
} else {
  console.log(`⚡ [Bifrost] Not detected — launching via bun x @maximhq/bifrost...`);

  bifrostProcess = Bun.spawn(["bun", "x", "@maximhq/bifrost"], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PORT: String(BIFROST_PORT),
    },
  });

  // Pipe Bifrost stdout/stderr with prefix so it's distinguishable in console
  (async () => {
    const reader = bifrostProcess!.stdout.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(`[Bifrost] ${decoder.decode(value)}`);
    }
  })();

  (async () => {
    const reader = bifrostProcess!.stderr.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stderr.write(`[Bifrost] ${decoder.decode(value)}`);
    }
  })();

  console.log(`⏳ [Bifrost] Waiting for Bifrost to be ready on port ${BIFROST_PORT}...`);
  const ready = await waitForBifrost();

  if (ready) {
    console.log(`✅ [Bifrost] Ready on http://localhost:${BIFROST_PORT}\n`);
  } else {
    console.warn(
      `⚠️  [Bifrost] Did not become ready within ${BIFROST_READY_TIMEOUT_MS / 1000}s.\n` +
      `   RamuToken will still start — requests will fail until Bifrost is up.\n`
    );
  }
}

// ---------------------------------------------------------------------------
// Step 2: Start the Bun proxy server (hot-reload enabled)
// ---------------------------------------------------------------------------
const server = Bun.spawn(["bun", "run", "--hot", "server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});
console.log(`✅ [Server] Proxy server starting on http://localhost:${BACKEND_PORT}`);

// ---------------------------------------------------------------------------
// Step 3: Start the Vite client dev server
// ---------------------------------------------------------------------------
const client = Bun.spawn(["bun", "x", "vite"], {
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    BACKEND_PORT: String(BACKEND_PORT),
  },
});
console.log("✅ [Client] Vite dev server starting on http://localhost:5173\n");

// ---------------------------------------------------------------------------
// Cleanup: Kill all child processes on exit
// ---------------------------------------------------------------------------
const cleanup = () => {
  console.log("\n🛑 Stopping all services...");
  server.kill();
  client.kill();
  if (bifrostProcess) {
    bifrostProcess.kill();
    console.log("   Bifrost stopped.");
  }
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
