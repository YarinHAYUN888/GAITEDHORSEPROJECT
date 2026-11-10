/**
 * Keypoint Adapter — Maps AP-10K animal pose keypoints to the horse biomech keypoint contract.
 * 
 * AP-10K quadruped layout (indices):
 *   0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear,
 *   5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow,
 *   9: left_front_paw, 10: right_front_paw,
 *   11: left_hip, 12: right_hip, 13: left_knee, 14: right_knee,
 *   15: left_hind_paw, 16: right_hind_paw
 * 
 * Target horse KeypointsData (per leg):
 *   hoof, fetlock, carpus (front) / stifle (hind), shoulder (front) / hip (hind)
 * 
 * Strategy:
 *   - paw → hoof (direct)
 *   - elbow → carpus proxy (front), knee → stifle proxy (hind)
 *   - fetlock: interpolated at ~30% between hoof and elbow/knee
 *   - shoulder / hip: direct mapping
 */

import type { KeypointsData, Keypoint } from "@/types/gait";
import type { RawAnimalKeypoint } from "@/workers/poseEngine.worker";

const FETLOCK_RATIO = 0.30; // 30% from hoof toward elbow/knee

interface Point {
  x: number;
  y: number;
  conf: number;
}

function findKp(frame: RawAnimalKeypoint[], name: string): Point | null {
  const kp = frame.find(k => k.name === name);
  if (!kp || kp.confidence < 0.05) return null;
  return { x: kp.x, y: kp.y, conf: kp.confidence };
}

function interpolate(a: Point, b: Point, ratio: number): Point {
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
    conf: Math.min(a.conf, b.conf) * 0.9, // slightly reduced confidence for interpolated point
  };
}

function toTuple(p: Point | null): [number, number] | undefined {
  if (!p) return undefined;
  return [p.x, p.y];
}

function buildLeg(
  hoof: Point | null,
  midJoint: Point | null, // elbow or knee
  topJoint: Point | null, // shoulder or hip
  isFront: boolean,
): Keypoint {
  const fetlock = hoof && midJoint ? interpolate(hoof, midJoint, FETLOCK_RATIO) : null;

  if (isFront) {
    return {
      hoof: toTuple(hoof),
      fetlock: toTuple(fetlock),
      carpus: toTuple(midJoint),
      shoulder: toTuple(topJoint),
    };
  } else {
    return {
      hoof: toTuple(hoof),
      fetlock: toTuple(fetlock),
      stifle: toTuple(midJoint),
      hip: toTuple(topJoint),
    };
  }
}

function adaptSingleFrame(frame: RawAnimalKeypoint[]): KeypointsData {
  // Front legs
  const lFrontPaw = findKp(frame, "left_front_paw");
  const rFrontPaw = findKp(frame, "right_front_paw");
  const lElbow = findKp(frame, "left_elbow");
  const rElbow = findKp(frame, "right_elbow");
  const lShoulder = findKp(frame, "left_shoulder");
  const rShoulder = findKp(frame, "right_shoulder");

  // Hind legs
  const lHindPaw = findKp(frame, "left_hind_paw");
  const rHindPaw = findKp(frame, "right_hind_paw");
  const lKnee = findKp(frame, "left_knee");
  const rKnee = findKp(frame, "right_knee");
  const lHip = findKp(frame, "left_hip");
  const rHip = findKp(frame, "right_hip");

  // Count detected keypoints for the "detected" flag
  const allPoints = [lFrontPaw, rFrontPaw, lElbow, rElbow, lShoulder, rShoulder, lHindPaw, rHindPaw, lKnee, rKnee, lHip, rHip];
  const detectedCount = allPoints.filter(p => p !== null).length;

  return {
    detected: detectedCount >= 4, // at least 4 keypoints needed for basic analysis
    frontLeft: buildLeg(lFrontPaw, lElbow, lShoulder, true),
    frontRight: buildLeg(rFrontPaw, rElbow, rShoulder, true),
    hindLeft: buildLeg(lHindPaw, lKnee, lHip, false),
    hindRight: buildLeg(rHindPaw, rKnee, rHip, false),
  };
}

/**
 * Convert raw AP-10K animal keypoints (per-frame) to the horse KeypointsData[] format
 * used by the biomechanics pipeline.
 */
export function adaptAnimalPoseToHorseKeypoints(
  rawFrames: RawAnimalKeypoint[][],
): KeypointsData[] {
  return rawFrames.map(adaptSingleFrame);
}

/**
 * Compute temporal jitter metric for keypoint stability across frames.
 * Lower = more stable. Used for validation/comparison with LLM keypoints.
 */
export function computeKeypointJitter(
  rawFrames: RawAnimalKeypoint[][],
): number {
  if (rawFrames.length < 2) return 0;

  let totalDisplacement = 0;
  let count = 0;

  for (let f = 1; f < rawFrames.length; f++) {
    const prev = rawFrames[f - 1];
    const curr = rawFrames[f];
    for (let k = 0; k < Math.min(prev.length, curr.length); k++) {
      if (prev[k].confidence > 0.2 && curr[k].confidence > 0.2) {
        const dx = curr[k].x - prev[k].x;
        const dy = curr[k].y - prev[k].y;
        totalDisplacement += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }
  }

  return count > 0 ? totalDisplacement / count : 0;
}
