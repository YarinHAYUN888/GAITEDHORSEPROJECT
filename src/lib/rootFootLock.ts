/**
 * Root Foot-Lock Correction for Horse 3D Viewer
 *
 * Eliminates hoof sliding on GLB models WITHOUT requiring rigged bones.
 * Works by computing the average world-space drift of stance-phase hooves
 * and applying a smoothed root correction to the model group.
 *
 * v2: Hybrid contact detection — combines phase profile with hoofY proximity
 * and velocity heuristic for more stable locking.
 *
 * Integration point: call step() every frame AFTER mixer.update() and
 * AFTER COM oscillation, then add the returned vector to the group position.
 *
 * References:
 *   - IK-free root correction technique (Kovar & Gleicher 2002)
 *   - Stance detection via phase profile (Hildebrand 1965)
 */

import * as THREE from "three";

export type FootKey = "frontLeft" | "frontRight" | "hindLeft" | "hindRight";

/* ─── Coordinate mapping utilities ─── */

export function normToModelLocal(
  norm: [number, number, number],
  bbox: THREE.Box3,
  out = new THREE.Vector3()
): THREE.Vector3 {
  out.set(
    THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, norm[0]),
    THREE.MathUtils.lerp(bbox.min.y, bbox.max.y, norm[1]),
    THREE.MathUtils.lerp(bbox.min.z, bbox.max.z, norm[2]),
  );
  return out;
}

export function modelLocalToWorld(
  modelGroup: THREE.Object3D,
  local: THREE.Vector3,
  out = new THREE.Vector3()
): THREE.Vector3 {
  return out.copy(local).applyMatrix4(modelGroup.matrixWorld);
}

/* ─── Foot-Lock State Machine ─── */

interface FootLockState {
  locked: boolean;
  lockPos: THREE.Vector3;     // world-space position where hoof locked at stance onset
  lastWorld: THREE.Vector3;   // previous frame's world position (for velocity heuristic)
  velocityY: number;          // smoothed vertical velocity
  lockFrame: number;          // frame counter since lock-on (for stability)
}

const makeFootState = (): FootLockState => ({
  locked: false,
  lockPos: new THREE.Vector3(),
  lastWorld: new THREE.Vector3(),
  velocityY: 0,
  lockFrame: 0,
});

type HoofWorldFn = (foot: FootKey, out: THREE.Vector3) => THREE.Vector3;
type ContactFn = (foot: FootKey, phase01: number) => boolean;

export interface RootFootLockOptions {
  /** Maximum correction magnitude per frame (meters). Prevents snapping. Default: 0.06 */
  maxCorrectionPerFrame?: number;
  /** Smoothing factor 0..1. Higher = smoother but more latent. Default: 0.85 */
  smoothing?: number;
  /** Ground Y threshold: hoof is considered "near ground" below this world Y. Default: 0.03 */
  groundYThreshold?: number;
  /** Use hybrid contact detection (phase + hoofY + velocity). Default: true */
  useHybridDetection?: boolean;
}

/**
 * Root motion correction to enforce foot lock without bones.
 *
 * v2 Hybrid detection:
 *   stance = phaseProfile AND (hoofY close to ground) AND (verticalVelocity low)
 *   This prevents locking on hooves that are phase-stance but visually in the air.
 */
export class RootFootLock {
  private feet: Record<FootKey, FootLockState> = {
    frontLeft: makeFootState(),
    frontRight: makeFootState(),
    hindLeft: makeFootState(),
    hindRight: makeFootState(),
  };

  private tmp = new THREE.Vector3();
  private delta = new THREE.Vector3();
  private accum = new THREE.Vector3();
  private smooth = new THREE.Vector3();
  private zeroVec = new THREE.Vector3();

  constructor(
    private getHoofWorld: HoofWorldFn,
    private isStance: ContactFn,
    private options: RootFootLockOptions = {}
  ) {}

  /**
   * Compute root correction for this frame.
   * Call AFTER mixer.update() and COM oscillation.
   * @returns Vector3 to ADD to modelGroup.position
   */
  step(phase01: number, dt: number): THREE.Vector3 {
    const maxCorr = this.options.maxCorrectionPerFrame ?? 0.06;
    const alpha = 1 - Math.pow(1 - (this.options.smoothing ?? 0.85), dt * 60);
    const groundY = this.options.groundYThreshold ?? 0.03;
    const hybrid = this.options.useHybridDetection !== false;

    let count = 0;
    this.accum.set(0, 0, 0);

    const keys: FootKey[] = ["frontLeft", "frontRight", "hindLeft", "hindRight"];

    for (const k of keys) {
      const st = this.feet[k];
      const phaseStance = this.isStance(k, phase01);

      // Get current hoof world position
      const hoofW = this.getHoofWorld(k, this.tmp);

      // Compute vertical velocity (smoothed)
      const rawVelY = (hoofW.y - st.lastWorld.y) / Math.max(dt, 1e-4);
      st.velocityY = st.velocityY * 0.7 + rawVelY * 0.3;

      // Hybrid contact detection
      let isContact: boolean;
      if (hybrid) {
        const nearGround = hoofW.y < groundY;
        const lowVelocity = Math.abs(st.velocityY) < 0.5;
        // Phase must agree AND hoof must be near ground
        // OR phase says stance and hoof is very close to ground (override velocity)
        isContact = phaseStance && (nearGround || (hoofW.y < groundY * 2 && lowVelocity));
      } else {
        isContact = phaseStance;
      }

      // State transitions
      if (isContact && !st.locked) {
        st.locked = true;
        st.lockPos.copy(hoofW);
        st.lockFrame = 0;
      }
      if (!isContact && st.locked) {
        st.locked = false;
        st.lockFrame = 0;
      }

      if (st.locked) {
        st.lockFrame++;
        // Drift: where hoof should be minus where it is
        this.delta.subVectors(st.lockPos, hoofW);
        
        // Weight by lock stability — more weight as lock matures
        const stabilityWeight = Math.min(1.0, st.lockFrame / 5);
        this.delta.multiplyScalar(stabilityWeight);
        
        this.accum.add(this.delta);
        count++;
      }

      st.lastWorld.copy(hoofW);
    }

    if (count === 0) {
      // No feet in stance — decay smoothing toward zero
      this.smooth.lerp(this.zeroVec, alpha);
      return this.smooth;
    }

    // Average correction across all locked feet
    this.accum.multiplyScalar(1 / count);

    // Clamp to prevent snapping
    const len = this.accum.length();
    if (len > maxCorr) this.accum.multiplyScalar(maxCorr / len);

    // Temporal smoothing
    this.smooth.lerp(this.accum, alpha);
    return this.smooth;
  }

  /** Reset all lock states (call on gait change) */
  reset(): void {
    const keys: FootKey[] = ["frontLeft", "frontRight", "hindLeft", "hindRight"];
    for (const k of keys) {
      const f = this.feet[k];
      f.locked = false;
      f.lockPos.set(0, 0, 0);
      f.lastWorld.set(0, 0, 0);
      f.velocityY = 0;
      f.lockFrame = 0;
    }
    this.smooth.set(0, 0, 0);
  }

  /** Get current debug info for overlay */
  getDebugInfo(phase01: number): { foot: FootKey; locked: boolean; velocityY: number }[] {
    const keys: FootKey[] = ["frontLeft", "frontRight", "hindLeft", "hindRight"];
    return keys.map(k => ({
      foot: k,
      locked: this.feet[k].locked,
      velocityY: this.feet[k].velocityY,
    }));
  }
}
