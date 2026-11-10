// Both endpoints use the same conservative source contract.
export const AUTO_SOURCE_PROMPT = `
Return sourceQuality: {visionUsable:boolean, audioUsable:boolean, reason:string} inside analysis (or the root for the single-analysis response).
Assess visionUsable from visible horse/limbs in SIDE VIEW, not breed/genotype. Audio input is derived rhythm metrics, NOT a recording: you cannot verify hoof sounds versus music/speech. audioUsable requires the provided audio metrics to pass the quality gate; describe them as unverified acoustic rhythm, not measured hoof contacts. If the horse/limbs cannot be assessed but audio passes, use audio only. If neither is adequate, return unknown and explain insufficient evidence. Never infer SI, GES, joint angles or lameness from audio. Sparse frames do not measure footfall order or timing. Breed/DMRT3 is context, never proof of gait. Singlefoot/rack must not be assumed from breed. Distinguish rack/singlefoot, tölt, pace, broken pace and trot only with visible supporting evidence; otherwise unknown.
`;

export function usableAudio(metrics: any): boolean {
  return !!metrics && Number.isFinite(metrics.signalToNoiseRatio) && metrics.signalToNoiseRatio >= 10
    && metrics.beatCount >= 4 && metrics.regularity >= 45 && Number.isFinite(metrics.bpm) && metrics.bpm > 0;
}

export function applyAutomaticSources(analysis: any, audioMetrics: any) {
  const vision = analysis.sourceQuality?.visionUsable === true;
  const audio = usableAudio(audioMetrics) && analysis.sourceQuality?.audioUsable === true;
  analysis.analysisMode = vision && audio ? "both" : audio ? "audio" : "vision";
  analysis.sourceSelection = {
    automatic: true, visionUsed: vision, audioUsed: audio,
    reason: typeof analysis.sourceQuality?.reason === "string" ? analysis.sourceQuality.reason : "Source quality could not be verified.",
    audioBasis: audio ? "unverified_acoustic_rhythm_metrics" : null,
  };
  if (!audio) { delete analysis.audioAnalysis; delete analysis.multiModalFusion; }
  if (!vision) {
    analysis.overallScore = null;
    analysis.lateralSync = { percentage: null, description: "Unavailable: insufficient visual evidence" };
    analysis.symmetry = { score: null, leftRightDifference: null, lamenessRisk: "unknown", lamenessDescription: "Unavailable: insufficient visual evidence" };
    analysis.extension = { frontLegs: null, hindLegs: null, quality: "unknown", description: "Unavailable: insufficient visual evidence" };
    analysis.keypoints = { detected: false };
    analysis.beatTracker = { impactTimes: [], offsetPercentage: null, isDirty: false, dirtyDescription: "" };
    delete analysis.kinematicMetrics; delete analysis.suspensionAnalysis; delete analysis.motionForecast;
    // Acoustic peaks alone cannot identify a horse's gait.
    analysis.gaitType = "unknown"; analysis.gaitTypeHebrew = "לא ניתן לקבוע"; analysis.confidence = 0;
  }
  return analysis;
}

export const QUICK_PROMPT = `Return JSON only for a preliminary horse gait estimate from six sampled images. Be concise: summary <=2 sentences, <=2 recommendations, short descriptions. No per-frame output, kinematics, suspension, forecasts or coordinate arrays.
Use this shape: {"gaitType":"unknown","gaitTypeHebrew":"","confidence":0,"beatPattern":"unknown","lateralSync":{"percentage":null,"description":""},"symmetry":{"score":null,"leftRightDifference":null,"lamenessRisk":"unknown","lamenessDescription":""},"extension":{"frontLegs":null,"hindLegs":null,"quality":"unknown","description":""},"keypoints":{"detected":false},"beatTracker":{"impactTimes":[],"offsetPercentage":null,"isDirty":false,"dirtyDescription":""},"overallScore":null,"trainingRecommendations":[],"summary":"","audioAnalysis":null,"sourceQuality":{"visionUsable":false,"audioUsable":false,"reason":""}}.
Unavailable numeric values must remain null. Do not manufacture clinical findings or temporal measurements. If audio metrics are usable, audioAnalysis may contain detectedBPM, rhythmRegularity, beatPattern, weakBeatDetected, audioGaitClassification:"unknown", audioConfidence:0; acoustic peaks are not verified hoof strikes.
${AUTO_SOURCE_PROMPT}`;