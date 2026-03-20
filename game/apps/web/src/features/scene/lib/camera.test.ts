import { describe, expect, it } from "vitest";

import type { BodyState, ClosestApproach, MissionSegment, TrajectorySample } from "../../mission/types";
import { computeProbeCameraView } from "./camera";

const baseSample: TrajectorySample = {
  epochSeconds: 0,
  positionKm: [149_597_870.7, 0, 0],
  velocityKmPerSec: [0, 29.78, 0],
};

const marsBody: BodyState = {
  bodyId: "mars",
  epoch: "2026-01-01T00:00:00.000Z",
  positionKm: [227_900_000, 0, 0],
  velocityKmPerSec: [0, 24.1, 0],
  muKm3PerS2: 42_828.375816,
  sourceName: "bundled-ephemeris",
};

const jupiterBody: BodyState = {
  bodyId: "jupiter",
  epoch: "2026-01-01T00:00:00.000Z",
  positionKm: [778_500_000, 0, 0],
  velocityKmPerSec: [0, 13.1, 0],
  muKm3PerS2: 126_686_534,
  sourceName: "bundled-ephemeris",
};

function closestApproach(bodyId: string, distanceKm: number): ClosestApproach {
  return {
    bodyId,
    distanceKm,
    epochSeconds: 0,
  };
}

describe("computeProbeCameraView", () => {
  it("returns cruise-follow framing for ordinary trajectory playback", () => {
    const view = computeProbeCameraView({
      sample: baseSample,
      bodies: [marsBody],
      closestApproach: closestApproach("mars", 28_000_000),
      activeSegment: null,
    });

    expect(view.mode).toBe("cruise-follow");
    expect(view.focusBodyId).toBe("mars");
    expect(view.fovDeg).toBeGreaterThan(45);
    expect(view.cameraOffsetKm[1]).toBeGreaterThan(0);
    expect(view.focusBodyScale).toBe(1);
  });

  it("switches to approach framing near the target body", () => {
    const view = computeProbeCameraView({
      sample: {
        ...baseSample,
        positionKm: [227_780_000, 0, 0],
      },
      bodies: [marsBody],
      closestApproach: closestApproach("mars", 120_000),
      activeSegment: null,
    });

    expect(view.mode).toBe("approach-emphasis");
    expect(view.focusBodyId).toBe("mars");
    expect(view.fovDeg).toBeLessThan(52);
    expect(view.focusBodyScale).toBeGreaterThan(1);
  });

  it("switches to flyby framing for encounter flyby segments", () => {
    const activeSegment: MissionSegment = {
      segmentType: "flybyEncounter",
      startEpoch: "2026-07-01T00:00:00.000Z",
      endEpoch: "2026-07-02T00:00:00.000Z",
      samples: [],
      initialState: {
        epoch: "2026-07-01T00:00:00.000Z",
        referenceFrame: "heliocentric-inertial",
        referenceBodyId: "jupiter",
        positionKm: [778_500_000, 0, 0],
        velocityKmPerSec: [0, 6.1, 0],
      },
      finalState: {
        epoch: "2026-07-02T00:00:00.000Z",
        referenceFrame: "heliocentric-inertial",
        referenceBodyId: "jupiter",
        positionKm: [778_510_000, 12_000, 0],
        velocityKmPerSec: [0.2, 6.3, 0],
      },
      events: [],
      metadata: {
        bodyId: "jupiter",
        turnAngleDeg: 28,
      },
    };

    const view = computeProbeCameraView({
      sample: {
        ...baseSample,
        positionKm: [778_505_000, 2_000, 0],
        velocityKmPerSec: [0.3, 6.1, 0],
      },
      bodies: [jupiterBody],
      closestApproach: closestApproach("saturn", 1_200),
      activeSegment,
    });

    expect(view.mode).toBe("flyby-emphasis");
    expect(view.focusBodyId).toBe("jupiter");
    expect(view.fovDeg).toBeLessThan(45);
    expect(view.cameraOffsetKm[2]).toBeGreaterThan(0);
    expect(view.focusBodyScale).toBeGreaterThan(2);
  });
});
