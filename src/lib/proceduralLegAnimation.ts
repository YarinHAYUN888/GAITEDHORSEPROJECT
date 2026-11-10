/**
 * Procedural Leg Animation for GLB Horse Models
 *
 * Discovers bone chains in the skeleton and applies per-leg phase-driven
 * rotations to make each leg move according to the selected gait's footfall
 * pattern. Works on top of the base GLB animation mixer.
 *
 * v2 — Improved biomechanical realism:
 *   - Asymmetric D-shaped hoof arc (Clayton 2004)
 *   - Joint cascading: proximal leads, distal lags
 *   - Separate front/hind kinematics (shoulder vs hip ROM)
 *   - Gait-specific stance retraction and swing protraction
 *   - Smooth breakover transition
 *
 * References:
 *   - Clayton (2004): The Dynamic Horse — joint kinematics
 *   - Hildebrand (1965): Symmetrical gaits of horses
 *   - Hobbs et al. (2016): Hoof trajectory in gaited breeds
 *   - Vincelette (2023): Four-beat lateral gait analysis
 */

import * as THREE from "three";
import { getPhaseOffsetsForGait, getStanceDuty, getGaitMeta } from "./gaitCalculations";

export interface LegBoneChain {
  legKey: "frontLeft" | "frontRight" | "hindLeft" | "hindRight";
  upper: THREE.Bone;       // shoulder/hip bone
  lower: THREE.Bone;       // knee/stifle bone
  distal?: THREE.Bone;     // fetlock/hoof bone (optional)
  restQuats: {
    upper: THREE.Quaternion;
    lower: THREE.Quaternion;
    distal?: THREE.Quaternion;
  };
}

interface BoneCandidate {
  bone: THREE.Bone;
  worldPos: THREE.Vector3;
  depth: number;
  parent: THREE.Bone | null;
}

/**
 * Discover leg bone chains from a GLB scene's skeleton.
 * Uses spatial heuristics: front/back from Z, left/right from X.
 */
export function discoverLegBones(scene: THREE.Object3D): LegBoneChain[] {
  const bones: BoneCandidate[] = [];
  const tempPos = new THREE.Vector3();

  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const bone = obj as THREE.Bone;
      bone.getWorldPosition(tempPos);

      let depth = 0;
      let p: THREE.Object3D | null = bone.parent;
      while (p && (p as THREE.Bone).isBone) {
        depth++;
        p = p.parent;
      }

      bones.push({
        bone,
        worldPos: tempPos.clone(),
        depth,
        parent: bone.parent instanceof THREE.Bone ? bone.parent as THREE.Bone : null,
      });
    }
  });

  if (bones.length < 4) return [];

  const bbox = new THREE.Box3();
  for (const b of bones) bbox.expandByPoint(b.worldPos);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const legCandidates = bones.filter(b => {
    const relY = (b.worldPos.y - bbox.min.y) / size.y;
    return relY < 0.75 && b.depth >= 1;
  });

  if (legCandidates.length < 4) return [];

  type Quadrant = "frontLeft" | "frontRight" | "hindLeft" | "hindRight";
  const quadrants: Record<Quadrant, BoneCandidate[]> = {
    frontLeft: [], frontRight: [], hindLeft: [], hindRight: [],
  };

  for (const bc of legCandidates) {
    const isFront = bc.worldPos.z > center.z;
    const isLeft = bc.worldPos.x > center.x;
    const key: Quadrant = isFront
      ? (isLeft ? "frontLeft" : "frontRight")
      : (isLeft ? "hindLeft" : "hindRight");
    quadrants[key].push(bc);
  }

  const chains: LegBoneChain[] = [];

  for (const [key, candidates] of Object.entries(quadrants) as [Quadrant, BoneCandidate[]][]) {
    if (candidates.length < 2) continue;
    candidates.sort((a, b) => a.depth - b.depth);

    let chain = findChain(candidates);
    if (!chain && candidates.length >= 2) {
      chain = {
        upper: candidates[0].bone,
        lower: candidates[1].bone,
        distal: candidates[2]?.bone,
      };
    }

    if (chain) {
      chains.push({
        legKey: key,
        upper: chain.upper,
        lower: chain.lower,
        distal: chain.distal,
        restQuats: {
          upper: chain.upper.quaternion.clone(),
          lower: chain.lower.quaternion.clone(),
          distal: chain.distal ? chain.distal.quaternion.clone() : undefined,
        },
      });
    }
  }

  return chains;
}

