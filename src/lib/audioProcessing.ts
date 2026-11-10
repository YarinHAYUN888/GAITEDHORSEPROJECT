import type { AudioMetrics } from "@/types/gait";
import FFT from "fft.js";

/** Quick client-side SNR estimate from a video file's audio track. Returns dB or null if no audio. */
export async function estimateNoiseSNR(file: File): Promise<number | null> {
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    // RMS of full signal
    let sumSq = 0;
    for (let i = 0; i < channelData.length; i++) sumSq += channelData[i] * channelData[i];
    const rms = Math.sqrt(sumSq / channelData.length);

    // Estimate noise from quietest 20% of 50ms windows
    const windowSize = Math.floor(audioBuffer.sampleRate * 0.05);
    const windowRms: number[] = [];
    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      let wSq = 0;
      for (let j = i; j < i + windowSize; j++) wSq += channelData[j] * channelData[j];
      windowRms.push(Math.sqrt(wSq / windowSize));
    }
    windowRms.sort((a, b) => a - b);
    const noiseFloor = windowRms[Math.floor(windowRms.length * 0.2)] || 0.0001;

    await audioContext.close();
    return Math.round(20 * Math.log10(rms / noiseFloor));
  } catch {
    return null;
  }
}

// FFT analysis for frequency domain features
export function performFFT(audioBuffer: AudioBuffer): { dominantFrequencies: number[]; dragNoiseDetected: boolean; surfaceType: string; snr: number } {
  const channelData = audioBuffer.getChannelData(0);
  const fftSize = 2048;
  const numBins = fftSize / 2;
  const binWidth = audioBuffer.sampleRate / fftSize;

  const magnitudes = new Float32Array(numBins).fill(0);
  const chunkCount = Math.floor(channelData.length / fftSize);
  const sampledChunks = Math.min(chunkCount, 50);
  if (!sampledChunks) return { dominantFrequencies: [], dragNoiseDetected: false, surfaceType: "unknown", snr: 0 };
  const fft = new FFT(fftSize);
  const spectrum = fft.createComplexArray();
  for (let c = 0; c < sampledChunks; c++) {
    const offset = Math.floor(c * chunkCount / sampledChunks) * fftSize;
    fft.realTransform(spectrum, channelData.subarray(offset, offset + fftSize));
    for (let k = 0; k < numBins; k++) {
      magnitudes[k] += Math.hypot(spectrum[k * 2], spectrum[k * 2 + 1]) / fftSize;
    }
  }

  for (let k = 0; k < numBins; k++) magnitudes[k] /= sampledChunks;

  const freqMag: { freq: number; mag: number }[] = [];
  for (let k = 0; k < numBins; k++) {
    const freq = k * binWidth;
    if (freq >= 50 && freq <= 3000) {
      freqMag.push({ freq: Math.round(freq), mag: magnitudes[k] });
    }
  }
  freqMag.sort((a, b) => b.mag - a.mag);
  const dominantFrequencies = freqMag.slice(0, 5).map((f) => f.freq);

  const lowBand = freqMag.filter((f) => f.freq >= 50 && f.freq <= 150);
  const midBand = freqMag.filter((f) => f.freq >= 200 && f.freq <= 1500);
  const avgLow = lowBand.reduce((s, f) => s + f.mag, 0) / (lowBand.length || 1);
  const avgMid = midBand.reduce((s, f) => s + f.mag, 0) / (midBand.length || 1);
  const dragNoiseDetected = avgLow > avgMid * 1.5;

  const highBand = freqMag.filter((f) => f.freq >= 1500 && f.freq <= 3000);
  const avgHigh = highBand.reduce((s, f) => s + f.mag, 0) / (highBand.length || 1);
  let surfaceType = "unknown";
  if (avgHigh > avgMid * 0.8) surfaceType = "asphalt";
  else if (avgMid > avgHigh * 2) surfaceType = "sand";
  else surfaceType = "arena";

  const signalPower = freqMag.slice(0, 10).reduce((s, f) => s + f.mag * f.mag, 0);
  const noisePower = freqMag.slice(-20).reduce((s, f) => s + f.mag * f.mag, 0) || 1;
  const snr = Math.round(10 * Math.log10(signalPower / noisePower));

  return { dominantFrequencies, dragNoiseDetected, surfaceType, snr };
}

export async function extractAudioMetrics(file: File): Promise<AudioMetrics | null> {
  let audioContext: AudioContext | undefined;
  try {
    audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 80;
    highpass.Q.value = 0.7;

    const bandpass = offlineCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 500;
    bandpass.Q.value = 0.5;

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(offlineCtx.destination);
    source.start(0);

    const filteredBuffer = await offlineCtx.startRendering();
    const channelData = filteredBuffer.getChannelData(0);
    const sampleRate = filteredBuffer.sampleRate;

    const fftResults = performFFT(audioBuffer);

    const downsampleFactor = Math.max(1, Math.floor(sampleRate / 1000));
    const downsampled: number[] = [];
    for (let i = 0; i < channelData.length; i += downsampleFactor) {
      let sum = 0;
      const end = Math.min(i + downsampleFactor, channelData.length);
      for (let j = i; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }
      downsampled.push(sum / (end - i));
    }

    const maxAmp = downsampled.reduce((max, value) => Math.max(max, value), 0);
    const threshold = maxAmp * 0.3;
    const noiseFloor = maxAmp * 0.08;
    const minPeakDistance = 80;
    const peaks: number[] = [];
    const peakAmplitudes: number[] = [];

    for (let i = 1; i < downsampled.length - 1; i++) {
      if (downsampled[i] > threshold &&
          downsampled[i] > noiseFloor &&
          downsampled[i] > downsampled[i - 1] &&
          downsampled[i] > downsampled[i + 1]) {
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDistance) {
          peaks.push(i);
          peakAmplitudes.push(downsampled[i]);
        }
      }
    }

    if (peaks.length < 3) {
      await audioContext.close();
      return null;
    }

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push((peaks[i] - peaks[i - 1]) / 1000);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = 60 / avgInterval;

    const stdDev = Math.sqrt(
      intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
    );
    const coeffOfVariation = stdDev / avgInterval;
    const regularity = Math.max(0, Math.min(100, Math.round((1 - coeffOfVariation) * 100)));

    const avgAmplitude = peakAmplitudes.reduce((a, b) => a + b, 0) / peakAmplitudes.length;
    const hasWeakBeat = peakAmplitudes.some(amp => amp < avgAmplitude * 0.6);

    await audioContext.close();

    return {
      bpm: Math.round(bpm * 10) / 10,
      regularity,
      beatCount: peaks.length,
      hasWeakBeat,
      peakAmplitudes: peakAmplitudes.slice(0, 20),
      dominantFrequencies: fftResults.dominantFrequencies,
      dragNoiseDetected: fftResults.dragNoiseDetected,
      surfaceType: fftResults.surfaceType,
      signalToNoiseRatio: fftResults.snr,
    };
  } catch (err) {
    console.warn("Audio extraction failed:", err);
    return null;
  } finally {
    if (audioContext?.state !== "closed") await audioContext?.close().catch(() => {});
  }
}
