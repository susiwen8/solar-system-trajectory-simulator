import { describe, expect, it } from "vitest";

import type { MissionSegment, TrajectoryResult } from "../../mission/types";
import {
  buildArrivalCaptureModel,
  buildDisplayCapturePathPoints,
  estimateArrivalCaptureOrbitDurationSeconds,
  sampleArrivalCaptureOrbit,
} from "./arrival-capture";

function buildSegment(overrides: Partial<MissionSegment>): MissionSegment {
  return {
    segmentType: "heliocentricCruise",
    startEpoch: "2026-01-01T00:00:00.000Z",
    endEpoch: "2026-01-02T00:00:00.000Z",
    samples: [],
    initialState: {
      epoch: "2026-01-01T00:00:00.000Z",
      referenceFrame: "heliocentric-inertial",
      positionKm: [1, 0, 0],
      velocityKmPerSec: [0, 1, 0],
    },
    finalState: {
      epoch: "2026-01-02T00:00:00.000Z",
      referenceFrame: "heliocentric-inertial",
      positionKm: [1, 1, 0],
      velocityKmPerSec: [0, 1, 0],
    },
    events: [],
    ...overrides,
  };
}

function buildResult(segments: MissionSegment[]): TrajectoryResult {
  return {
    referenceFrame: "heliocentric-inertial",
    ephemerisSource: "test-source",
    samples: [
      {
        epochSeconds: 0,
        positionKm: [149_597_870.7, 0, 0],
        velocityKmPerSec: [0, 29.78, 0],
      },
      {
        epochSeconds: 86_400,
        positionKm: [227_900_000, 0, 0],
        velocityKmPerSec: [0, 24.1, 0],
      },
    ],
    segments,
    closestApproach: {
      bodyId: "mars",
      distanceKm: 1_200,
      epochSeconds: 86_400,
    },
    flightTimeSeconds: 86_400,
    warnings: [],
  };
}

describe("buildArrivalCaptureModel", () => {
  it("prefers real target-centered capture samples over a synthetic orbit summary", () => {
    const sampledOrbit: MissionSegment = buildSegment({
      segmentType: "parkingOrbit",
      samples: [
        {
          epochSeconds: 0,
          positionKm: [4200, 0, 0],
          velocityKmPerSec: [0, 3.4, 0],
        },
        {
          epochSeconds: 1800,
          positionKm: [2100, 0, 3600],
          velocityKmPerSec: [-2.4, 0.6, 1.1],
        },
        {
          epochSeconds: 3600,
          positionKm: [-1800, 0, 3900],
          velocityKmPerSec: [-2.6, -0.4, 0.5],
        },
      ],
      initialState: {
        epoch: "2026-01-02T00:00:00.000Z",
        referenceFrame: "mars-centered-inertial",
        referenceBodyId: "mars",
        positionKm: [4200, 0, 0],
        velocityKmPerSec: [0, 3.4, 0],
      },
      finalState: {
        epoch: "2026-01-02T01:00:00.000Z",
        referenceFrame: "mars-centered-inertial",
        referenceBodyId: "mars",
        positionKm: [-1800, 0, 3900],
        velocityKmPerSec: [-2.6, -0.4, 0.5],
      },
      orbitSummary: {
        isBound: true,
        periapsisKm: 4_200,
        apoapsisKm: 7_200,
        inclinationDeg: 25,
      },
      metadata: {
        bodyId: "mars",
      },
    });

    const model = buildArrivalCaptureModel(buildResult([sampledOrbit]));

    expect(model).not.toBeNull();
    expect(model?.source).toBe("segment-samples");
    expect(model?.durationSeconds).toBe(3600);
    expect(model?.pathPoints).toEqual(sampledOrbit.samples.map((sample) => sample.positionKm));
  });

  it("builds a captured orbit model from a bound parking-orbit segment", () => {
    const model = buildArrivalCaptureModel(
      buildResult([
        buildSegment({
          segmentType: "parkingOrbit",
          orbitSummary: {
            isBound: true,
            periapsisKm: 4_200,
            apoapsisKm: 7_200,
            inclinationDeg: 25,
          },
          finalState: {
            epoch: "2026-01-02T00:00:00.000Z",
            referenceFrame: "mars-centered-inertial",
            referenceBodyId: "mars",
            positionKm: [4_200, 0, 0],
            velocityKmPerSec: [0, 3.4, 0],
          },
          metadata: {
            bodyId: "mars",
          },
        }),
      ]),
    );

    expect(model).not.toBeNull();
    expect(model?.bodyId).toBe("mars");
    expect(model?.durationSeconds).toBeNull();
    expect(model?.pathPoints.length).toBeGreaterThan(30);
    expect(model?.source).toBe("synthetic-orbit-summary");
  });

  it("returns null for flyby-only arrivals", () => {
    const model = buildArrivalCaptureModel(
      buildResult([
        buildSegment({
          segmentType: "flybyEncounter",
          metadata: {
            bodyId: "mars",
            turnAngleDeg: 18,
          },
        }),
      ]),
    );

    expect(model).toBeNull();
  });
});

describe("buildDisplayCapturePathPoints", () => {
  it("expands very small physical capture paths so they render outside the planet body", () => {
    const displayPath = buildDisplayCapturePathPoints(
      [
        [4_200, 0, 0],
        [0, 0, 4_200],
        [-4_200, 0, 0],
      ],
      3.1,
    );

    const minimumDisplayedRadiusKm = Math.min(
      ...displayPath.map(([x, y, z]) => Math.sqrt(x ** 2 + y ** 2 + z ** 2)),
    );

    expect(minimumDisplayedRadiusKm).toBeGreaterThan(4_200);
  });

  it("preserves already exaggerated paths without inflating them further", () => {
    const sourcePath: Array<[number, number, number]> = [
      [8_000_000, 0, 0],
      [0, 5_700_000, 0],
      [-8_000_000, 0, 0],
    ];

    expect(buildDisplayCapturePathPoints(sourcePath, 3.1)).toEqual(sourcePath);
  });
});

describe("capture orbit playback helpers", () => {
  it("estimates an orbital period from the capture path and body mu", () => {
    const durationSeconds = estimateArrivalCaptureOrbitDurationSeconds(
      [
        [4_200, 0, 0],
        [0, 0, 7_200],
        [-4_200, 0, 0],
        [0, 0, -7_200],
        [4_200, 0, 0],
      ],
      42_828.375816,
    );

    expect(durationSeconds).not.toBeNull();
    expect(durationSeconds).toBeGreaterThan(5_000);
  });

  it("samples a looping arrival orbit around the capture body", () => {
    const sample = sampleArrivalCaptureOrbit(
      [
        [4_200, 0, 0],
        [0, 0, 4_200],
        [-4_200, 0, 0],
        [0, 0, -4_200],
        [4_200, 0, 0],
      ],
      [100_000, 0, 200_000],
      0.25,
    );

    expect(sample).not.toBeNull();
    expect(sample?.positionKm[0]).toBeCloseTo(100_000, 3);
    expect(sample?.positionKm[2]).toBeCloseTo(204_200, 3);
    expect(Math.hypot(...(sample?.velocityKmPerSec ?? [0, 0, 0]))).toBeCloseTo(1, 6);
  });
});
