import { spawn, ChildProcess, execSync } from "child_process";
import { join } from "path";

let cachedPythonCmd: string | null = null;

export function getPythonCommand(): string {
  if (cachedPythonCmd) return cachedPythonCmd;
  
  const cmds = ["python", "py", "python3"];
  for (const cmd of cmds) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" });
      cachedPythonCmd = cmd;
      return cmd;
    } catch {}
  }
  
  cachedPythonCmd = "python";
  return "python";
}

class PythonDaemonManager {
  private proc: ChildProcess | null = null;
  private reqCounter = 0;
  private pending = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  private getProc(): ChildProcess {
    if (this.proc && this.proc.exitCode === null) {
      return this.proc;
    }

    const scriptPath = join(import.meta.dirname, "daemon.py");
    const pythonCmd = getPythonCommand();
    const currentProc = spawn(pythonCmd, [scriptPath], {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });
    this.proc = currentProc;

    let localBuffer = "";
    currentProc.stdout!.on("data", (chunk: Buffer) => {
      localBuffer += chunk.toString("utf8");
      let newlineIdx;
      while ((newlineIdx = localBuffer.indexOf("\n")) !== -1) {
        const line = localBuffer.substring(0, newlineIdx).trim();
        localBuffer = localBuffer.substring(newlineIdx + 1);
        if (line) {
          try {
            if (line.startsWith("{") && line.endsWith("}")) {
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
            } else {
              console.log("[Daemon Info]:", line);
            }
          } catch (err) {
            console.error("[Daemon] Failed to parse daemon line:", line, err);
          }
        }
      }
    });

    currentProc.on("error", (err) => {
      console.error("[Daemon] Process error:", err);
      if (this.proc === currentProc) {
        this.cleanupPending(err);
        this.proc = null;
      }
    });

    currentProc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[Daemon] Process exited with code ${code}`);
      }
      if (this.proc === currentProc) {
        this.cleanupPending(new Error(`Daemon process exited with code ${code}`));
        this.proc = null;
      }
    });

    return currentProc;
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

  public isActive(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  public shutdown() {
    if (this.proc && this.proc.exitCode === null) {
      try {
        this.proc.stdin!.write(JSON.stringify({ id: "shutdown", action: "shutdown", payload: {} }) + "\n");
      } catch {}
      this.proc = null;
      this.cleanupPending(new Error("Daemon was shutdown"));
    }
  }
}

export const pythonDaemon = new PythonDaemonManager();

// Graceful exit
process.on("exit", () => {
  pythonDaemon.shutdown();
});
