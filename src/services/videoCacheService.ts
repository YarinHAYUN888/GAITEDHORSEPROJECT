// Video caching — hash computation + cache lookup

import { supabase } from "@/integrations/supabase/client";
import type { GaitAnalysisResult } from "@/types/gait";
import { isGaitResultValid } from "@/lib/gaitResultValidation";

/**
 * Video hash for caching — computes a fast hash from file metadata + sample bytes.
 * Samples beginning, middle, and end for collision resistance.
 */
export async function computeVideoHash(file: File): Promise<string> {
  // Hard 4s timeout — never let hashing block the scan.
  const work = (async () => {
    const sampleSize = 64 * 1024;
    const startSlice = await file.slice(0, sampleSize).arrayBuffer();
    const midOffset = Math.max(0, Math.floor(file.size / 2) - sampleSize / 2);
    const midSlice = await file.slice(midOffset, midOffset + sampleSize).arrayBuffer();
    const endOffset = Math.max(0, file.size - sampleSize);
    const endSlice = await file.slice(endOffset, file.size).arrayBuffer();
    const combined = new Uint8Array(startSlice.byteLength + midSlice.byteLength + endSlice.byteLength);
    combined.set(new Uint8Array(startSlice), 0);
    combined.set(new Uint8Array(midSlice), startSlice.byteLength);
    combined.set(new Uint8Array(endSlice), startSlice.byteLength + midSlice.byteLength);
    const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.substring(0, 24)}_${file.size}`;
  })();
  return Promise.race([
    work,
    new Promise<string>((resolve) =>
      setTimeout(() => resolve(`fallback_${file.size}_${file.lastModified}`), 4000)
    ),
  ]);
}

/**
 * Check if analysis exists for this video hash.
 */
export async function findCachedAnalysis(videoHash: string, horseId?: string): Promise<{ id: string; result: GaitAnalysisResult } | null> {
  // Hard 3s timeout — cache lookup is best-effort; never block Quick Scan.
  try {
    let query = supabase
      .from("gait_analyses")
      .select("id, result_json")
      .eq("video_hash", videoHash);
    query = horseId ? query.eq("horse_id", horseId) : query.is("horse_id", null);
    const lookup = query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const result = await Promise.race([
      lookup,
      new Promise<{ data: null; error: null }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: null }), 3000)
      ),
    ]);
    const { data, error } = result as { data: any; error: any };
    if (error || !data || !isGaitResultValid(data.result_json)) return null;
    return { id: data.id, result: data.result_json as unknown as GaitAnalysisResult };
  } catch {
    return null;
  }
}
