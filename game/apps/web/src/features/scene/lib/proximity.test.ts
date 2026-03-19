import { describe, expect, it } from "vitest";

import type { BodyState, ClosestApproach, TrajectorySample } from "../../mission/types";
import { resolveProbeProximityState } from "./proximity";

const marsBody: BodyState = {
  bodyId: "mars",
  epoch: "2026-01-01T00:00:00.000Z",
  positionKm: [227_900_000, 0, 0],
  velocityKmPerSec: [0, 24.1, 0],
  muKm3PerS2: 42_828.375816,
  sourceName: "bundled-ephemeris",
};

function closestApproach(distanceKm: number): ClosestApproach {
  return {
    bodyId: "mars",
    distanceKm,
    epochSeconds: 0,
  };
}

describe("resolveProbeProximityState", () => {
  it("treats a standard planetary arrival window as approach emphasis", () => {
    const sample: TrajectorySample = {
      epochSeconds: 0,
      positionKm: [221_000_000, 0, 0],
      velocityKmPerSec: [0, 24.8, 0],
    };

    const state = resolveProbeProximityState({
      sample,
      bodies: [marsBody],
      closestApproach: closestApproach(8_450_000),
      activeSegment: null,
    });

    expect(state.mode).toBe("approach-emphasis");
    expect(state.focusBodyId).toBe("mars");
  });

  it("keeps distant cruise segments in cruise-follow mode", () => {
    const sample: TrajectorySample = {
      epochSeconds: 0,
      positionKm: [149_597_870.7, 0, 0],
      velocityKmPerSec: [0, 29.78, 0],
    };

    const state = resolveProbeProximityState({
      sample,
      bodies: [marsBody],
      closestApproach: closestApproach(28_000_000),
      activeSegment: null,
    });

    expect(state.mode).toBe("cruise-follow");
  });
});
