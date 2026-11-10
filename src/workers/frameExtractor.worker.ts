/**
 * Web Worker for extracting video frames using mp4box.js + WebCodecs API.
 * Falls back to a message indicating fallback is needed if WebCodecs/mp4box is unavailable.
 *
 * Messages IN:  { type: 'extract', file: File, count: number }
 * Messages OUT: { type: 'progress', current: number, total: number }
 *             | { type: 'done', frames: string[] }
 *             | { type: 'fallback' }
 *             | { type: 'error', message: string }
 */

// @ts-ignore — mp4box ships as UMD, importScripts or bundled
import MP4Box from "mp4box";

let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, file, count } = e.data;

  if (type === "CANCEL") {
    cancelled = true;
    return;
  }

  if (type !== "extract") return;
  cancelled = false;

  // Check WebCodecs support
  if (typeof VideoDecoder === "undefined") {
    self.postMessage({ type: "fallback" });
    return;
  }

  try {
    const frames = await extractWithMP4Box(file, count);
    if (!cancelled) {
      self.postMessage({ type: "done", frames });
    }
  } catch (err: any) {
    console.warn("Worker WebCodecs extraction failed:", err?.message);
    self.postMessage({ type: "fallback" });
  }
};

async function extractWithMP4Box(file: File, count: number): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();

  return new Promise<string[]>((resolve, reject) => {
    const mp4boxFile = MP4Box.createFile();
    let videoTrack: any = null;
    let totalSamples = 0;
    const decodedFrames: { index: number; bitmap: ImageBitmap }[] = [];
    let targetIndices: number[] = [];
    let samplesProcessed = 0;

    // Step 1: Find the video track
    mp4boxFile.onReady = (info: any) => {
      const vTrack = info.tracks.find((t: any) => t.type === "video");
      if (!vTrack) {
        reject(new Error("No video track found"));
        return;
      }
      videoTrack = vTrack;
      totalSamples = vTrack.nb_samples;

      // Pick evenly-spaced sample indices
      const step = totalSamples / (count + 1);
      targetIndices = Array.from({ length: count }, (_, i) => Math.min(Math.floor(step * (i + 1)), totalSamples - 1));

      // Setup decoder
      const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          if (cancelled) {
            frame.close();
            return;
          }
          // Convert VideoFrame to ImageBitmap then to base64 via OffscreenCanvas
          createImageBitmap(frame).then((bmp) => {
            decodedFrames.push({ index: samplesProcessed, bitmap: bmp });
            frame.close();

            self.postMessage({ type: "progress", current: decodedFrames.length, total: count });

            if (decodedFrames.length >= count) {
              finishExtraction();
            }
          }).catch(() => {
            frame.close();
          });
        },
        error: (err: any) => {
          reject(new Error(`VideoDecoder error: ${err.message}`));
        },
      });

      // Configure decoder from mp4box codec string
      const codecStr = vTrack.codec;
      decoder.configure({
        codec: codecStr,
        codedWidth: vTrack.video?.width ?? vTrack.track_width,
        codedHeight: vTrack.video?.height ?? vTrack.track_height,
        description: getDescription(mp4boxFile, vTrack),
      });

      // Extract samples for target indices
      mp4boxFile.setExtractionOptions(vTrack.id, null, {
        nbSamples: totalSamples,
      });

      mp4boxFile.onSamples = (_trackId: number, _user: any, samples: any[]) => {
        for (const sample of samples) {
          if (cancelled) {
            decoder.close();
            return;
          }
          if (targetIndices.includes(sample.number)) {
            const chunk = new EncodedVideoChunk({
              type: sample.is_sync ? "key" : "delta",
              timestamp: sample.cts * 1_000_000 / sample.timescale,
              duration: sample.duration * 1_000_000 / sample.timescale,
              data: sample.data,
            });
            decoder.decode(chunk);
          }
          samplesProcessed++;
        }

        // After all samples, flush
        if (samplesProcessed >= totalSamples) {
          decoder.flush().catch(() => {});
        }
      };

      mp4boxFile.start();

      async function finishExtraction() {
        try {
          await decoder.flush();
        } catch {}
        decoder.close();

        // Sort by index and convert to base64
        decodedFrames.sort((a, b) => a.index - b.index);
        const base64Frames: string[] = [];

        for (const { bitmap } of decodedFrames.slice(0, count)) {
          const canvas = new OffscreenCanvas(
            Math.min(bitmap.width, 720),
            Math.min(bitmap.height, Math.round(720 / (bitmap.width / bitmap.height)))
          );
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();

          const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.6 });
          const base64 = await blobToBase64(blob);
          base64Frames.push(base64);
        }

        resolve(base64Frames);
      }
    };

    mp4boxFile.onError = (e: any) => {
      reject(new Error(`MP4Box error: ${e}`));
    };

    // Feed data to mp4box
    (arrayBuffer as any).fileStart = 0;
    mp4boxFile.appendBuffer(arrayBuffer);
    mp4boxFile.flush();
  });
}

/**
 * Extract codec-specific description (avcC/hvcC box) needed by VideoDecoder.
 */
function getDescription(mp4boxFile: any, track: any): Uint8Array | undefined {
  const trak = mp4boxFile.getTrackById(track.id);
  if (!trak) return undefined;

  const stsd = trak.mdia?.minf?.stbl?.stsd;
  if (!stsd?.entries?.length) return undefined;

  const entry = stsd.entries[0];
  // avcC for H.264, hvcC for H.265
  const box = entry.avcC || entry.hvcC || entry.vpcC;
  if (!box) return undefined;

  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
  box.write(stream);
  return new Uint8Array(stream.buffer, 8); // skip box header
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
