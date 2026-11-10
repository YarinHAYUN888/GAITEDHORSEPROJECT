// BiomechanicalSkeleton — animated skeleton overlay auto-calibrated to GLB bbox

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  NORMAL_RANGES, LEG_CONNECTIONS, LEG_COLORS,
  jointDeviation, heatColorRGB, getPhaseOffsetsForGait,
  computeBodyCOM, getHeadBobAmplitude, getStanceDuty, compute3DDisplacement,
} from "@/lib/gaitCalculations";
import { JOINT_POSITIONS_NORM, SPINE_POINTS_NORM, mapToWorld, LEG_KEYS } from "./constants";
import HoofTrail from "./HoofTrail";

/* Floating label for a problematic joint */
function JointLabel({ jointKey, deviation, value, poseRef }: {
  jointKey: string; deviation: number; value: number;
  poseRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = poseRef.current.get(jointKey);
    if (pos) {
      groupRef.current.position.set(pos.x, pos.y + 0.06, pos.z);
      groupRef.current.visible = true;
    } else {
      groupRef.current.visible = false;
    }
  });

  const isHigh = deviation > 0.6;
  const bgColor = isHigh ? "rgba(239,68,68,0.85)" : "rgba(234,179,8,0.85)";
  const jointName = jointKey.split(".")[1] ?? "";

  return (
    <group ref={groupRef}>
      <Html center style={{ pointerEvents: "none" }}>
        <div
          className="rounded px-1.5 py-0.5 text-white font-bold shadow-lg select-none"
          style={{ fontSize: 9, background: bgColor, whiteSpace: "nowrap", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          {jointName} {Math.round(value)}°
        </div>
      </Html>
    </group>
  );
}

interface BiomechanicalSkeletonProps {
  jointAngles?: Record<string, Record<string, number>>;
  showHeatmap: boolean;
  showSkeleton: boolean;
  showTopline: boolean;
  showTrails: boolean;
  phaseRef: React.MutableRefObject<number>;
  poseRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
  gaitType?: string;
  bbox: THREE.Box3;
}

export default function BiomechanicalSkeleton({
  jointAngles, showHeatmap, showSkeleton, showTopline, showTrails,
  phaseRef, poseRef, gaitType, bbox,
}: BiomechanicalSkeletonProps) {
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

  const problematicJoints = useMemo(() => {
    if (!jointAngles || typeof jointAngles !== "object") return [];
    const results: { key: string; deviation: number; value: number }[] = [];
    for (const [leg, joints] of Object.entries(jointAngles)) {
      if (!joints || typeof joints !== "object") continue;
      for (const [joint, value] of Object.entries(joints)) {
        const range = NORMAL_RANGES[joint];
        if (!range) continue;
        const dev = jointDeviation(value, range);
        if (dev > 0.3) results.push({ key: `${leg}.${joint}`, deviation: dev, value });
      }
    }
    return results;
  }, [jointAngles]);

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
        hip:      { lift: 0.03, swing: 0.02, lateral: 0.3, lagPhase: 0 },
        carpus:   { lift: 0.25, swing: 0.2, lateral: 0.6, lagPhase: 0.06 },
        stifle:   { lift: 0.25, swing: 0.2, lateral: 0.6, lagPhase: 0.06 },
        fetlock:  { lift: 0.7, swing: 0.65, lateral: 0.8, lagPhase: 0.12 },
        hoof:     { lift: 1.0, swing: 1.0, lateral: 1.0, lagPhase: 0.18 },
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
              const ringMat = ring.material as THREE.MeshStandardMaterial;
              const stanceT = legPhase / stanceDuty;
              const pressure = Math.sin(stanceT * Math.PI);
              ringMat.opacity = pressure * 0.6;
              ring.scale.setScalar(0.8 + pressure * 0.4);
            }
          }
        }
      }
    }

    if (showSkeleton) {
      for (const [leg] of Object.entries(jointPositions)) {
        const connections = LEG_CONNECTIONS[leg];
        for (let i = 1; i < connections.length; i++) {
          const prevKey = `${leg}.${connections[i - 1]}`;
          const curKey = `${leg}.${connections[i]}`;
          const lineKey = `${prevKey}-${curKey}`;
          const line = lineRefs.current.get(lineKey);
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
    }

    if (showTopline && spineRefs.current.length > 0) {
      const spinePositions: THREE.Vector3[] = [];
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

        mesh.position.set(base[0] + latCurve + com.lateralShift, base[1] + headBob + bodyWave + pelvisBob, base[2]);
        spinePositions.push(mesh.position.clone());
      }
      for (let i = 0; i < spineLineRefs.current.length; i++) {
        const line = spineLineRefs.current[i];
        if (!line || !spinePositions[i] || !spinePositions[i + 1]) continue;
        const posAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        posAttr.setXYZ(0, spinePositions[i].x, spinePositions[i].y, spinePositions[i].z);
        posAttr.setXYZ(1, spinePositions[i + 1].x, spinePositions[i + 1].y, spinePositions[i + 1].z);
        posAttr.needsUpdate = true;
      }
    }

    if (poseRef?.current) {
      const out = poseRef.current;
      out.clear();
      for (const [k, v] of computedPositions.entries()) out.set(k, v);
    }
  });

  const getDeviation = (leg: string, joint: string): number => {
    if (!jointAngles || typeof jointAngles !== "object") return 0;
    if (!jointAngles[leg]?.[joint]) return 0;
    const range = NORMAL_RANGES[joint];
    if (!range) return 0;
    return jointDeviation(jointAngles[leg][joint], range);
  };

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

  if (!showSkeleton && !showHeatmap && !showTopline) return null;

  return (
    <group ref={groupRef}>
      {(showSkeleton || showHeatmap) && Object.entries(jointPositions).map(([leg, joints]) => {
        const color = LEG_COLORS[leg];
        const connections = LEG_CONNECTIONS[leg];
        return (
          <group key={leg}>
            {Object.entries(joints).map(([joint, pos]) => (
              <mesh key={`${leg}.${joint}`} ref={setMarkerRef(`${leg}.${joint}`)} position={pos}>
                <sphereGeometry args={[showHeatmap && getDeviation(leg, joint) > 0.3 ? 0.035 : 0.025, 16, 16]} />
                <meshStandardMaterial
                  color={showHeatmap ? new THREE.Color(...heatColorRGB(getDeviation(leg, joint))) : new THREE.Color(color)}
                  emissive={showHeatmap ? new THREE.Color(...heatColorRGB(getDeviation(leg, joint))) : new THREE.Color(color)}
                  emissiveIntensity={showHeatmap && getDeviation(leg, joint) > 0.3 ? 0.8 : 0.3}
                  roughness={0.3}
                />
              </mesh>
            ))}
            {showSkeleton && connections.slice(1).map((joint, i) => {
              const prevJoint = connections[i];
              const lineKey = `${leg}.${prevJoint}-${leg}.${joint}`;
              return <primitive key={lineKey} ref={setLineRef(lineKey)} object={makeLine(color)} />;
            })}
          </group>
        );
      })}

      {showTrails && LEG_KEYS.map((leg) => (
        <HoofTrail key={`trail-${leg}`} legKey={leg} color={LEG_COLORS[leg]} poseRef={poseRef} />
      ))}

      {showHeatmap && problematicJoints.map((pj) => (
        <JointLabel key={`label-${pj.key}`} jointKey={pj.key} deviation={pj.deviation} value={pj.value} poseRef={poseRef} />
      ))}

      {Object.entries(LEG_COLORS).map(([leg, color]) => (
        <mesh
          key={`contact-${leg}`}
          ref={(el) => { if (el) contactRingRefs.current.set(leg, el); }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, 0]}
          visible={false}
        >
          <ringGeometry args={[0.02, 0.045, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {showTopline && spinePoints.map((pos, i) => (
        <mesh key={`spine-${i}`} ref={(el) => { if (el) spineRefs.current[i] = el; }} position={pos}>
          <sphereGeometry args={[i === 0 ? 0.03 : 0.018, 12, 12]} />
          <meshStandardMaterial
            color={i === 0 ? "#f59e0b" : "#94a3b8"}
            emissive={i === 0 ? "#f59e0b" : "#64748b"}
            emissiveIntensity={0.3}
            roughness={0.4}
          />
        </mesh>
      ))}
      {showTopline && spinePoints.slice(1).map((_, i) => (
        <primitive
          key={`spine-line-${i}`}
          ref={(el: any) => { if (el) spineLineRefs.current[i] = el; }}
          object={makeSpineLine()}
        />
      ))}
    </group>
  );
}
