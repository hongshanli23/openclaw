import path from "node:path";
import { resolveStateDir } from "../paths.js";
import type { SessionEntry } from "./types.js";

const LEGACY_STATE_DIR_NAMES = new Set([".openclaw", ".clawdbot", ".moldbot"]);

function extractLegacyStateRelativePath(candidate: string): string | undefined {
  if (!path.isAbsolute(candidate)) {
    return undefined;
  }
  const normalized = path.normalize(path.resolve(candidate));
  const parts = normalized.split(path.sep).filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const segment = parts[index];
    if (!segment || !LEGACY_STATE_DIR_NAMES.has(segment)) {
      continue;
    }
    return parts.slice(index + 1).join(path.sep);
  }
  return undefined;
}

function migrateStateBoundPath(candidate: string, stateDir: string): string {
  const relative = extractLegacyStateRelativePath(candidate);
  if (relative == null) {
    return candidate;
  }
  return relative ? path.join(stateDir, relative) : stateDir;
}

export function applySessionStoreMigrations(store: Record<string, SessionEntry>): void {
  const stateDir = resolveStateDir(process.env);
  // Best-effort migration: message provider → channel naming.
  for (const entry of Object.values(store)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const rec = entry as unknown as Record<string, unknown>;
    if (typeof rec.channel !== "string" && typeof rec.provider === "string") {
      rec.channel = rec.provider;
      delete rec.provider;
    }
    if (typeof rec.lastChannel !== "string" && typeof rec.lastProvider === "string") {
      rec.lastChannel = rec.lastProvider;
      delete rec.lastProvider;
    }

    // Best-effort migration: legacy `room` field → `groupChannel` (keep value, prune old key).
    if (typeof rec.groupChannel !== "string" && typeof rec.room === "string") {
      rec.groupChannel = rec.room;
      delete rec.room;
    } else if ("room" in rec) {
      delete rec.room;
    }

    if (typeof rec.sessionFile === "string") {
      rec.sessionFile = migrateStateBoundPath(rec.sessionFile, stateDir);
    }
    if (typeof rec.workspaceDir === "string") {
      rec.workspaceDir = migrateStateBoundPath(rec.workspaceDir, stateDir);
    }
    if (typeof rec.spawnedWorkspaceDir === "string") {
      rec.spawnedWorkspaceDir = migrateStateBoundPath(rec.spawnedWorkspaceDir, stateDir);
    }
  }
}
