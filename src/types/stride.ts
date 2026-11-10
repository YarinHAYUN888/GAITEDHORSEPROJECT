/**
 * Stride Segmentation types — per-stride biomechanical metrics.
 *
 * References:
 * - Shaffer et al. 2025: Markerless Full-Body Biomechanics of Horses
 * - PFERD Dataset (Nature Scientific Data 2024)
 * - Hildebrand 1965: Symmetrical gaits of horses
 */

import type { HoofName } from "@/types/biomech";

/** A single stride detected from hoof contact events */
export interface Stride {
  /** Index within the detected strides array */
  index: number;
  /** Reference hoof used for detection */
  referenceHoof: HoofName;
  /** Frame index of stride start (contact) */
  startFrame: number;
  /** Frame index of stride end (next contact of same hoof) */
  endFrame: number;
  /** Time of stride start (seconds) */
  startT: number;
  /** Time of stride end (seconds) */
  endT: number;
  /** Total stride duration in ms */
  durationMs: number;
  /** Stance phase duration in ms (hoof on ground) */
  stanceMs: number;
  /** Swing phase duration in ms (hoof in air) */
  swingMs: number;
  /** Duty cycle: stance / total (0..1) */
  dutyCycle: number;
  /** Stride frequency in Hz */
  frequencyHz: number;
  /** Confidence of this stride detection (0..1) */
  confidence: number;
}

/** Per-stride metrics for all 4 hooves within one stride cycle */
export interface StrideMetrics {
  stride: Stride;
  /** Per-hoof stance/swing within this stride window */
  perHoof: Partial<Record<HoofName, {
    stanceMs: number;
    swingMs: number;
    dutyCycle: number;
  }>>;
  /** Number of hooves with data in this stride */
  hoofDataCount: number;
}

/** Aggregated stride consistency metrics */
export interface StrideConsistency {
  /** Number of strides analyzed */
  strideCount: number;
  /** Reference hoof used */
  referenceHoof: HoofName;
  /** Mean stride duration (ms) */
  meanDurationMs: number;
  /** Stride duration CV% */
  durationCV: number;
  /** Mean stance duration (ms) */
  meanStanceMs: number;
  /** Stance duration CV% */
  stanceCV: number;
  /** Mean swing duration (ms) */
  meanSwingMs: number;
  /** Swing duration CV% */
  swingCV: number;
  /** Mean duty cycle */
  meanDutyCycle: number;
  /** Duty cycle CV% */
  dutyCycleCV: number;
  /** Mean stride frequency (Hz) */
  meanFrequencyHz: number;
  /** Overall consistency rating */
  rating: "excellent" | "good" | "moderate" | "poor";
  /** Overall consistency score 0-100 */
  score: number;
}

/** Complete stride segmentation result */
export interface StrideSegmentationResult {
  /** Individual strides detected */
  strides: Stride[];
  /** Per-stride detailed metrics */
  strideMetrics: StrideMetrics[];
  /** Aggregated consistency scores */
  consistency: StrideConsistency;
  /** Whether enough strides were detected for reliable analysis */
  reliable: boolean;
  /** Minimum strides needed for reliability */
  minStridesRequired: number;
}
