// Pipeline error recovery — persist and restore interrupted analysis state
const STORAGE_KEY = "susitsa-pipeline-recovery";

export interface RecoverableState {
  horseName?: string;
  horseId?: string;
  breedId?: string;
  dmrt3Genotype?: string;
  analysisMode?: string;
  videoFileName?: string;
  timestamp: number;
}

export function savePipelineState(state: Omit<RecoverableState, "timestamp">) {
  try {
    const entry: RecoverableState = { ...state, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // storage full or blocked
  }
}

export function loadPipelineState(): RecoverableState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: RecoverableState = JSON.parse(raw);
    // expire after 24 hours
    if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
      clearPipelineState();
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function clearPipelineState() {
  localStorage.removeItem(STORAGE_KEY);
}
