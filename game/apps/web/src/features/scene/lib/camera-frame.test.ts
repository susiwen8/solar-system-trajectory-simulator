import { describe, expect, it } from "vitest";

import type { ProbeCameraView } from "./camera";
import { buildProbeCameraFrame } from "./camera-frame";

const samplePositionKm: [number, number, number] = [149_597_870.7, 0, 0];

function view(mode: ProbeCameraView["mode"]): ProbeCameraView {
  if (mode === "flyby-emphasis") {
    return {
      mode,
      focusBodyId: "jupiter",
      lookDirection: [0, 1, 0],
      cameraOffsetKm: [-12_000, 4_000, 7_500],
      fovDeg: 38,
      focusBodyScale: 2.8,
    };
  }

  if (mode === "approach-emphasis") {
    return {
      mode,
      focusBodyId: "mars",
      lookDirection: [0, 1, 0],
      cameraOffsetKm: [-18_000, 6_000, 0],
      fovDeg: 48,
      focusBodyScale: 1.8,
    };
  }

  return {
    mode,
    focusBodyId: "mars",
    lookDirection: [0, 1, 0],
    cameraOffsetKm: [-32_000, 10_000, 0],
    fovDeg: 58,
    focusBodyScale: 1,
  };
}

describe("buildProbeCameraFrame", () => {
  it("builds a cinematic cruise frame with meaningful scene-unit offset", () => {
    const frame = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15);

    expect(Math.abs(frame.position[2] - frame.lookAt[2])).toBeGreaterThan(8);
    expect(frame.position[1]).toBeGreaterThan(frame.lookAt[1]);
    expect(frame.fovDeg).toBe(58);
  });

  it("moves the approach frame closer than cruise", () => {
    const cruise = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15);
    const approach = buildProbeCameraFrame(samplePositionKm, view("approach-emphasis"), 1.15);

    expect(Math.abs(approach.position[2] - approach.lookAt[2])).toBeLessThan(Math.abs(cruise.position[2] - cruise.lookAt[2]));
    expect(approach.fovDeg).toBeLessThan(cruise.fovDeg);
  });

  it("adds a lateral orbiting offset during flyby emphasis", () => {
    const frame = buildProbeCameraFrame(samplePositionKm, view("flyby-emphasis"), 1.15);

    expect(Math.abs(frame.position[0] - frame.lookAt[0])).toBeGreaterThan(3);
    expect(Math.abs(frame.position[2] - frame.lookAt[2])).toBeGreaterThan(4);
  });
});
