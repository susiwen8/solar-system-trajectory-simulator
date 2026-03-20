import { describe, expect, it } from "vitest";

import {
  compressSceneDistanceKm,
  scaleDistanceKm,
  scaleOverviewDistanceKm,
} from "./scale";

describe("compressSceneDistanceKm", () => {
  it("stays close to linear in the near field", () => {
    expect(compressSceneDistanceKm(4_000)).toBeCloseTo(scaleDistanceKm(4_000), 5);
  });

  it("compresses far-field distances below the overview mapping", () => {
    expect(compressSceneDistanceKm(150_000_000)).toBeLessThan(scaleOverviewDistanceKm(150_000_000));
  });

  it("remains monotonic across transition ranges", () => {
    const near = compressSceneDistanceKm(2_000_000);
    const mid = compressSceneDistanceKm(20_000_000);
    const far = compressSceneDistanceKm(200_000_000);

    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
  });
});

describe("scaleOverviewDistanceKm", () => {
  it("keeps the overview mapping linear", () => {
    expect(scaleOverviewDistanceKm(2_500_000)).toBe(1);
    expect(scaleOverviewDistanceKm(5_000_000)).toBe(2);
  });
});
