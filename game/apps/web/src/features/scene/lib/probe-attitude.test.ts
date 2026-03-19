import { describe, expect, it } from "vitest";

import { resolveProbeAttitudeDirection } from "./probe-attitude";

const sample = {
  epochSeconds: 0,
  positionKm: [100, 0, 0] as [number, number, number],
  velocityKmPerSec: [0, 10, 0] as [number, number, number],
};

describe("resolveProbeAttitudeDirection", () => {
  it("keeps the probe aligned with velocity during cruise and prograde burns", () => {
    expect(resolveProbeAttitudeDirection(sample, null)).toEqual([0, 1, 0]);
    expect(resolveProbeAttitudeDirection(sample, "prograde")).toEqual([0, 1, 0]);
  });

  it("flips the probe during retrograde burns", () => {
    expect(resolveProbeAttitudeDirection(sample, "retrograde")).toEqual([0, -1, 0]);
  });

  it("tilts the probe off-axis for target-correction burns", () => {
    const direction = resolveProbeAttitudeDirection(sample, "target-correction");

    expect(direction[0]).toBeGreaterThan(0);
    expect(direction[1]).toBeGreaterThan(0);
    expect(Math.hypot(...direction)).toBeCloseTo(1, 6);
  });

  it("uses orbital normal directions when requested", () => {
    expect(resolveProbeAttitudeDirection(sample, "normal")).toEqual([0, 0, 1]);
    expect(resolveProbeAttitudeDirection(sample, "antinormal")).toEqual([0, 0, -1]);
  });
});
