/**
 * scanProjects.ts
 * Scans the filesystem around process.cwd() for directories that look like
 * software projects, identified by common project marker files.
 */
import { readdirSync, existsSync, statSync } from "fs";
import { join, dirname, basename } from "path";

/** Marker files that indicate a project root directory. */
const PROJECT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "CMakeLists.txt",
  ".serena",
];

export interface ScannedProject {
  id: string;
  name: string;
  path: string;
  type: string;   // detected project type label
  autoDetected: true;
}

/** Resolve a human-readable type label from a directory's markers. */
function detectType(dir: string): string {
  if (existsSync(join(dir, "package.json"))) return "Node/Bun";
  if (existsSync(join(dir, "pyproject.toml")) || existsSync(join(dir, "requirements.txt"))) return "Python";
  if (existsSync(join(dir, "Cargo.toml"))) return "Rust";
  if (existsSync(join(dir, "go.mod"))) return "Go";
  if (existsSync(join(dir, "pom.xml")) || existsSync(join(dir, "build.gradle"))) return "Java";
  if (existsSync(join(dir, "CMakeLists.txt"))) return "C/C++";
  return "Git";
}

/** Check if a directory contains at least one project marker. */
function isProject(dir: string): boolean {
  return PROJECT_MARKERS.some(marker => existsSync(join(dir, marker)));
}

/** Generate a stable ID from a path. */
function pathToId(p: string): string {
  return p.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(-40);
}

/**
 * Scan a list of directories (non-recursively) for project sub-directories.
 * Skips hidden dirs and common noise folders (node_modules, .git internals, etc.)
 */
function scanDir(dir: string, found: Map<string, ScannedProject>, limit: number): void {
  if (found.size >= limit) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (found.size >= limit) break;
    // Skip hidden, noise folders
    if (entry.startsWith(".") || entry === "node_modules" || entry === "__pycache__" || entry === "dist" || entry === "build") continue;

    const fullPath = join(dir, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    if (isProject(fullPath) && !found.has(fullPath)) {
      found.set(fullPath, {
        id: pathToId(fullPath),
        name: basename(fullPath),
        path: fullPath,
        type: detectType(fullPath),
        autoDetected: true,
      });
    }
  }
}

/**
 * Main scan function. Finds project directories near `baseDir`.
 * Strategy:
 *   1. baseDir itself (the running server dir)
 *   2. Siblings of baseDir (directories next to it)
 *   3. Subdirectories of baseDir (one level deep)
 *   4. Grandparent siblings (one level above parent)
 *
 * Hard limit: MAX_PROJECTS results.
 */
export function scanProjects(baseDir: string, maxProjects = 50): ScannedProject[] {
  const found = new Map<string, ScannedProject>();

  // 1. The base dir itself
  if (isProject(baseDir)) {
    found.set(baseDir, {
      id: pathToId(baseDir),
      name: basename(baseDir),
      path: baseDir,
      type: detectType(baseDir),
      autoDetected: true,
    });
  }

  // 2. Subdirectories of baseDir (depth 1)
  scanDir(baseDir, found, maxProjects);

  // 3. Siblings — scan parent directory
  const parentDir = dirname(baseDir);
  if (parentDir !== baseDir) {
    scanDir(parentDir, found, maxProjects);
  }

  // 4. Grandparent siblings — one more level up
  const grandParent = dirname(parentDir);
  if (grandParent !== parentDir) {
    scanDir(grandParent, found, maxProjects);
  }

  return Array.from(found.values());
}
