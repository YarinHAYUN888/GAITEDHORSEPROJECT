// HoofDust — particle burst when a hoof contacts the ground
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getPhaseOffsetsForGait, getStanceDuty } from "@/lib/gaitCalculations";
import { JOINT_POSITIONS_NORM, mapToWorld } from "./constants";

const PARTICLE_COUNT = 18;
const BURST_LIFE = 0.45; // seconds

interface HoofDustProps {
  phaseRef: React.MutableRefObject<number>;
  gaitType?: string;
  bbox: THREE.Box3;
}

interface BurstState {
  active: boolean;
  age: number;
  origin: THREE.Vector3;
}

export default function HoofDust({ phaseRef, gaitType, bbox }: HoofDustProps) {
  const legs = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;
  const prevStance = useRef<Record<string, boolean>>({});
  const burstsRef = useRef<BurstState[]>([]);

  // Pre-allocate geometry for all possible concurrent bursts (one per leg)
  const maxBursts = 8;
  const positions = useMemo(() => new Float32Array(maxBursts * PARTICLE_COUNT * 3), []);
  const opacities = useMemo(() => new Float32Array(maxBursts * PARTICLE_COUNT), []);
  const sizes = useMemo(() => new Float32Array(maxBursts * PARTICLE_COUNT), []);
  const velocities = useMemo(() => {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < maxBursts * PARTICLE_COUNT; i++) {
      v.push(new THREE.Vector3());
    }
    return v;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  const totalParticles = maxBursts * PARTICLE_COUNT;

  // Initialize positions off-screen
  useMemo(() => {
    for (let i = 0; i < totalParticles * 3; i++) positions[i] = 0;
    for (let i = 0; i < totalParticles; i++) { opacities[i] = 0; sizes[i] = 0; }
  }, [positions, opacities, sizes, totalParticles]);

  const gaitTypeRef = useRef(gaitType);
  gaitTypeRef.current = gaitType;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const phase = phaseRef.current;
    const offsets = getPhaseOffsetsForGait(gaitTypeRef.current);
    const duty = getStanceDuty(gaitTypeRef.current);

    // Detect stance onset per leg
    for (const leg of legs) {
      const legPhase = ((phase + (offsets[leg] ?? 0)) % 1 + 1) % 1;
      const inStance = legPhase < duty;
      const wasStance = prevStance.current[leg] ?? false;

      if (inStance && !wasStance) {
        // Hoof just hit ground — spawn burst
        const hoofNorm = JOINT_POSITIONS_NORM[leg]?.hoof;
        if (hoofNorm) {
          const [wx, wy, wz] = mapToWorld(hoofNorm, bbox);
          // Reuse an inactive burst or push new
          let burst = burstsRef.current.find(b => !b.active);
          if (!burst && burstsRef.current.length < maxBursts) {
            burst = { active: false, age: 0, origin: new THREE.Vector3() };
            burstsRef.current.push(burst);
          }
          if (burst) {
            burst.active = true;
            burst.age = 0;
            burst.origin.set(wx, wy + 0.01, wz);
            // Init velocities for this burst
            const idx = burstsRef.current.indexOf(burst);
            for (let p = 0; p < PARTICLE_COUNT; p++) {
              const gi = idx * PARTICLE_COUNT + p;
              const angle = Math.random() * Math.PI * 2;
              const speed = 0.15 + Math.random() * 0.35;
              velocities[gi].set(
                Math.cos(angle) * speed,
                0.1 + Math.random() * 0.25,
                Math.sin(angle) * speed
              );
              const pi3 = gi * 3;
              positions[pi3] = burst.origin.x;
              positions[pi3 + 1] = burst.origin.y;
              positions[pi3 + 2] = burst.origin.z;
            }
          }
        }
      }
      prevStance.current[leg] = inStance;
    }

    // Update active bursts
    for (let bi = 0; bi < burstsRef.current.length; bi++) {
      const burst = burstsRef.current[bi];
      if (!burst.active) {
        // Zero out particles for inactive burst
        for (let p = 0; p < PARTICLE_COUNT; p++) {
          const gi = bi * PARTICLE_COUNT + p;
          opacities[gi] = 0;
          sizes[gi] = 0;
        }
        continue;
      }
      burst.age += dt;
      if (burst.age > BURST_LIFE) {
        burst.active = false;
        continue;
      }
      const t = burst.age / BURST_LIFE;
      for (let p = 0; p < PARTICLE_COUNT; p++) {
        const gi = bi * PARTICLE_COUNT + p;
        const pi3 = gi * 3;
        const v = velocities[gi];
        positions[pi3] += v.x * dt;
        positions[pi3 + 1] += v.y * dt - 0.4 * dt * dt; // gravity
        positions[pi3 + 2] += v.z * dt;
        // Clamp to ground
        if (positions[pi3 + 1] < 0) {
          positions[pi3 + 1] = 0;
          v.y = 0;
          v.x *= 0.8;
          v.z *= 0.8;
        }
        opacities[gi] = Math.max(0, 1 - t * t) * 0.6;
        sizes[gi] = (0.012 + Math.random() * 0.005) * (1 + t * 0.5);
      }
    }

    // Push to GPU
    const pts = pointsRef.current;
    if (pts) {
      const geom = pts.geometry;
      geom.attributes.position.needsUpdate = true;
      geom.attributes.aOpacity.needsUpdate = true;
      geom.attributes.aSize.needsUpdate = true;
    }
  });

  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aOpacity;
      attribute float aSize;
      varying float vOpacity;
      void main() {
        vOpacity = aOpacity;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = vOpacity * smoothstep(0.5, 0.15, d);
        gl_FragColor = vec4(0.76, 0.68, 0.55, alpha);
      }
    `,
  }), []);

  return (
    <points ref={pointsRef} material={shaderMaterial} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={totalParticles} itemSize={3} />
        <bufferAttribute attach="attributes-aOpacity" array={opacities} count={totalParticles} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={totalParticles} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}
