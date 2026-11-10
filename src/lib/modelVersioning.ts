// Model versioning and registry for AI models used in the system

export type AITask = "vision" | "text" | "audio" | "merge" | "conditions" | "report";

interface ModelEntry {
  model: string;
  fallback: string;
  description: string;
}

const MODEL_REGISTRY: Record<AITask, ModelEntry> = {
  vision: {
    model: "google/gemini-2.5-pro",
    fallback: "google/gemini-2.5-flash",
    description: "ניתוח חזותי של פריימים וזיהוי keypoints",
  },
  text: {
    model: "google/gemini-3-flash-preview",
    fallback: "google/gemini-2.5-flash",
    description: "ניתוח טקסט, דוחות, ושאלות מומחה",
  },
  audio: {
    model: "google/gemini-3-flash-preview",
    fallback: "google/gemini-2.5-flash",
    description: "ניתוח אודיו מתקדם וסיווג גייט",
  },
  merge: {
    model: "google/gemini-3-flash-preview",
    fallback: "google/gemini-2.5-flash",
    description: "מיזוג נתונים רב-מודאלי",
  },
  conditions: {
    model: "google/gemini-3-flash-preview",
    fallback: "google/gemini-2.5-flash",
    description: "זיהוי מצבים פתולוגיים",
  },
  report: {
    model: "google/gemini-3-flash-preview",
    fallback: "google/gemini-2.5-flash",
    description: "הפקת דוחות מפורטים",
  },
};

const REGISTRY_VERSION = "2.0.0";

export function getModel(task: AITask): string {
  return MODEL_REGISTRY[task]?.model || MODEL_REGISTRY.text.model;
}

export function getFallback(task: AITask): string {
  return MODEL_REGISTRY[task]?.fallback || MODEL_REGISTRY.text.fallback;
}

export function getVersion(): string {
  return REGISTRY_VERSION;
}

export function getModelInfo(task: AITask): ModelEntry | undefined {
  return MODEL_REGISTRY[task];
}

export function getAllModels(): Record<AITask, ModelEntry> {
  return { ...MODEL_REGISTRY };
}

/** Simple hash of the registry version + model names for change tracking */
export function getRulesetHash(): string {
  const raw = REGISTRY_VERSION + ":" + Object.entries(MODEL_REGISTRY)
    .map(([k, v]) => `${k}=${v.model}`)
    .sort()
    .join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
