import { describe, expect, it } from "vitest";

import { advanceCameraMotion, advanceProbeMotion } from "./camera-motion";

describe("advanceCameraMotion", () => {
  it("moves the current camera state toward the target state", () => {
    const next = advanceCameraMotion(
      {
        position: [0, 0, 0],
        lookAt: [0, 0, 10],
        fovDeg: 58,
        zoom: 1,
      },
      {
        position: [10, 4, 2],
        lookAt: [16, 5, 8],
        fovDeg: 42,
        zoom: 1.3,
      },
      0.25,
    );

    expect(next.position[0]).toBeGreaterThan(0);
    expect(next.position[0]).toBeLessThan(10);
    expect(next.lookAt[0]).toBeGreaterThan(0);
    expect(next.lookAt[0]).toBeLessThan(16);
    expect(next.fovDeg).toBeLessThan(58);
    expect(next.zoom).toBeGreaterThan(1);
  });

  it("snaps to the target when the current state is already very close", () => {
    const next = advanceCameraMotion(
      {
        position: [9.999, 4, 2],
        lookAt: [16, 5, 8.0005],
        fovDeg: 42.0002,
        zoom: 1.2998,
      },
      {
        position: [10, 4, 2],
        lookAt: [16, 5, 8],
        fovDeg: 42,
        zoom: 1.3,
      },
      0.25,
    );

    expect(next.position).toEqual([10, 4, 2]);
    expect(next.lookAt).toEqual([16, 5, 8]);
    expect(next.fovDeg).toBe(42);
    expect(next.zoom).toBe(1.3);
  });
});

describe("advanceProbeMotion", () => {
  it("moves the probe transform toward the target state and keeps the forward vector normalized", () => {
    const next = advanceProbeMotion(
      {
        position: [0, 0, 0],
        forward: [1, 0, 0],
        engineGlowIntensity: 0.72,
        streakOpacity: 0.18,
      },
      {
        position: [10, 4, 2],
        forward: [0, 0, 1],
        engineGlowIntensity: 1.15,
        streakOpacity: 0.34,
      },
      0.25,
    );

    expect(next.position[0]).toBeGreaterThan(0);
    expect(next.position[0]).toBeLessThan(10);
    expect(next.forward[0]).toBeLessThan(1);
    expect(next.forward[2]).toBeGreaterThan(0);
    expect(Math.hypot(...next.forward)).toBeCloseTo(1, 6);
    expect(next.engineGlowIntensity).toBeGreaterThan(0.72);
    expect(next.engineGlowIntensity).toBeLessThan(1.15);
    expect(next.streakOpacity).toBeGreaterThan(0.18);
    expect(next.streakOpacity).toBeLessThan(0.34);
  });

  it("snaps to the target when the probe state is already close enough", () => {
    const next = advanceProbeMotion(
      {
        position: [9.9995, 4, 2],
        forward: [0.0004, 0, 0.9996],
        engineGlowIntensity: 1.1496,
        streakOpacity: 0.3397,
      },
      {
        position: [10, 4, 2],
        forward: [0, 0, 1],
        engineGlowIntensity: 1.15,
        streakOpacity: 0.34,
      },
      0.25,
    );

    expect(next).toEqual({
      position: [10, 4, 2],
      forward: [0, 0, 1],
      engineGlowIntensity: 1.15,
      streakOpacity: 0.34,
    });
  });
});
