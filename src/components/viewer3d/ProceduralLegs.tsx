/**
 * ProceduralLegs — Visible animated leg geometry as a fallback
 * when the GLB model has no usable skeleton bones.
 * Renders 4 legs as segmented cylinders that swing according to gait phase.
 */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getPhaseOffsetsForGait, getStanceDuty, getGaitMeta } from "@/lib/gaitCalculations";

interface ProceduralLegsProps {
  phaseRef: React.MutableRefObject<number>;
  gaitType?: string;
  bbox: THREE.Box3;
}

interface LegConfig {
  key: string;
  /** Attachment point on the body (in world-ish coords) */
  origin: THREE.Vector3;
  upperLen: number;
  lowerLen: number;
  hoofLen: number;
  isHind: boolean;
  color: string;
}

/** Smooth Hermite */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function computeLegAngles(
  legPhase: number,
  stanceDuty: number,
  isHind: boolean,
  gaitType?: string,
): { hip: number; knee: number; fetlock: number } {
  const p = ((legPhase % 1) + 1) % 1;
  const meta = getGaitMeta(gaitType);
  const isFourBeat = meta?.beats === 4;
  
  // Amplitudes — bigger for visibility
  const hipAmp = isHind ? 0.35 : 0.30;
  const kneeAmp = isHind ? 0.50 : 0.45;
  const fetlockAmp = 0.25;

  if (p < stanceDuty) {
    // STANCE: leg pushes back, slight knee flex at mid-stance
    const t = p / stanceDuty;
    const retract = smoothstep(t);
    return {
      hip: hipAmp * 0.4 * (0.5 - retract),
      knee: -0.08 * Math.sin(t * Math.PI),
      fetlock: 0.06 * Math.sin(t * Math.PI),
    };
  } else {
    // SWING: leg lifts and swings forward
    const swingDur = 1 - stanceDuty;
    const t = (p - stanceDuty) / swingDur;

    // Hip: retracted → protracted
    const hipAngle = -hipAmp * 0.3 + hipAmp * smoothstep(Math.min(t * 1.3, 1));

    // Knee: flexes up in a D-arc
    let kneeFlex: number;
    if (t < 0.15) {
      kneeFlex = smoothstep(t / 0.15);
    } else if (t < 0.5) {
      kneeFlex = 1.0;
    } else {
      kneeFlex = 1.0 - smoothstep((t - 0.5) / 0.5);
    }
    const kneeAngle = -kneeAmp * kneeFlex;

    // Fetlock: curls up then extends for landing
    let fetlockCurl: number;
    if (t < 0.4) {
      fetlockCurl = smoothstep(t / 0.4);
    } else if (t < 0.7) {
      fetlockCurl = 1.0;
    } else {
      fetlockCurl = 1.0 - smoothstep((t - 0.7) / 0.3);
    }
    const fetlockAngle = fetlockAmp * fetlockCurl;

    return { hip: hipAngle, knee: kneeAngle, fetlock: fetlockAngle };
  }
}

/** A single animated leg made of 3 cylinders */
function AnimatedLeg({ 
  config, phaseRef, gaitType, offsets, stanceDuty 
}: { 
  config: LegConfig; 
  phaseRef: React.MutableRefObject<number>;
  gaitType?: string;
  offsets: Record<string, number>;
  stanceDuty: number;
}) {
  const upperRef = useRef<THREE.Group>(null);
  const lowerRef = useRef<THREE.Group>(null);
  const hoofRef = useRef<THREE.Group>(null);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.color),
    roughness: 0.6,
    metalness: 0.1,
  }), [config.color]);

  useFrame(() => {
    if (!upperRef.current || !lowerRef.current) return;
    
    const offset = offsets[config.key] ?? 0;
    const legPhase = ((phaseRef.current + offset) % 1 + 1) % 1;
    const angles = computeLegAngles(legPhase, stanceDuty, config.isHind, gaitType);
    
    // Rotate upper leg around X axis (sagittal plane)
    upperRef.current.rotation.x = angles.hip;
    
    // Lower leg rotates relative to upper
    lowerRef.current.rotation.x = angles.knee;
    
    // Hoof rotates relative to lower
    if (hoofRef.current) {
      hoofRef.current.rotation.x = angles.fetlock;
    }
  });

  const radius = 0.012;

  return (
    <group position={config.origin}>
      {/* Upper leg segment */}
      <group ref={upperRef}>
        <mesh position={[0, -config.upperLen / 2, 0]} material={material}>
          <cylinderGeometry args={[radius * 1.2, radius, config.upperLen, 6]} />
        </mesh>
        
        {/* Lower leg segment - positioned at end of upper */}
        <group position={[0, -config.upperLen, 0]} ref={lowerRef}>
          <mesh position={[0, -config.lowerLen / 2, 0]} material={material}>
            <cylinderGeometry args={[radius, radius * 0.8, config.lowerLen, 6]} />
          </mesh>
          
          {/* Hoof segment - positioned at end of lower */}
          <group position={[0, -config.lowerLen, 0]} ref={hoofRef}>
            <mesh position={[0, -config.hoofLen / 2, 0]} material={material}>
              <cylinderGeometry args={[radius * 0.8, radius * 1.3, config.hoofLen, 6]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function ProceduralLegs({ phaseRef, gaitType, bbox }: ProceduralLegsProps) {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  const offsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const stanceDuty = useMemo(() => getStanceDuty(gaitType), [gaitType]);

  // Position legs at the 4 corners of the body
  const bodyTop = bbox.max.y * 0.85;
  const legLength = bodyTop - bbox.min.y;
  const upperLen = legLength * 0.42;
  const lowerLen = legLength * 0.35;
  const hoofLen = legLength * 0.15;

  const frontZ = bbox.min.z + size.z * 0.75;
  const hindZ = bbox.min.z + size.z * 0.22;
  const leftX = center.x + size.x * 0.18;
  const rightX = center.x - size.x * 0.18;

  const legs: LegConfig[] = [
    { key: "frontLeft", origin: new THREE.Vector3(leftX, bodyTop, frontZ), upperLen, lowerLen, hoofLen, isHind: false, color: "#3b82f6" },
    { key: "frontRight", origin: new THREE.Vector3(rightX, bodyTop, frontZ), upperLen, lowerLen, hoofLen, isHind: false, color: "#22c55e" },
    { key: "hindLeft", origin: new THREE.Vector3(leftX, bodyTop, hindZ), upperLen, lowerLen, hoofLen, isHind: true, color: "#f59e0b" },
    { key: "hindRight", origin: new THREE.Vector3(rightX, bodyTop, hindZ), upperLen, lowerLen, hoofLen, isHind: true, color: "#ef4444" },
  ];

  return (
    <group>
      {legs.map((leg) => (
        <AnimatedLeg
          key={leg.key}
          config={leg}
          phaseRef={phaseRef}
          gaitType={gaitType}
          offsets={offsets}
          stanceDuty={stanceDuty}
        />
      ))}
    </group>
  );
}
