// HorseModel — GLB model with body COM oscillation, foot-lock correction,
// procedural per-leg animation, AND fallback procedural geometry legs
// when the GLB has no usable skeleton.

import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { computeBodyCOM, getPhaseOffsetsForGait, getStanceDuty } from "@/lib/gaitCalculations";
import { RootFootLock, normToModelLocal, modelLocalToWorld, type FootKey } from "@/lib/rootFootLock";
import { discoverLegBones, applyProceduralLegs, type LegBoneChain } from "@/lib/proceduralLegAnimation";
import { JOINT_POSITIONS_NORM } from "./constants";
import ProceduralLegs from "./ProceduralLegs";

interface HorseModelProps {
  isPlaying: boolean;
  speed: number;
  phaseRef: React.MutableRefObject<number>;
  onBBoxReady?: (bbox: THREE.Box3) => void;
  gaitType?: string;
}

export default function HorseModel({ isPlaying, speed, phaseRef, onBBoxReady, gaitType }: HorseModelProps) {
  const { scene, animations } = useGLTF("/models/Horse.glb");
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const clipDurationRef = useRef<number>(1);
  const bboxEmitted = useRef(false);
  const modelRef = useRef<THREE.Group>(null);
  const bboxLocalRef = useRef<THREE.Box3 | null>(null);
  const footLockRef = useRef<RootFootLock | null>(null);
  const legChainsRef = useRef<LegBoneChain[]>([]);
  const _flTmpLocal = useRef(new THREE.Vector3()).current;
  const gaitTypeRef = useRef(gaitType);
  gaitTypeRef.current = gaitType;

  const [hasBones, setHasBones] = useState(false);
  const [bbox, setBBox] = useState<THREE.Box3 | null>(null);

  // Setup animation mixer
  useEffect(() => {
    if (animations.length > 0) {
      const clip = animations[0];
      const mixer = new THREE.AnimationMixer(scene);
      const action = mixer.clipAction(clip);
      action.reset();
      action.play();
      mixerRef.current = mixer;
      actionRef.current = action;
      clipDurationRef.current = Math.max(clip.duration, 1e-6);
      return () => {
        mixer.stopAllAction();
        mixerRef.current = null;
        actionRef.current = null;
      };
    }
  }, [scene, animations]);

  // Discover leg bones once scene is loaded
  useEffect(() => {
    const chains = discoverLegBones(scene);
    legChainsRef.current = chains;
    setHasBones(chains.length >= 4);
    console.log(`[HorseModel] Discovered ${chains.length} leg bone chains`);
  }, [scene]);

  // Play/pause and speed control
  useEffect(() => {
    const action = actionRef.current;
    if (!action) return;
    action.paused = !isPlaying;
    action.timeScale = speed;
  }, [isPlaying, speed]);

  // Reset foot-lock when gait changes
  useEffect(() => {
    footLockRef.current?.reset();
  }, [gaitType]);

  // Per-frame animation loop
  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    const action = actionRef.current;

    // Advance phase even without animation clip (for procedural legs)
    if (!mixer || !action) {
      if (isPlaying) {
        const gaitCycleHz = 1.25 * speed;
        phaseRef.current = (phaseRef.current + delta * gaitCycleHz) % 1;
      }
    } else {
      if (isPlaying) {
        mixer.update(delta);
      }
      const dur = clipDurationRef.current;
      const t = action.time;
      phaseRef.current = ((t % dur) + dur) % dur / dur;

      // Apply procedural leg animation ON TOP of the base clip
      if (legChainsRef.current.length > 0) {
        applyProceduralLegs(
          legChainsRef.current,
          phaseRef.current,
          gaitTypeRef.current,
          0.75,
        );
      }
    }

    // Body COM oscillation
    if (modelRef.current) {
      const com = computeBodyCOM(phaseRef.current, gaitTypeRef.current);
      modelRef.current.position.set(com.lateralShift, -0.01 + com.verticalShift, com.forwardShift);
      modelRef.current.rotation.set(com.pitchRad, Math.PI / 2, com.rollRad);
    }

    // Foot-lock correction
    if (modelRef.current && footLockRef.current) {
      modelRef.current.updateMatrixWorld(true);
      const dt = Math.min(delta, 1 / 30);
      const corr = footLockRef.current.step(phaseRef.current, dt);
      modelRef.current.position.add(corr);
    }
  });

  const cloned = useMemo(() => {
    const s = scene.clone();
    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0.48, 0.28, 0.15),
          roughness: 0.55,
          metalness: 0.02,
          clearcoat: 0.15,
          clearcoatRoughness: 0.4,
          sheen: 0.3,
          sheenRoughness: 0.6,
          sheenColor: new THREE.Color(0.7, 0.5, 0.3),
          transparent: true,
          opacity: 0.88,
        });
      }
    });
    return s;
  }, [scene]);

  useEffect(() => {
    if (bboxEmitted.current || !onBBoxReady || !cloned) return;
    const tempObj = cloned.clone();
    tempObj.scale.set(0.012, 0.012, 0.012);
    tempObj.position.set(0, -0.01, 0);
    tempObj.rotation.set(0, Math.PI / 2, 0);
    tempObj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(tempObj);
    onBBoxReady(b);
    bboxLocalRef.current = b;
    setBBox(b);

    footLockRef.current = new RootFootLock(
      (foot: FootKey, out: THREE.Vector3) => {
        const bb = bboxLocalRef.current;
        const g = modelRef.current;
        if (!bb || !g) return out;
        const norm = JOINT_POSITIONS_NORM[foot]?.hoof;
        if (!norm) return out;
        normToModelLocal(norm, bb, _flTmpLocal);
        return modelLocalToWorld(g, _flTmpLocal, out);
      },
      (foot: FootKey, phase01: number) => {
        const off = getPhaseOffsetsForGait(gaitTypeRef.current);
        const duty = getStanceDuty(gaitTypeRef.current);
        const t = ((phase01 + (off[foot] ?? 0)) % 1 + 1) % 1;
        return t < duty;
      },
      { maxCorrectionPerFrame: 0.06, smoothing: 0.90 }
    );

    bboxEmitted.current = true;
  }, [cloned, onBBoxReady]);

  return (
    <group ref={modelRef}>
      <primitive object={cloned} scale={0.012} />
      {/* Fallback: procedural geometry legs when GLB has no bones */}
      {!hasBones && bbox && (
        <ProceduralLegs phaseRef={phaseRef} gaitType={gaitType} bbox={bbox} />
      )}
    </group>
  );
}
