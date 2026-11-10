// HoofTrail — ring buffer trail for hoof paths in 3D

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TRAIL_LENGTH } from "./constants";

interface HoofTrailProps {
  legKey: string;
  color: string;
  poseRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
}

export default function HoofTrail({ legKey, color, poseRef }: HoofTrailProps) {
  const bufferRef = useRef<THREE.Vector3[]>([]);
  const lineObj = useMemo(() => {
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setDrawRange(0, 0);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }));
  }, [color]);

  useFrame(() => {
    const hoofPos = poseRef.current.get(`${legKey}.hoof`);
    if (!hoofPos) return;

    const buf = bufferRef.current;
    buf.push(hoofPos.clone());
    if (buf.length > TRAIL_LENGTH) buf.shift();

    const posAttr = lineObj.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < buf.length; i++) {
      posAttr.setXYZ(i, buf[i].x, buf[i].y, buf[i].z);
    }
    posAttr.needsUpdate = true;
    lineObj.geometry.setDrawRange(0, buf.length);
  });

  return <primitive object={lineObj} />;
}
