import { useRef, useState, useMemo, useEffect, Suspense, memo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LEG_COLORS, LEG_LABELS_SHORT, LEG_CONNECTIONS,
  getPhaseOffsetsForGait, getGaitMeta,
  compute3DDisplacement, computeBodyCOM, getHeadBobAmplitude, getStanceDuty,
} from "@/lib/gaitCalculations";
import { RootFootLock, normToModelLocal, modelLocalToWorld, type FootKey } from "@/lib/rootFootLock";
import { discoverLegBones, applyProceduralLegs, type LegBoneChain } from "@/lib/proceduralLegAnimation";

/**
 * Hero Animation — GLB Horse Model with Procedural IK-Driven Gait
 *
 * Uses the real 3D horse model with:
 * - Phase-driven limb displacement per gait type
 * - COM oscillation (pitch, roll, vertical, forward, lateral sway)
 * - Head bob, spine flex, tail dynamics
 * - Root foot-lock to eliminate hoof sliding
 * - Beat Phase HUD for 4-beat gaits
 * - Hoof trails and ground contact rings
 */

/* ─── Gait Options ─── */
const GAIT_OPTIONS = [
  { key: "trot", labelHe: "טרוט" },
  { key: "running_walk", labelHe: "הליכה רצה" },
  { key: "singlefoot", labelHe: "סינגלפוט" },
  { key: "rack", labelHe: "ראק" },
  { key: "pace", labelHe: "פייס" },
  { key: "broken_pace", labelHe: "פייס שבור" },
  { key: "walk", labelHe: "הליכה" },
  { key: "tolt", labelHe: "טולט" },
];

/* ─── Normalized joint positions (0-1) mapped to GLB bounding box ─── */
const JOINT_POSITIONS_NORM: Record<string, Record<string, [number, number, number]>> = {
  frontLeft: {
    shoulder: [0.62, 0.83, 0.69],
    carpus: [0.64, 0.47, 0.73],
    fetlock: [0.64, 0.17, 0.76],
    hoof: [0.64, 0.0, 0.77],
  },
  frontRight: {
    shoulder: [0.38, 0.83, 0.69],
    carpus: [0.36, 0.47, 0.73],
    fetlock: [0.36, 0.17, 0.76],
    hoof: [0.36, 0.0, 0.77],
  },
  hindLeft: {
    hip: [0.64, 0.87, 0.22],
    stifle: [0.66, 0.50, 0.26],
    fetlock: [0.64, 0.17, 0.17],
    hoof: [0.64, 0.0, 0.15],
  },
  hindRight: {
    hip: [0.36, 0.87, 0.22],
    stifle: [0.34, 0.50, 0.26],
    fetlock: [0.36, 0.17, 0.17],
    hoof: [0.36, 0.0, 0.15],
  },
};

const SPINE_POINTS_NORM: [number, number, number][] = [
  [0.5, 0.95, 0.85], // poll
  [0.5, 0.92, 0.78], // throat
  [0.5, 0.88, 0.69], // withers
  [0.5, 0.85, 0.55], // back
  [0.5, 0.84, 0.42], // loin
  [0.5, 0.85, 0.30], // croup
  [0.5, 0.82, 0.22], // dock
  [0.5, 0.70, 0.12], // tail
];

const LEG_KEYS = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;

function mapToWorld(norm: [number, number, number], bbox: THREE.Box3): [number, number, number] {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  return [
    bbox.min.x + norm[0] * size.x,
    bbox.min.y + norm[1] * size.y,
    bbox.min.z + norm[2] * size.z,
  ];
}

const DEFAULT_BBOX = new THREE.Box3(
  new THREE.Vector3(-0.2, 0, -0.45),
  new THREE.Vector3(0.2, 0.65, 0.5),
);

/* ═══════════════════════════════════════════════════════════════
   GLB Horse Model with COM oscillation + Foot-Lock
   ═══════════════════════════════════════════════════════════════ */
