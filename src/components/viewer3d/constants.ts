// 3D Viewer constants and utilities

import * as THREE from "three";

/* Normalized joint positions (0-1) — mapped to GLB bounding box at runtime */
export const JOINT_POSITIONS_NORM: Record<string, Record<string, [number, number, number]>> = {
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

export const SPINE_POINTS_NORM: [number, number, number][] = [
  [0.5, 0.95, 0.85],
  [0.5, 0.92, 0.78],
  [0.5, 0.88, 0.69],
  [0.5, 0.85, 0.55],
  [0.5, 0.84, 0.42],
  [0.5, 0.85, 0.30],
  [0.5, 0.82, 0.22],
  [0.5, 0.70, 0.12],
];

export function mapToWorld(norm: [number, number, number], bbox: THREE.Box3): [number, number, number] {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  return [
    bbox.min.x + norm[0] * size.x,
    bbox.min.y + norm[1] * size.y,
    bbox.min.z + norm[2] * size.z,
  ];
}

export const DEFAULT_BBOX = new THREE.Box3(
  new THREE.Vector3(-0.2, 0, -0.45),
  new THREE.Vector3(0.2, 0.65, 0.5),
);

export const LEG_KEYS = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;

export const TRAIL_LENGTH = 24;

export const CAMERA_PRESETS: { label: string; position: [number, number, number]; icon: string }[] = [
  { label: "מהצד", position: [2, 0.8, 0], icon: "→" },
  { label: "מלפנים", position: [0, 0.8, 2.5], icon: "↓" },
  { label: "מלמעלה", position: [0, 3, 0.01], icon: "◎" },
  { label: "חופשי", position: [1.5, 1, 1.5], icon: "⟳" },
];
