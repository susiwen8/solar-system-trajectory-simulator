import { describe, expect, it } from "vitest";

import { advanceCameraMotion } from "./camera-motion";

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