function HorseModel({ isPlaying, speed, phaseRef, onBBoxReady, gaitType }: {
  isPlaying: boolean; speed: number;
  phaseRef: React.MutableRefObject<number>;
  onBBoxReady?: (bbox: THREE.Box3) => void;
  gaitType: string;
}) {
  const { scene, animations } = useGLTF("/models/Horse.glb");
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const clipDurationRef = useRef(1);
  const bboxEmitted = useRef(false);
  const modelRef = useRef<THREE.Group>(null);
  const bboxLocalRef = useRef<THREE.Box3 | null>(null);
  const footLockRef = useRef<RootFootLock | null>(null);
  const legChainsRef = useRef<LegBoneChain[]>([]);
  const _flTmpLocal = useRef(new THREE.Vector3()).current;
  const gaitTypeRef = useRef(gaitType);
  gaitTypeRef.current = gaitType;

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

  // Discover leg bones
  useEffect(() => {
    legChainsRef.current = discoverLegBones(scene);
  }, [scene]);

  useEffect(() => {
    const action = actionRef.current;
    if (!action) return;
    action.paused = !isPlaying;
    action.timeScale = speed;
  }, [isPlaying, speed]);

  // Reset foot-lock on gait change
  useEffect(() => {
    footLockRef.current?.reset();
  }, [gaitType]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    const action = actionRef.current;
    if (!mixer || !action) return;
    if (isPlaying) mixer.update(delta);
    const dur = clipDurationRef.current;
    phaseRef.current = ((action.time % dur) + dur) % dur / dur;

    // Procedural leg animation
    if (legChainsRef.current.length > 0) {
      applyProceduralLegs(legChainsRef.current, phaseRef.current, gaitTypeRef.current, 0.7);
    }

    if (modelRef.current) {
      const com = computeBodyCOM(phaseRef.current, gaitType);
      modelRef.current.position.set(com.lateralShift, -0.01 + com.verticalShift, com.forwardShift);
      modelRef.current.rotation.set(com.pitchRad, Math.PI / 2, com.rollRad);
    }

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
          opacity: 0.92,
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
    const bbox = new THREE.Box3().setFromObject(tempObj);
    onBBoxReady(bbox);
    bboxLocalRef.current = bbox;

    footLockRef.current = new RootFootLock(
      (foot: FootKey, out: THREE.Vector3) => {
        const b = bboxLocalRef.current;
        const g = modelRef.current;
        if (!b || !g) return out;
        const norm = JOINT_POSITIONS_NORM[foot]?.hoof;
        if (!norm) return out;
        normToModelLocal(norm, b, _flTmpLocal);
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
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Biomechanical Skeleton Overlay (auto-calibrated to GLB bbox)
   ═══════════════════════════════════════════════════════════════ */
const TRAIL_LENGTH = 20;

function HoofTrail({ legKey, color, poseRef }: {
  legKey: string; color: string;
  poseRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const bufferRef = useRef<THREE.Vector3[]>([]);
  const lineObj = useMemo(() => {
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setDrawRange(0, 0);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }));
  }, [color]);

  useFrame(() => {
    const hoofPos = poseRef.current.get(`${legKey}.hoof`);
    if (!hoofPos) return;
    const buf = bufferRef.current;
    buf.push(hoofPos.clone());
    if (buf.length > TRAIL_LENGTH) buf.shift();
    const posAttr = lineObj.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < buf.length; i++) posAttr.setXYZ(i, buf[i].x, buf[i].y, buf[i].z);
    posAttr.needsUpdate = true;
    lineObj.geometry.setDrawRange(0, buf.length);
  });

  return <primitive object={lineObj} />;
}

function SkeletonOverlay({ phaseRef, poseRef, gaitType, bbox }: {
  phaseRef: React.MutableRefObject<number>;
  poseRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
  gaitType: string;
  bbox: THREE.Box3;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const markerRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const lineRefs = useRef<Map<string, THREE.Line>>(new Map());
  const spineRefs = useRef<THREE.Mesh[]>([]);
  const spineLineRefs = useRef<THREE.Line[]>([]);
  const contactRingRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  const offsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const headBobAmp = useMemo(() => getHeadBobAmplitude(gaitType), [gaitType]);
  const stanceDuty = useMemo(() => getStanceDuty(gaitType), [gaitType]);

  const jointPositions = useMemo(() => {
    const result: Record<string, Record<string, [number, number, number]>> = {};
    for (const [leg, joints] of Object.entries(JOINT_POSITIONS_NORM)) {
      result[leg] = {};
      for (const [joint, norm] of Object.entries(joints)) {
        result[leg][joint] = mapToWorld(norm, bbox);
      }
    }
    return result;
  }, [bbox]);

  const spinePoints = useMemo(() => SPINE_POINTS_NORM.map((norm) => mapToWorld(norm, bbox)), [bbox]);

  useFrame(() => {
    if (!groupRef.current) return;
    const phase = phaseRef.current;
    const computedPositions: Map<string, THREE.Vector3> = new Map();
    const com = computeBodyCOM(phase, gaitType);

    for (const [leg, joints] of Object.entries(jointPositions)) {
      const offset = offsets[leg] ?? 0;
      const legPhase = (phase + offset) % 1;
      const disp = compute3DDisplacement(legPhase, gaitType, leg);
      const isStance = legPhase < stanceDuty;

      const jointFactors: Record<string, { lift: number; swing: number; lateral: number; lagPhase: number }> = {
        shoulder: { lift: 0.03, swing: 0.02, lateral: 0.3, lagPhase: 0 },
        hip: { lift: 0.03, swing: 0.02, lateral: 0.3, lagPhase: 0 },
        carpus: { lift: 0.25, swing: 0.2, lateral: 0.6, lagPhase: 0.06 },
        stifle: { lift: 0.25, swing: 0.2, lateral: 0.6, lagPhase: 0.06 },
        fetlock: { lift: 0.7, swing: 0.65, lateral: 0.8, lagPhase: 0.12 },
        hoof: { lift: 1.0, swing: 1.0, lateral: 1.0, lagPhase: 0.18 },
      };

      for (const [joint, basePos] of Object.entries(joints)) {
        const key = `${leg}.${joint}`;
        const mesh = markerRefs.current.get(key);
        const factors = jointFactors[joint] ?? { lift: 0.5, swing: 0.5, lateral: 0.5, lagPhase: 0.1 };

        const laggedPhase = (legPhase - factors.lagPhase * disp.jointLag + 1) % 1;
        const laggedDisp = factors.lagPhase > 0 && disp.jointLag > 0.1
          ? compute3DDisplacement(laggedPhase, gaitType, leg)
          : disp;

        const x = basePos[0] + laggedDisp.lateralX * factors.lateral + com.lateralShift;
        const y = basePos[1] + laggedDisp.liftY * factors.lift + com.verticalShift;
        const z = basePos[2] + laggedDisp.swingZ * factors.swing + laggedDisp.overstrideZ * factors.swing;

        if (mesh) mesh.position.set(x, y, z);
        computedPositions.set(key, new THREE.Vector3(x, y, z));

        if (joint === "hoof") {
          const ring = contactRingRefs.current.get(leg);
          if (ring) {
            ring.visible = isStance;
            if (isStance) {
              ring.position.set(x, 0.001, z);
              const stanceT = legPhase / stanceDuty;
              const pressure = Math.sin(stanceT * Math.PI);
              (ring.material as THREE.MeshStandardMaterial).opacity = pressure * 0.6;
              ring.scale.setScalar(0.8 + pressure * 0.4);
            }
          }
        }
      }
    }

    // Skeleton lines
    for (const [leg] of Object.entries(jointPositions)) {
      const connections = LEG_CONNECTIONS[leg];
      for (let i = 1; i < connections.length; i++) {
        const prevKey = `${leg}.${connections[i - 1]}`;
        const curKey = `${leg}.${connections[i]}`;
        const line = lineRefs.current.get(`${prevKey}-${curKey}`);
        if (!line) continue;
        const startPos = computedPositions.get(prevKey);
        const endPos = computedPositions.get(curKey);
        if (!startPos || !endPos) continue;
        const posAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        posAttr.setXYZ(0, startPos.x, startPos.y, startPos.z);
        posAttr.setXYZ(1, endPos.x, endPos.y, endPos.z);
        posAttr.needsUpdate = true;
      }
    }

    // Spine dynamics
    if (spineRefs.current.length > 0) {
      const spPos: THREE.Vector3[] = [];
      for (let i = 0; i < spinePoints.length; i++) {
        const mesh = spineRefs.current[i];
        if (!mesh) continue;
        const base = spinePoints[i];
        const headFactor = i <= 1 ? (1 - i * 0.4) : 0;
        const headBob = Math.sin(phase * Math.PI * 4 + 0.3) * headBobAmp * headFactor;
        const wavePhase = phase * Math.PI * 2 - i * 0.5;
        const bodyWave = Math.sin(wavePhase) * 0.004;
        const latCurve = i < 4
          ? Math.sin(phase * Math.PI * 2) * 0.008 * (i / 4)
          : Math.sin(phase * Math.PI * 2 + Math.PI) * 0.012 * ((i - 4) / 4);
        const pelvisBob = i >= 6 ? com.verticalShift * 1.2 : com.verticalShift * 0.3;

        mesh.position.set(
          base[0] + latCurve + com.lateralShift,
          base[1] + headBob + bodyWave + pelvisBob,
          base[2],
        );
        spPos.push(mesh.position.clone());
      }
      for (let i = 0; i < spineLineRefs.current.length; i++) {
        const line = spineLineRefs.current[i];
        if (!line || !spPos[i] || !spPos[i + 1]) continue;
        const posAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        posAttr.setXYZ(0, spPos[i].x, spPos[i].y, spPos[i].z);
        posAttr.setXYZ(1, spPos[i + 1].x, spPos[i + 1].y, spPos[i + 1].z);
        posAttr.needsUpdate = true;
      }
    }

    // Write to Pose Bus
    poseRef.current.clear();
    for (const [k, v] of computedPositions.entries()) poseRef.current.set(k, v);
  });

  const setMarkerRef = useCallback((key: string) => (el: THREE.Mesh | null) => {
    if (el) markerRefs.current.set(key, el);
    else markerRefs.current.delete(key);
  }, []);

  const setLineRef = useCallback((key: string) => (el: any) => {
    if (el) lineRefs.current.set(key, el);
    else lineRefs.current.delete(key);
  }, []);

  const makeLine = useCallback((color: string) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
  }, []);

  const makeSpineLine = useCallback(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#64748b", linewidth: 2 }));
  }, []);

  return (
    <group ref={groupRef}>
      {/* Joint markers + skeleton lines */}
      {Object.entries(jointPositions).map(([leg, joints]) => {
        const color = LEG_COLORS[leg];
        const connections = LEG_CONNECTIONS[leg];
        return (
          <group key={leg}>
            {Object.entries(joints).map(([joint, pos]) => (
              <mesh key={`${leg}.${joint}`} ref={setMarkerRef(`${leg}.${joint}`)} position={pos}>
                <sphereGeometry args={[0.02, 12, 12]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.4}
                  roughness={0.3}
                />
              </mesh>
            ))}
            {connections.slice(1).map((joint, i) => {
              const prevJoint = connections[i];
              const lineKey = `${leg}.${prevJoint}-${leg}.${joint}`;
              return <primitive key={lineKey} ref={setLineRef(lineKey)} object={makeLine(color)} />;
            })}
          </group>
        );
      })}

      {/* Hoof trails */}
      {LEG_KEYS.map((leg) => (
        <HoofTrail key={`trail-${leg}`} legKey={leg} color={LEG_COLORS[leg]} poseRef={poseRef} />
      ))}

      {/* Ground contact rings */}
      {Object.entries(LEG_COLORS).map(([leg, color]) => (
        <mesh
          key={`contact-${leg}`}
          ref={(el) => { if (el) contactRingRefs.current.set(leg, el); }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, 0]}
          visible={false}
        >
          <ringGeometry args={[0.02, 0.04, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Spine */}
      {spinePoints.map((pos, i) => (
        <mesh key={`spine-${i}`} ref={(el) => { if (el) spineRefs.current[i] = el; }} position={pos}>
          <sphereGeometry args={[i === 0 ? 0.025 : 0.015, 10, 10]} />
          <meshStandardMaterial
            color={i === 0 ? "#f59e0b" : "#94a3b8"}
            emissive={i === 0 ? "#f59e0b" : "#64748b"}
            emissiveIntensity={0.3}
            roughness={0.4}
          />
        </mesh>
      ))}
      {spinePoints.slice(1).map((_, i) => (
        <primitive
          key={`spine-line-${i}`}
          ref={(el: any) => { if (el) spineLineRefs.current[i] = el; }}
          object={makeSpineLine()}
        />
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Beat Phase HUD (for 4-beat gaits)
   ═══════════════════════════════════════════════════════════════ */
function BeatPhaseHUD({ phaseRef, gaitType }: { phaseRef: React.MutableRefObject<number>; gaitType: string }) {
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const beatCounterRef = useRef<HTMLSpanElement>(null);
  const stanceBarRefs = useRef<(HTMLDivElement | null)[]>([]);

  const meta = useMemo(() => getGaitMeta(gaitType), [gaitType]);
  const offsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const stanceDuty = useMemo(() => getStanceDuty(gaitType), [gaitType]);
  const legOrder = useMemo(() => {
    return Object.entries(offsets)
      .sort((a, b) => a[1] - b[1])
      .map(([key, offset]) => ({ key, offset, color: LEG_COLORS[key], label: LEG_LABELS_SHORT[key] }));
  }, [offsets]);

  const lastBeatRef = useRef(-1);

  useFrame(() => {
    const phase = phaseRef.current;
    if (barRef.current) barRef.current.style.width = `${phase * 100}%`;

    let currentBeat = 0;
    legOrder.forEach((leg, i) => {
      const legPhase = (phase + leg.offset) % 1;
      const isStance = legPhase < stanceDuty;
      const dot = dotRefs.current[i];
      const stanceBar = stanceBarRefs.current[i];

      if (dot) {
        dot.style.transform = isStance ? "scale(1.4)" : "scale(0.8)";
        dot.style.opacity = isStance ? "1" : "0.4";
        dot.style.boxShadow = isStance ? `0 0 8px ${leg.color}` : "none";
      }
      if (stanceBar) {
        const progress = isStance ? (legPhase / stanceDuty) * 100 : 0;
        stanceBar.style.width = `${progress}%`;
        stanceBar.style.backgroundColor = isStance ? leg.color : "transparent";
        stanceBar.style.opacity = isStance ? "0.8" : "0";
      }
      if (isStance && legPhase < 0.05) currentBeat = i + 1;
    });

    if (beatCounterRef.current && currentBeat > 0 && currentBeat !== lastBeatRef.current) {
      lastBeatRef.current = currentBeat;
      beatCounterRef.current.textContent = String(currentBeat);
      beatCounterRef.current.style.transform = "scale(1.6)";
      beatCounterRef.current.style.opacity = "1";
      setTimeout(() => {
        if (beatCounterRef.current) {
          beatCounterRef.current.style.transform = "scale(1)";
          beatCounterRef.current.style.opacity = "0.7";
        }
      }, 120);
    }
  });

  if (!meta || meta.beats < 4) return null;

  return (
    <Html position={[0, -0.15, 0]} center style={{ pointerEvents: "none", width: "300px" }}>
      <div className="flex flex-col items-center gap-1.5 select-none" style={{ fontFamily: "system-ui" }}>
        <div className="flex items-center gap-2 mb-0.5">
          <span
            ref={beatCounterRef}
            style={{
              fontSize: 18, fontWeight: 800, fontFamily: "monospace",
              color: "hsl(var(--primary))",
              transition: "transform 0.12s ease-out, opacity 0.12s ease-out",
              opacity: 0.7, minWidth: 20, textAlign: "center",
            }}
          >1</span>
          <span style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1 }}>/ {meta.beats} BEATS</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(100,116,139,0.3)" }}>
          <div ref={barRef} className="h-full rounded-full transition-none" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))", width: "0%" }} />
        </div>
        <div className="flex gap-3 mt-0.5">
          {legOrder.map((leg, i) => (
            <div key={leg.key} className="flex flex-col items-center gap-0.5" style={{ minWidth: 40 }}>
              <div
                ref={(el) => { dotRefs.current[i] = el; }}
                className="rounded-full"
                style={{ width: 14, height: 14, backgroundColor: leg.color, opacity: 0.4, transition: "transform 0.1s, opacity 0.1s, box-shadow 0.2s" }}
              />
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(100,116,139,0.15)" }}>
                <div ref={(el) => { stanceBarRefs.current[i] = el; }} className="h-full rounded-full transition-none" style={{ width: "0%" }} />
              </div>
              <span style={{ fontSize: 8, color: "#94a3b8" }}>{leg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Html>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Scene — Brings everything together
   ═══════════════════════════════════════════════════════════════ */
function HeroScene({ gaitType, speed, isPlaying }: {
  gaitType: string; speed: number; isPlaying: boolean;
}) {
  const phaseRef = useRef(0);
  const poseRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const [bbox, setBBox] = useState<THREE.Box3>(DEFAULT_BBOX);
  const handleBBox = useCallback((b: THREE.Box3) => setBBox(b), []);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0002}>
        <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -2, 0.1, 20]} />
      </directionalLight>
      <directionalLight position={[-3, 4, -2]} intensity={0.3} color="#b0c4de" />
      <directionalLight position={[0, 2, -4]} intensity={0.2} color="#ffd4a0" />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <shadowMaterial transparent opacity={0.35} />
      </mesh>
      <gridHelper args={[3, 16, "#333366", "#222244"]} position={[0, 0, 0]} />

      <HorseModel isPlaying={isPlaying} speed={speed} phaseRef={phaseRef} onBBoxReady={handleBBox} gaitType={gaitType} />
      <SkeletonOverlay phaseRef={phaseRef} poseRef={poseRef} gaitType={gaitType} bbox={bbox} />
      <BeatPhaseHUD phaseRef={phaseRef} gaitType={gaitType} />

      <OrbitControls
        enablePan={false} enableZoom enableRotate
        autoRotate={false}
        minDistance={0.5} maxDistance={4}
        target={[0, 0.3, 0]}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.65}
      />
    </>
  );
}

function LoadingBox() {
  return (
    <mesh>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════════
   Main Export — GLB-Based Biomechanical Hero Animation
   ═══════════════════════════════════════════════════════════════ */
export default memo(function HorseHeroAnimation() {
  const [gaitType, setGaitType] = useState("singlefoot");
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [webglSupported, setWebglSupported] = useState(true);
  const [canvasError, setCanvasError] = useState(false);

  useEffect(() => { setWebglSupported(hasWebGL()); }, []);

  const meta = useMemo(() => getGaitMeta(gaitType), [gaitType]);

  const legLegend = [
    { label: "קד-ש", color: LEG_COLORS.frontLeft },
    { label: "קד-י", color: LEG_COLORS.frontRight },
    { label: "אח-ש", color: LEG_COLORS.hindLeft },
    { label: "אח-י", color: LEG_COLORS.hindRight },
  ];

  if (!webglSupported || canvasError) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-muted/20" style={{ height: "500px" }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2 p-6">
            <p className="text-lg font-semibold text-foreground">🐎 ויזואליזציה ביומכנית 3D</p>
            <p className="text-sm text-muted-foreground">הדפדפן לא תומך ב-WebGL. נסו Chrome או Firefox.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 border border-border/30 rounded-full px-3 py-1">
          🐎 תנועת סוס בזמן אמת — מודל תלת-ממדי + שלד ביומכני מונפש
        </span>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-[#0a0a1a]" style={{ height: "500px" }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [1.8, 0.9, 1.2], fov: 42 }}
          shadows
          onError={() => setCanvasError(true)}
        >
          <Suspense fallback={<LoadingBox />}>
            <HeroScene gaitType={gaitType} speed={speed} isPlaying={isPlaying} />
          </Suspense>
        </Canvas>

        {/* Leg color legend */}
        <div className="absolute top-3 right-3 flex gap-2 pointer-events-none">
          {legLegend.map((l) => (
            <div key={l.label} className="flex items-center gap-1 bg-background/70 backdrop-blur-sm rounded-md px-2 py-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-[10px] text-foreground/70">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex gap-1.5 pointer-events-auto flex-wrap">
            {GAIT_OPTIONS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGaitType(g.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  gaitType === g.key
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-background/80 text-foreground/70 hover:bg-background border border-border/50 backdrop-blur-sm"
                }`}
              >
                {g.labelHe}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex gap-1 bg-background/80 backdrop-blur-sm rounded-full border border-border/50 p-0.5">
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                    speed === s
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ×{s}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {meta && (
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{meta.nameHe}</span>
            {" — "}
            {meta.description}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {meta.beats} פעימות · {meta.hasSuspension ? "עם ריחוף" : "ללא ריחוף"} ·
            {meta.tendency === "lateral" ? " לטרלי" : meta.tendency === "diagonal" ? " אלכסוני" : " שווה"}
            {meta.footfallOrder && ` · סדר: ${meta.footfallOrder.join(" → ")}`}
          </p>
        </div>
      )}
    </div>
  );
});

useGLTF.preload("/models/Horse.glb");
