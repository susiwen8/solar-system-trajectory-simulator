import { describe, expect, it } from "vitest";

import {
  computeFocusBodyVisualProfile,
  getPlanetaryRingProfile,
} from "./focus-visuals";

describe("computeFocusBodyVisualProfile", () => {
  it("keeps cruise visuals restrained for ordinary focus bodies", () => {
    const profile = computeFocusBodyVisualProfile("mars", "cruise-follow");

    expect(profile.haloScale).toBeGreaterThan(1);
    expect(profile.haloScale).toBeLessThan(1.08);
    expect(profile.haloOpacity).toBeLessThan(0.08);
    expect(profile.bandCount).toBe(0);
    expect(profile.atmosphereOpacity).toBeLessThan(0.08);
  });

  it("adds atmospheric emphasis for rocky-planet approaches", () => {
    const profile = computeFocusBodyVisualProfile("mars", "approach-emphasis");

    expect(profile.atmosphereColor).toBeTruthy();
    expect(profile.atmosphereOpacity).toBeGreaterThan(0.18);
    expect(profile.haloOpacity).toBeGreaterThan(0.18);
    expect(profile.bandCount).toBe(0);
  });

  it("adds banded gas-giant styling for flyby emphasis", () => {
    const profile = computeFocusBodyVisualProfile("jupiter", "flyby-emphasis");

    expect(profile.bandCount).toBeGreaterThanOrEqual(3);
    expect(profile.bandOpacity).toBeGreaterThan(0.15);
    expect(profile.haloScale).toBeGreaterThan(1.25);
    expect(profile.atmosphereOpacity).toBeGreaterThan(0.2);
  });
});

describe("getPlanetaryRingProfile", () => {
  it("only gives Saturn a prominent ring system", () => {
    expect(getPlanetaryRingProfile("saturn")).toBeTruthy();
    expect(getPlanetaryRingProfile("earth")).toBeNull();
    expect(getPlanetaryRingProfile("mars")).toBeNull();
    expect(getPlanetaryRingProfile("jupiter")).toBeNull();
  });
});
