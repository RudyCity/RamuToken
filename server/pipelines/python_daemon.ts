import { spawn, ChildProcess } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

class PythonDaemonManager {
  private proc: ChildProcess | null = null;
  private reqCounter = 0;
  private pending = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private stdoutBuffer = "";

  private getProc(): ChildProcess {
    if (this.proc && this.proc.exitCode === null) {
      return this.proc;
    }

    const scriptPath = join(import.meta.dirname, "daemon.py");
    this.proc = spawn("python", [scriptPath], {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });

    this.proc.stdout!.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString("utf8");
      let newlineIdx;
      while ((newlineIdx = this.stdoutBuffer.indexOf("\n")) !== -1) {
        const line = this.stdoutBuffer.substring(0, newlineIdx).trim();
        this.stdoutBuffer = this.stdoutBuffer.substring(newlineIdx + 1);
        if (line) {
          try {
            const resp = JSON.parse(line);
            const { id, status, result, error } = resp;
            if (id) {
              const cb = this.pending.get(id);
              if (cb) {
                this.pending.delete(id);
                if (status === "success") {
                  cb.resolve(result);
                } else {
                  cb.reject(new Error(error || "Python execution failed"));
                }
              }
            }
          } catch (err) {
            console.error("[Daemon] Failed to parse daemon line:", line, err);
          }
        }
      }
    });

    this.proc.on("error", (err) => {
      console.error("[Daemon] Process error:", err);
      this.cleanupPending(err);
    });

    this.proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[Daemon] Process exited with code ${code}`);
      }
      this.cleanupPending(new Error(`Daemon process exited with code ${code}`));
    });

    return this.proc;
  }

  private cleanupPending(error: Error) {
    for (const cb of this.pending.values()) {
      cb.reject(error);
    }
    this.pending.clear();
  }

  public async request(action: string, payload: any): Promise<any> {
    const proc = this.getProc();
    const id = `req_${this.reqCounter++}_${Math.random().toString(36).substring(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const line = JSON.stringify({ id, action, payload }) + "\n";
      proc.stdin!.write(line);
    });
  }

  public shutdown() {
    if (this.proc && this.proc.exitCode === null) {
      try {
        this.proc.stdin!.write(JSON.stringify({ id: "shutdown", action: "shutdown", payload: {} }) + "\n");
      } catch {}
      this.proc = null;
    }
  }
}

export const pythonDaemon = new PythonDaemonManager();

// Graceful exit
process.on("exit", () => {
  pythonDaemon.shutdown();
});
