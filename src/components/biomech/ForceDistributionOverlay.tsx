import { useRef, useMemo, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  legKey: "frontLeft" | "frontRight" | "hindLeft" | "hindRight";
  phaseRef: React.MutableRefObject<number>;
  poseRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
  offsets: Record<string, number>;
  stanceDuty: number;
}

function grfMagnitude(legPhase: number, stanceDuty: number): number {
  if (legPhase > stanceDuty) return 0;
  const stanceT = legPhase / stanceDuty;
  return Math.sin(stanceT * Math.PI) * 0.8 + Math.sin(stanceT * Math.PI * 2) * 0.15;
}

/* ─── Single Force Arrow — reads hoof position from poseRef (Pose Bus) ─── */
export default memo(function ForceDistributionOverlay({ legKey, phaseRef, poseRef, offsets, stanceDuty }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const cylRef = useRef<THREE.Mesh>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const colorGreen = useMemo(() => new THREE.Color(0.2, 0.8, 0.4), []);
  const colorYellow = useMemo(() => new THREE.Color(1, 0.8, 0.2), []);
  const colorRed = useMemo(() => new THREE.Color(1, 0.2, 0.2), []);

  useFrame(() => {
    if (!groupRef.current || !cylRef.current || !coneRef.current || !ringRef.current) return;

    const phase = phaseRef.current;
    const legPhase = (phase + (offsets[legKey] ?? 0)) % 1;
    const mag = grfMagnitude(legPhase, stanceDuty);

    if (mag < 0.05) {
      groupRef.current.visible = false;
      return;
    }

    // Patch 3: Read actual hoof position from Pose Bus
    const hoofKey = `${legKey}.hoof`;
    const hoofPos = poseRef.current.get(hoofKey);

    if (!hoofPos) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    const height = mag * 0.5;
    const color = mag > 0.7 ? colorRed : mag > 0.4 ? colorYellow : colorGreen;

    const baseX = hoofPos.x;
    const baseZ = hoofPos.z;
    const baseY = 0.0; // ground plane

    // Cylinder (shaft)
    cylRef.current.position.set(baseX, baseY + height / 2, baseZ);
    cylRef.current.scale.set(1, height / 0.5, 1);
    const cylMat = cylRef.current.material as THREE.MeshStandardMaterial;
    cylMat.color.copy(color);
    cylMat.emissive.copy(color);

    // Cone (arrowhead)
    coneRef.current.position.set(baseX, baseY + height + 0.02, baseZ);
    const coneMat = coneRef.current.material as THREE.MeshStandardMaterial;
    coneMat.color.copy(color);
    coneMat.emissive.copy(color);

    // Ring (ground contact indicator)
    ringRef.current.position.set(baseX, baseY + 0.001, baseZ);
    const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
    ringMat.color.copy(color);
  });

  return (
    <group ref={groupRef}>
      <mesh ref={cylRef}>
        <cylinderGeometry args={[0.008, 0.015, 0.5, 8]} />
        <meshStandardMaterial transparent opacity={0.8} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={coneRef}>
        <coneGeometry args={[0.025, 0.05, 8]} />
        <meshStandardMaterial emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.02, 0.04, 16]} />
        <meshStandardMaterial transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
});
