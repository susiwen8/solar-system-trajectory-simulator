import { describe, expect, it } from "vitest";

import type { BodyState, ClosestApproach, FlybyEvent, TrajectorySample } from "../../mission/types";
import { buildInsetMapModel } from "./inset-map";

const samples: TrajectorySample[] = [
  {
    epochSeconds: 0,
    positionKm: [149_597_870.7, 0, 0],
    velocityKmPerSec: [0, 29.78, 0],
  },
  {
    epochSeconds: 86_400,
    positionKm: [170_000_000, 35_000_000, 0],
    velocityKmPerSec: [-2, 27.4, 0],
  },
  {
    epochSeconds: 172_800,
    positionKm: [227_900_000, 0, 0],
    velocityKmPerSec: [0, 24.1, 0],
  },
];

const bodies: BodyState[] = [
  {
    bodyId: "earth",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [149_597_870.7, 0, 0],
    velocityKmPerSec: [0, 29.78, 0],
    muKm3PerS2: 398_600.435436,
    sourceName: "bundled-ephemeris",
  },
  {
    bodyId: "mars",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [227_900_000, 0, 0],
    velocityKmPerSec: [0, 24.1, 0],
    muKm3PerS2: 42_828.375816,
    sourceName: "bundled-ephemeris",
  },
];

function closestApproach(bodyId: string): ClosestApproach {
  return {
    bodyId,
    distanceKm: 5_000,
    epochSeconds: 172_800,
  };
}

describe("buildInsetMapModel", () => {
  it("builds sun-centered orbital guide paths for relevant planets", () => {
    const model = buildInsetMapModel({
      samples,
      bodies,
      closestApproach: closestApproach("mars"),
      selectedSampleIndex: 1,
      flybyEvents: [],
    });

    const earthOrbit = model.orbitPaths.find((orbit) => orbit.bodyId === "earth");

    expect(earthOrbit).toBeDefined();
    expect(earthOrbit?.points.length).toBeGreaterThan(24);
    expect(Math.min(...earthOrbit!.points.map((point) => point.x))).toBeLessThan(model.viewBox.width / 2);
    expect(Math.max(...earthOrbit!.points.map((point) => point.x))).toBeGreaterThan(model.viewBox.width / 2);
    expect(Math.min(...earthOrbit!.points.map((point) => point.y))).toBeLessThan(model.viewBox.height / 2);
    expect(Math.max(...earthOrbit!.points.map((point) => point.y))).toBeGreaterThan(model.viewBox.height / 2);
  });

  it("keeps the inset map centered on the sun with equal radial scaling", () => {
    const model = buildInsetMapModel({
      samples,
      bodies: [
        {
          ...bodies[0],
          positionKm: [149_597_870.7, 0, 0],
        },
        {
          ...bodies[1],
          positionKm: [0, 149_597_870.7, 0],
        },
      ],
      closestApproach: closestApproach("mars"),
      selectedSampleIndex: 0,
      flybyEvents: [],
    });

    const earthPoint = model.visibleBodies.find((body) => body.bodyId === "earth");
    const marsPoint = model.visibleBodies.find((body) => body.bodyId === "mars");
    const centerX = model.viewBox.width / 2;
    const centerY = model.viewBox.height / 2;

    expect(earthPoint).toBeDefined();
    expect(marsPoint).toBeDefined();
    expect(Math.abs((earthPoint?.x ?? 0) - centerX)).toBeCloseTo(Math.abs((marsPoint?.y ?? 0) - centerY), 5);
  });

  it("projects trajectory samples into stable inset-map coordinates", () => {
    const model = buildInsetMapModel({
      samples,
      bodies,
      closestApproach: closestApproach("mars"),
      selectedSampleIndex: 1,
      flybyEvents: [],
    });

    expect(model.pathPoints).toHaveLength(3);
    expect(model.currentProbePoint).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    expect(model.currentProbePoint.x).toBeGreaterThan(0);
    expect(model.currentProbePoint.y).toBeGreaterThan(0);
    expect(model.targetBody?.bodyId).toBe("mars");
  });

  it("highlights the flyby body when a flyby event is active", () => {
    const flybyEvents: FlybyEvent[] = [
      {
        bodyId: "earth",
        epoch: "2026-01-02T00:00:00.000Z",
        positionKm: [149_597_870.7, 0, 0],
        periapsisAltitudeKm: 500,
        turnAngleDeg: 18,
        inboundVInfinityKmPerS: 4.2,
        outboundVInfinityKmPerS: 5.1,
      },
    ];

    const model = buildInsetMapModel({
      samples,
      bodies,
      closestApproach: closestApproach("mars"),
      selectedSampleIndex: 0,
      flybyEvents,
    });

    expect(model.highlightBody?.bodyId).toBe("earth");
    expect(model.visibleBodies.map((body) => body.bodyId)).toContain("earth");
    expect(model.visibleBodies.map((body) => body.bodyId)).toContain("mars");
  });
});
