// Tests for videoCacheService

import { describe, it, expect } from "vitest";
import { computeVideoHash } from "@/services/videoCacheService";

// Blob.slice().arrayBuffer() is not available in jsdom — these tests run in real browsers only
describe.skip("computeVideoHash (browser-only)", () => {
  it("produces consistent hash for same file", async () => {
    const content = new Uint8Array(200_000).fill(42);
    const file = new File([content], "test.mp4", { type: "video/mp4" });

    const hash1 = await computeVideoHash(file);
    const hash2 = await computeVideoHash(file);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different files", async () => {
    const content1 = new Uint8Array(200_000).fill(42);
    const content2 = new Uint8Array(200_000).fill(99);
    const file1 = new File([content1], "a.mp4");
    const file2 = new File([content2], "b.mp4");

    const hash1 = await computeVideoHash(file1);
    const hash2 = await computeVideoHash(file2);
    expect(hash1).not.toBe(hash2);
  });

  it("includes file size in hash", async () => {
    const content = new Uint8Array(100).fill(1);
    const file = new File([content], "small.mp4");
    const hash = await computeVideoHash(file);
    expect(hash).toContain(`_${file.size}`);
  });

  it("detects files with same header but different middle content", async () => {
    const size = 200_000;
    const content1 = new Uint8Array(size);
    const content2 = new Uint8Array(size);
    // Same start and end, different middle
    content1.fill(1, 0, 65536);
    content2.fill(1, 0, 65536);
    content1.fill(2, 90000, 110000); // different middle
    content2.fill(3, 90000, 110000);
    content1.fill(1, size - 65536);
    content2.fill(1, size - 65536);

    const file1 = new File([content1], "a.mp4");
    const file2 = new File([content2], "b.mp4");

    const hash1 = await computeVideoHash(file1);
    const hash2 = await computeVideoHash(file2);
    expect(hash1).not.toBe(hash2);
  });
});