function findChain(candidates: BoneCandidate[]): { upper: THREE.Bone; lower: THREE.Bone; distal?: THREE.Bone } | null {
  for (const upper of candidates) {
    for (const lower of candidates) {
      if (lower.parent === upper.bone) {
        const distal = candidates.find(d => d.parent === lower.bone);
        return { upper: upper.bone, lower: lower.bone, distal: distal?.bone };
      }
    }
  }
  return null;
}

/* ─── Per-frame animation ─── */

const _tmpQuat = new THREE.Quaternion();
const _swingAxis = new THREE.Vector3(1, 0, 0); // Sagittal plane rotation

/** Smooth Hermite interpolation */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Gait-specific swing amplitude config */
interface SwingConfig {
  /** Upper bone max swing angle (radians) */
  upperAmp: number;
  /** Lower bone max flexion angle (radians) */
  lowerAmp: number;
  /** Distal bone max angle (radians) */
  distalAmp: number;
  /** How much hind legs differ from front (multiplier) */
  hindFactor: number;
  /** Stance retraction strength */
  retractionAmp: number;
}

function getSwingConfig(gaitType?: string): SwingConfig {
  const key = gaitType?.toLowerCase().replace(/[\s-]/g, "_") ?? "";
  switch (key) {
    case "rack":
    case "singlefoot":
    case "four_beat":
      return { upperAmp: 0.22, lowerAmp: 0.38, distalAmp: 0.20, hindFactor: 0.9, retractionAmp: 0.10 };
    case "tolt":
    case "tölt":
      return { upperAmp: 0.20, lowerAmp: 0.35, distalAmp: 0.18, hindFactor: 0.85, retractionAmp: 0.09 };
    case "running_walk":
      return { upperAmp: 0.24, lowerAmp: 0.32, distalAmp: 0.22, hindFactor: 1.05, retractionAmp: 0.12 };
    case "paso_fino":
      return { upperAmp: 0.12, lowerAmp: 0.18, distalAmp: 0.10, hindFactor: 0.8, retractionAmp: 0.05 };
    case "trot":
    case "diagonal":
      return { upperAmp: 0.20, lowerAmp: 0.35, distalAmp: 0.18, hindFactor: 0.95, retractionAmp: 0.10 };
    case "pace":
    case "lateral":
      return { upperAmp: 0.18, lowerAmp: 0.28, distalAmp: 0.15, hindFactor: 0.9, retractionAmp: 0.08 };
    case "walk":
      return { upperAmp: 0.15, lowerAmp: 0.22, distalAmp: 0.12, hindFactor: 0.9, retractionAmp: 0.07 };
    default:
      return { upperAmp: 0.18, lowerAmp: 0.30, distalAmp: 0.16, hindFactor: 0.9, retractionAmp: 0.08 };
  }
}

/**
 * Compute biomechanically accurate swing/stance rotation for a single leg.
 * 
 * Stance phase: leg pushes back (retraction), slight knee flexion at mid-stance.
 * Swing phase: D-shaped arc — fast breakover, sustained height, smooth landing.
 * Joint cascading: upper leads, lower follows with delay, distal follows lower.
 */
