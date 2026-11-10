/**
 * Pose Keypoints Service — Manages the ONNX pose engine worker lifecycle.
 * Provides a clean async API that returns KeypointsData[] matching the pipeline contract.
 */

import type { KeypointsData } from "@/types/gait";
import { adaptAnimalPoseToHorseKeypoints } from "@/lib/keypointAdapter";
import type { RawAnimalKeypoint } from "@/workers/poseEngine.worker";

const MODEL_PATH = "/models/pose_animal.onnx";
const INIT_TIMEOUT_MS = 30_000;
const INFER_TIMEOUT_MS = 60_000;
const MIN_MEAN_CONFIDENCE = 0.3; // Below this, pose engine result is considered unreliable

export type KeypointsSource = "pose_engine" | "llm" | "hybrid_repair";

export interface PoseEngineResult {
  keypoints: KeypointsData[];
  source: KeypointsSource;
  meanConfidence: number;
  rawKeypoints?: RawAnimalKeypoint[][];
}

let workerInstance: Worker | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("@/workers/poseEngine.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return workerInstance;
}

function sendMessage(worker: Worker, msg: object, timeoutMs: number): Promise<MessageEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Pose engine timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (e: MessageEvent) => {
      clearTimeout(timer);
      worker.removeEventListener("message", handler);
      if (e.data.type === "error") {
        reject(new Error(e.data.message));
      } else {
        resolve(e);
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage(msg);
  });
}

async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const worker = getWorker();
    const modelUrl = `${window.location.origin}${MODEL_PATH}`;
    await sendMessage(worker, { type: "init", modelUrl }, INIT_TIMEOUT_MS);
    isInitialized = true;
  })();

  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/**
 * Check if the ONNX model file is available (exists at the expected path).
 */
export async function isPoseEngineAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(MODEL_PATH, { method: "HEAD" });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Run pose estimation on a set of frames.
 * Returns adapted horse keypoints in the same format the pipeline expects.
 */
export async function getKeypointsFromPoseEngine(
  frames: string[],
  fps: number = 30,
): Promise<PoseEngineResult> {
  await ensureInitialized();

  const worker = getWorker();
  const response = await sendMessage(worker, { type: "infer", frames }, INFER_TIMEOUT_MS);

  const rawKeypoints: RawAnimalKeypoint[][] = response.data.keypoints;

  // Compute mean confidence across all frames and keypoints
  let totalConf = 0;
  let totalCount = 0;
  for (const frame of rawKeypoints) {
    for (const kp of frame) {
      totalConf += kp.confidence;
      totalCount++;
    }
  }
  const meanConfidence = totalCount > 0 ? totalConf / totalCount : 0;

  // Adapt to horse keypoints format
  const keypoints = adaptAnimalPoseToHorseKeypoints(rawKeypoints);

  return {
    keypoints,
    source: "pose_engine",
    meanConfidence,
    rawKeypoints,
  };
}

/**
 * Dispose the worker to free resources.
 */
export function disposePoseEngine(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    isInitialized = false;
    initPromise = null;
  }
}

export { MIN_MEAN_CONFIDENCE };
