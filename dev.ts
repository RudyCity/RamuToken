import { spawn } from "bun";

console.log("🚀 Starting Token Compressor Services...");

const server = Bun.spawn(["bun", "run", "--hot", "server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});

const client = Bun.spawn(["bun", "x", "vite"], {
  stdout: "inherit",
  stderr: "inherit",
});

// Handle cleanup on exit
const cleanup = () => {
  console.log("\n🛑 Stopping services...");
  server.kill();
  client.kill();
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