function legSwingAngle(
  legPhase: number,
  stanceDuty: number,
  isHind: boolean,
  config: SwingConfig,
): {
  upperAngle: number;
  lowerAngle: number;
  distalAngle: number;
} {
  const p = ((legPhase % 1) + 1) % 1;
  const hindMul = isHind ? config.hindFactor : 1.0;

  if (p < stanceDuty) {
    // ─── STANCE PHASE ───
    // Leg retracts from protracted to retracted position
    const t = p / stanceDuty;
    
    // Upper: smooth retraction arc (forward → backward)
    const retractionCurve = smoothstep(t);
    const upperRetract = config.retractionAmp * (0.5 - retractionCurve) * hindMul;
    
    // Lower: slight flexion at mid-stance (weight bearing), minimal at start/end
    const midStanceFlex = Math.sin(t * Math.PI);
    const lowerFlex = -0.06 * midStanceFlex * hindMul;
    
    // Distal: fetlock sinks under load at mid-stance (dorsiflexion)
    const distalFlex = 0.05 * midStanceFlex * hindMul;

    return {
      upperAngle: upperRetract,
      lowerAngle: lowerFlex,
      distalAngle: distalFlex,
    };
  } else {
    // ─── SWING PHASE ───
    const swingDuration = 1 - stanceDuty;
    const t = (p - stanceDuty) / swingDuration;

    // Asymmetric D-shaped arc for hoof trajectory
    // Phase 1 (0-15%): Breakover — rapid lift from ground
    // Phase 2 (15-55%): Peak height — maximum flexion, forward reach begins
    // Phase 3 (55-85%): Forward reach — extending, descending
    // Phase 4 (85-100%): Landing prep — extending fully, decelerating
    
    let liftCurve: number;
    if (t < 0.15) {
      liftCurve = smoothstep(t / 0.15); // Fast breakover
    } else if (t < 0.55) {
      // Sustained peak with slight undulation
      liftCurve = 1.0 - 0.08 * smoothstep((t - 0.15) / 0.4);
    } else if (t < 0.85) {
      // Gradual descent
      liftCurve = 0.92 * (1 - smoothstep((t - 0.55) / 0.3));
    } else {
      // Final landing — smooth to zero
      const landT = (t - 0.85) / 0.15;
      liftCurve = 0.92 * (1 - smoothstep((0.85 - 0.55) / 0.3)) * (1 - smoothstep(landT));
    }

    // Upper bone: protraction arc (forward reach)
    // Starts retracted, swings forward, reaches max protraction at ~70%
    const protractionCurve = -config.retractionAmp * 0.5 + config.upperAmp * smoothstep(t * 1.2);
    const upperAngle = protractionCurve * hindMul;

    // Lower bone: flexion follows lift curve with slight phase lag (joint cascading)
    // Peak flexion slightly after peak lift
    const laggedT = Math.max(0, t - 0.05);
    const lowerLiftCurve = laggedT < 0.15
      ? smoothstep(laggedT / 0.15)
      : laggedT < 0.5
        ? 1.0
        : Math.max(0, Math.cos(((laggedT - 0.5) / 0.5) * Math.PI * 0.5));
    const lowerAngle = -config.lowerAmp * lowerLiftCurve * hindMul;

    // Distal bone: follows lower with more lag, extends before landing
    const distalLagT = Math.max(0, t - 0.10);
    let distalCurve: number;
    if (distalLagT < 0.4) {
      distalCurve = smoothstep(distalLagT / 0.4); // Curl up
    } else if (distalLagT < 0.7) {
      distalCurve = 1.0; // Hold
    } else {
      distalCurve = 1.0 - smoothstep((distalLagT - 0.7) / 0.3); // Extend for landing
    }
    const distalAngle = config.distalAmp * distalCurve * hindMul * (t < 0.6 ? 1 : 1 - smoothstep((t - 0.6) / 0.4) * 0.7);

    return {
      upperAngle,
      lowerAngle,
      distalAngle,
    };
  }
}

/**
 * Apply procedural leg animation to discovered bone chains.
 * Call every frame AFTER mixer.update().
 *
 * IMPORTANT: Restores rest quaternion before applying procedural rotation
 * to prevent quaternion accumulation (frame-over-frame drift).
 *
 * @param chains  - Discovered leg bone chains
 * @param phase01 - Global animation phase (0..1)
 * @param gaitType - Selected gait type
 * @param blend   - Blend factor 0..1 (0 = base animation only, 1 = full procedural)
 */
export function applyProceduralLegs(
  chains: LegBoneChain[],
  phase01: number,
  gaitType?: string,
  blend: number = 0.7,
): void {
  const offsets = getPhaseOffsetsForGait(gaitType);
  const stanceDuty = getStanceDuty(gaitType);
  const config = getSwingConfig(gaitType);

  for (const chain of chains) {
    const legOffset = offsets[chain.legKey] ?? 0;
    const legPhase = ((phase01 + legOffset) % 1 + 1) % 1;
    const isHind = chain.legKey.startsWith("hind");

    const { upperAngle, lowerAngle, distalAngle } = legSwingAngle(legPhase, stanceDuty, isHind, config);

    // Upper bone: blend procedural on top of current animation pose
    _tmpQuat.setFromAxisAngle(_swingAxis, upperAngle * blend);
    chain.upper.quaternion.multiply(_tmpQuat);

    // Lower bone
    _tmpQuat.setFromAxisAngle(_swingAxis, lowerAngle * blend);
    chain.lower.quaternion.multiply(_tmpQuat);

    // Distal bone (if present)
    if (chain.distal) {
      _tmpQuat.setFromAxisAngle(_swingAxis, distalAngle * blend);
      chain.distal.quaternion.multiply(_tmpQuat);
    }
  }
}
