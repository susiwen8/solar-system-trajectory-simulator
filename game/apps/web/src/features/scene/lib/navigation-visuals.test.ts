import { buildNavigationVisuals } from "./navigation-visuals";

const resultWithNavigationTelemetry = {
  referenceFrame: "heliocentric-inertial",
  ephemerisSource: "bundled-keplerian",
  samples: [
    {
      epochSeconds: 0,
      positionKm: [0, 0, 0] as [number, number, number],
      velocityKmPerSec: [1, 0, 0] as [number, number, number],
    },
    {
      epochSeconds: 10,
      positionKm: [10, 1, 0] as [number, number, number],
      velocityKmPerSec: [1, 0, 0] as [number, number, number],
    },
  ],
  closestApproach: {
    bodyId: "mars",
    distanceKm: 1200,
    epochSeconds: 10,
  },
  flightTimeSeconds: 10,
  warnings: [],
  navigationTelemetry: {
    enabled: true,
    nominalSamples: [
      {
        epochSeconds: 0,
        positionKm: [0, 0, 0] as [number, number, number],
        velocityKmPerSec: [1, 0, 0] as [number, number, number],
      },
      {
        epochSeconds: 10,
        positionKm: [10, 0, 0] as [number, number, number],
        velocityKmPerSec: [1, 0, 0] as [number, number, number],
      },
    ],
    dispersedSamples: [
      {
        epochSeconds: 0,
        positionKm: [0, 0, 0] as [number, number, number],
        velocityKmPerSec: [1, 0, 0] as [number, number, number],
      },
      {
        epochSeconds: 10,
        positionKm: [10, 1, 0] as [number, number, number],
        velocityKmPerSec: [1, 0, 0] as [number, number, number],
      },
    ],
    navigationEvents: [
      {
        type: "dispersionInjected" as const,
        epoch: "2026-01-01T00:00:00Z",
      },
      {
        type: "tcmExecuted" as const,
        epoch: "2026-01-01T00:00:10Z",
        predictedMissBeforeKm: 8200,
        predictedMissAfterKm: 1200,
      },
    ],
    tcmCount: 1,
    cumulativeCorrectionDeltaVKmPerS: 0.002,
    maxPredictedMissKm: 8200,
    maxPositionDeviationKm: 50,
    maxVelocityDeviationKmPerS: 0.02,
    finalPredictedMissKm: 1200,
  },
};

it("returns both nominal and dispersed paths when navigation is enabled", () => {
  const visuals = buildNavigationVisuals(
    resultWithNavigationTelemetry,
    1,
    "2026-01-01T00:00:00Z",
  );

  expect(visuals.nominalPath.length).toBeGreaterThan(0);
  expect(visuals.dispersedPath.length).toBeGreaterThan(0);
  expect(visuals.hud?.predictedMissKm).toBe(1200);
});

it("maps tcmExecuted events to marker samples", () => {
  const visuals = buildNavigationVisuals(
    resultWithNavigationTelemetry,
    1,
    "2026-01-01T00:00:00Z",
  );

  expect(visuals.tcmMarkers).toHaveLength(1);
  expect(visuals.tcmMarkers[0]?.sample.epochSeconds).toBe(10);
});
