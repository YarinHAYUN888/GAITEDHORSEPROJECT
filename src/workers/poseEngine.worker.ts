/**
 * Pose Engine Web Worker — Client-side ONNX inference for animal keypoint detection.
 * Uses onnxruntime-web with WASM backend.
 * 
 * Messages IN:
 *   { type: 'init', modelUrl: string }
 *   { type: 'infer', frames: string[] } // base64 JPEG frames
 * 
 * Messages OUT:
 *   { type: 'ready' }
 *   { type: 'result', keypoints: RawAnimalKeypoint[][] } // per-frame array of keypoints
 *   { type: 'error', message: string }
 */

import * as ort from "onnxruntime-web";

// AP-10K style keypoint names (17 points for quadruped)
const AP10K_KEYPOINT_NAMES = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_front_paw", "right_front_paw",
  "left_hip", "right_hip", "left_knee", "right_knee",
  "left_hind_paw", "right_hind_paw",
] as const;

export interface RawAnimalKeypoint {
  name: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  confidence: number; // 0..1
}

const MODEL_CACHE_KEY = "pose-engine-model-v1";
const MODEL_INPUT_SIZE = 256; // typical RTMPose input

let session: ort.InferenceSession | null = null;

// --- Helpers ---

async function fetchModelWithCache(url: string): Promise<ArrayBuffer> {
  // Try Cache API first
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(MODEL_CACHE_KEY);
      const cached = await cache.match(url);
      if (cached) {
        return cached.arrayBuffer();
      }
      const resp = await fetch(url);
      if (resp.ok) {
        cache.put(url, resp.clone());
        return resp.arrayBuffer();
      }
    } catch {
      // Fall through to direct fetch
    }
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch model: ${resp.status}`);
  return resp.arrayBuffer();
}

async function initSession(modelUrl: string): Promise<void> {
  // Configure WASM backend
  ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 2, 4);

  const modelBuffer = await fetchModelWithCache(modelUrl);
  session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

/**
 * Decode a base64 JPEG to pixel data and resize to model input size.
 * Returns Float32Array in NCHW format [1, 3, H, W] normalized to [0, 1].
 */
function preprocessFrame(base64: string): ort.Tensor {
  // In a worker without OffscreenCanvas, we parse JPEG manually
  // For now, we decode via a minimal approach: create ImageData from base64
  // Note: Workers support OffscreenCanvas in modern browsers
  const binaryString = atob(base64.replace(/^data:image\/\w+;base64,/, ""));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Use OffscreenCanvas for decoding
  const blob = new Blob([bytes], { type: "image/jpeg" });
  // We'll return a placeholder tensor - actual implementation needs createImageBitmap
  // which is async, handled in inferFrames
  return new ort.Tensor("float32", new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE), [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
}

async function decodeAndPreprocess(base64: string): Promise<ort.Tensor> {
  const binaryString = atob(base64.replace(/^data:image\/\w+;base64,/, ""));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  
  const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  bitmap.close();
  
  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const { data } = imageData;
  
  // Convert to NCHW float32, normalized [0, 1]
  const float32 = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  const channelSize = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  for (let i = 0; i < channelSize; i++) {
    float32[i] = data[i * 4] / 255;                     // R
    float32[channelSize + i] = data[i * 4 + 1] / 255;   // G
    float32[2 * channelSize + i] = data[i * 4 + 2] / 255; // B
  }
  
  return new ort.Tensor("float32", float32, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
}

function parseOutputToKeypoints(output: ort.Tensor): RawAnimalKeypoint[] {
  const data = output.data as Float32Array;
  const numKeypoints = AP10K_KEYPOINT_NAMES.length;
  const keypoints: RawAnimalKeypoint[] = [];
  
  // Output shape depends on model: typically [1, K, 3] where 3 = (x, y, conf)
  for (let i = 0; i < numKeypoints; i++) {
    const baseIdx = i * 3;
    if (baseIdx + 2 < data.length) {
      keypoints.push({
        name: AP10K_KEYPOINT_NAMES[i],
        x: Math.max(0, Math.min(1, data[baseIdx])),
        y: Math.max(0, Math.min(1, data[baseIdx + 1])),
        confidence: Math.max(0, Math.min(1, data[baseIdx + 2])),
      });
    }
  }
  
  return keypoints;
}

async function inferFrames(frames: string[]): Promise<RawAnimalKeypoint[][]> {
  if (!session) throw new Error("Session not initialized");
  
  const results: RawAnimalKeypoint[][] = [];
  
  for (const frame of frames) {
    try {
      const inputTensor = await decodeAndPreprocess(frame);
      
      // Get the first input name from the model
      const inputName = session.inputNames[0] || "input";
      const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
      
      const outputMap = await session.run(feeds);
      const outputName = session.outputNames[0] || "output";
      const outputTensor = outputMap[outputName];
      
      if (outputTensor) {
        results.push(parseOutputToKeypoints(outputTensor));
      } else {
        // Empty frame result
        results.push(AP10K_KEYPOINT_NAMES.map(name => ({
          name, x: 0, y: 0, confidence: 0,
        })));
      }
    } catch (err) {
      // On per-frame failure, push zero-confidence keypoints
      results.push(AP10K_KEYPOINT_NAMES.map(name => ({
        name, x: 0, y: 0, confidence: 0,
      })));
    }
  }
  
  return results;
}

// --- Worker message handler ---

let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const { type } = e.data;

  if (type === "CANCEL") {
    cancelled = true;
    return;
  }

  try {
    if (type === "init") {
      cancelled = false;
      const { modelUrl } = e.data;
      await initSession(modelUrl);
      self.postMessage({ type: "ready" });
    } else if (type === "infer") {
      cancelled = false;
      const { frames } = e.data as { frames: string[] };
      const keypoints = await inferFrames(frames);
      if (!cancelled) {
        self.postMessage({ type: "result", keypoints });
      }
    }
  } catch (err) {
    if (!cancelled) {
      self.postMessage({ type: "error", message: (err as Error).message });
    }
  }
};
