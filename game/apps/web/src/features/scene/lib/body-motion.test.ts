import { describe, expect, it } from "vitest";

import type { BodyState } from "../../mission/types";
import { areBodyStatesClose, interpolateBodyStates } from "./body-motion";

const currentBodies: BodyState[] = [
  {
    bodyId: "earth",
    epoch: "2026-01-01T00:00:00Z",
    positionKm: [100, 200, 300],
    velocityKmPerSec: [1, 2, 3],
    muKm3PerS2: 398600.435436,
    sourceName: "jpl",
  },
  {
    bodyId: "mars",
    epoch: "2026-01-01T00:00:00Z",
    positionKm: [500, 800, 1300],
    velocityKmPerSec: [4, 5, 6],
    muKm3PerS2: 42828.375816,
    sourceName: "jpl",
  },
];

describe("interpolateBodyStates", () => {
  it("interpolates body positions and velocities between ephemeris snapshots", () => {
    const next = interpolateBodyStates(currentBodies, [
      {
        ...currentBodies[0],
        epoch: "2026-01-01T06:00:00Z",
        positionKm: [200, 400, 600],
        velocityKmPerSec: [2, 4, 6],
      },
      {
        ...currentBodies[1],
        epoch: "2026-01-01T06:00:00Z",
        positionKm: [700, 1000, 1600],
        velocityKmPerSec: [6, 7, 8],
      },
    ], 0.5);

    expect(next).toEqual([
      {
        ...currentBodies[0],
        epoch: "2026-01-01T06:00:00Z",
        positionKm: [150, 300, 450],
        velocityKmPerSec: [1.5, 3, 4.5],
      },
      {
        ...currentBodies[1],
        epoch: "2026-01-01T06:00:00Z",
        positionKm: [600, 900, 1450],
        velocityKmPerSec: [5, 6, 7],
      },
    ]);
  });

  it("treats identical body snapshots as already close", () => {
    expect(areBodyStatesClose(currentBodies, currentBodies)).toBe(true);
  });

  it("treats changed body positions as not close", () => {
    expect(
      areBodyStatesClose(currentBodies, [
        {
          ...currentBodies[0],
          positionKm: [101, 200, 300],
        },
        currentBodies[1],
      ]),
    ).toBe(false);
  });
});
