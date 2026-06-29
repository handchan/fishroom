// Local backup: export the full fishroom to a JSON file and re-import it.
// This is backend-agnostic and always works, with or without cloud sync.

import type { AppState } from "./types";

interface BackupFile {
  app: "fishroom";
  version: number;
  exportedAt: string;
  state: AppState;
}

export function exportJSON(state: AppState): string {
  const file: BackupFile = {
    app: "fishroom",
    version: state.version,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(file, null, 2);
}

export function downloadBackup(state: AppState) {
  const blob = new Blob([exportJSON(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `fishroom-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Parse + lightly validate an imported backup. Throws on bad input. */
export function parseBackup(text: string): AppState {
  const data = JSON.parse(text) as Partial<BackupFile> & Partial<AppState>;
  // Accept either a wrapped backup file or a bare AppState.
  const state = (data as BackupFile).state ?? (data as AppState);
  if (!state || !Array.isArray(state.tanks) || !Array.isArray(state.stacks)) {
    throw new Error("Not a valid Fishroom backup.");
  }
  return state;
}
