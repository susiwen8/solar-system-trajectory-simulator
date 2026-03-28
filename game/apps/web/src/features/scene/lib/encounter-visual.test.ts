import { describe, expect, it } from "vitest";

import type { TrajectorySample } from "../../mission/types";
import {
  buildEncounterAdjustedSamples,
  buildStableEncounterAdjustedSamples,
  enforceMinimumEncounterClearance,
  measureEncounterSceneRadius,
} from "./encounter-visual";

function sampleAt(positionKm: [number, number, number], epochSeconds: number): TrajectorySample {
  return {
    epochSeconds,
    positionKm,
    velocityKmPerSec: [0, 0, 0],
  };
}

describe("encounter visual geometry", () => {
  it("pushes encounter positions outside the minimum scene clearance", () => {
    const adjusted = enforceMinimumEncounterClearance([3_000, 0, 0], [0, 0, 0], 3.2);

    expect(measureEncounterSceneRadius(adjusted, [0, 0, 0])).toBeGreaterThanOrEqual(3.2);
    expect(adjusted[0]).toBeGreaterThan(3_000);
  });

  it("bends a straight-through encounter path into a visible flyby arc", () => {
    const adjusted = buildEncounterAdjustedSamples(
      [
        sampleAt([-40_000_000, 0, 0], 0),
        sampleAt([-20_000_000, 0, 0], 1),
        sampleAt([0, 0, 0], 2),
        sampleAt([20_000_000, 0, 0], 3),
        sampleAt([40_000_000, 0, 0], 4),
      ],
      {
        bodyPositionKm: [0, 0, 0],
        encounterIndex: 2,
        minSceneRadius: 3.4,
        halfWindow: 2,
        maxSceneRadius: 4.4,
      },
    );

    expect(adjusted[2].positionKm).not.toEqual([0, 0, 0]);
    expect(Math.abs(adjusted[2].positionKm[1]) + Math.abs(adjusted[2].positionKm[2])).toBeGreaterThan(0);
    expect(measureEncounterSceneRadius(adjusted[2].positionKm, [0, 0, 0])).toBeLessThan(6);
    expect(
      Math.min(
        ...adjusted.map((sample) => measureEncounterSceneRadius(sample.positionKm, [0, 0, 0])),
      ),
    ).toBeGreaterThanOrEqual(3.4);
  });

  it("does not drag already-distant flyby endpoints inward just to satisfy a display max radius", () => {
    const sourceSamples = [
      sampleAt([-40_000_000, 0, 0], 0),
      sampleAt([-20_000_000, 0, 0], 1),
      sampleAt([0, 0, 0], 2),
      sampleAt([20_000_000, 0, 0], 3),
      sampleAt([40_000_000, 0, 0], 4),
    ];

    const adjusted = buildEncounterAdjustedSamples(sourceSamples, {
      bodyPositionKm: [0, 0, 0],
      encounterIndex: 2,
      minSceneRadius: 3.4,
      maxSceneRadius: 4.4,
      halfWindow: 2,
    });

    expect(adjusted[0].positionKm).toEqual(sourceSamples[0].positionKm);
    expect(adjusted[4].positionKm).toEqual(sourceSamples[4].positionKm);
    expect(measureEncounterSceneRadius(adjusted[2].positionKm, [0, 0, 0])).toBeGreaterThanOrEqual(3.4);
  });

  it("keeps the visible arrival arc stable while later samples are still hidden", () => {
    const sourceSamples = [
      sampleAt([-60_000_000, 0, 0], 0),
      sampleAt([-40_000_000, 0, 0], 1),
      sampleAt([-20_000_000, 0, 0], 2),
      sampleAt([0, 0, 0], 3),
      sampleAt([20_000_000, 0, 0], 4),
      sampleAt([40_000_000, 0, 0], 5),
      sampleAt([60_000_000, 0, 0], 6),
    ];
    const options = {
      bodyPositionKm: [0, 0, 0] as [number, number, number],
      encounterIndex: 3,
      minSceneRadius: 3.4,
      maxSceneRadius: 4.4,
      halfWindow: 3,
    };
    const visibleCount = 5;

    const stableVisibleSamples = buildStableEncounterAdjustedSamples(
      sourceSamples,
      visibleCount,
      options,
    );
    const fullyAdjustedVisibleSamples = buildEncounterAdjustedSamples(sourceSamples, options).slice(0, visibleCount);
    const prefixOnlyAdjustedSamples = buildEncounterAdjustedSamples(
      sourceSamples.slice(0, visibleCount),
      options,
    );

    expect(stableVisibleSamples).toEqual(fullyAdjustedVisibleSamples);
    expect(prefixOnlyAdjustedSamples[4].positionKm).not.toEqual(fullyAdjustedVisibleSamples[4].positionKm);
  });
});
