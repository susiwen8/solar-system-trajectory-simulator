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
  it("keeps cruise framing close to the probe after realism retuning", () => {
    const frame = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15);
    const distance = Math.hypot(
      frame.position[0] - frame.lookAt[0],
      frame.position[1] - frame.lookAt[1],
      frame.position[2] - frame.lookAt[2],
    );

    expect(distance).toBeLessThan(18);
    expect(frame.position[1]).toBeGreaterThan(frame.lookAt[1]);
    expect(frame.fovDeg).toBe(58);
  });

  it("moves the approach frame closer than cruise", () => {
    const cruise = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15);
    const approach = buildProbeCameraFrame(samplePositionKm, view("approach-emphasis"), 1.15);

    expect(Math.abs(approach.position[2] - approach.lookAt[2])).toBeLessThan(Math.abs(cruise.position[2] - cruise.lookAt[2]));
    expect(approach.fovDeg).toBeLessThan(cruise.fovDeg);
  });

  it("allows only bounded retreat for flyby emphasis", () => {
    const frame = buildProbeCameraFrame(samplePositionKm, view("flyby-emphasis"), 1.15);
    const distance = Math.hypot(
      frame.position[0] - frame.lookAt[0],
      frame.position[1] - frame.lookAt[1],
      frame.position[2] - frame.lookAt[2],
    );

    expect(Math.abs(frame.position[0] - frame.lookAt[0])).toBeGreaterThan(3);
    expect(distance).toBeLessThan(13.5);
  });

  it("rotates the cruise camera around the probe when yaw changes", () => {
    const frame = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
      yawRad: Math.PI / 2,
      pitchRad: 0.22,
      radiusScale: 1,
    });

    expect(Math.abs(frame.position[0] - frame.lookAt[0])).toBeGreaterThan(6);
  });

  it("moves the camera higher when pitch increases", () => {
    const low = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
      yawRad: 0,
      pitchRad: -0.1,
      radiusScale: 1,
    });
    const high = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
      yawRad: 0,
      pitchRad: 0.8,
      radiusScale: 1,
    });

    expect(high.position[1]).toBeGreaterThan(low.position[1]);
  });

  it("moves the camera farther away when radius increases", () => {
    const near = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
      yawRad: 0,
      pitchRad: 0.22,
      radiusScale: 0.8,
    });
    const far = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
      yawRad: 0,
      pitchRad: 0.22,
      radiusScale: 1.6,
    });

    const nearDistance = Math.hypot(
      near.position[0] - near.lookAt[0],
      near.position[1] - near.lookAt[1],
      near.position[2] - near.lookAt[2],
    );
    const farDistance = Math.hypot(
      far.position[0] - far.lookAt[0],
      far.position[1] - far.lookAt[1],
      far.position[2] - far.lookAt[2],
    );

    expect(farDistance).toBeGreaterThan(nearDistance);
  });
});
