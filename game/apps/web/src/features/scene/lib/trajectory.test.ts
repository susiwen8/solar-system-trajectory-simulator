import { describe, expect, it } from "vitest";

import type { TrajectorySample } from "../../mission/types";
import { interpolateTrajectorySample, toScenePoints } from "./trajectory";

describe("trajectory helpers", () => {
  it("projects near-field trajectory samples into compressed scene points", () => {
    const points = toScenePoints([
      {
        epochSeconds: 0,
        positionKm: [250_000, 500_000, 750_000],
        velocityKmPerSec: [0, 0, 0],
      },
    ]);

    expect(points).toEqual([{ x: 0.1, y: 0.2, z: 0.3 }]);
  });

  it("interpolates between neighboring trajectory samples", () => {
    const current: TrajectorySample = {
      epochSeconds: 0,
      positionKm: [0, 0, 0],
      velocityKmPerSec: [0, 10, 0],
      massKg: 1000,
    };
    const next: TrajectorySample = {
      epochSeconds: 10,
      positionKm: [100, 200, 300],
      velocityKmPerSec: [2, 20, 4],
      massKg: 900,
    };

    const sample = interpolateTrajectorySample(current, next, 0.25);

    expect(sample.epochSeconds).toBe(2.5);
    expect(sample.positionKm).toEqual([25, 50, 75]);
    expect(sample.velocityKmPerSec).toEqual([0.5, 12.5, 1]);
    expect(sample.massKg).toBe(975);
  });

  it("returns the current sample when there is no next sample", () => {
    const current: TrajectorySample = {
      epochSeconds: 0,
      positionKm: [1, 2, 3],
      velocityKmPerSec: [4, 5, 6],
    };

    expect(interpolateTrajectorySample(current, undefined, 0.8)).toEqual(current);
  });
});
