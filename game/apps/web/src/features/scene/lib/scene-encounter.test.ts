import { describe, expect, it } from "vitest";

import { shouldUseEncounterDisplayAdjustment } from "./scene-encounter";

describe("shouldUseEncounterDisplayAdjustment", () => {
  it("does not adjust flyby encounters so the probe can overlap the body center again", () => {
    expect(shouldUseEncounterDisplayAdjustment("flybyEncounter")).toBe(false);
    expect(shouldUseEncounterDisplayAdjustment("gravityAssistFlyby")).toBe(false);
  });

  it("keeps arrival and capture segments eligible for encounter display adjustment", () => {
    expect(shouldUseEncounterDisplayAdjustment("arrivalHyperbolicApproach")).toBe(true);
    expect(shouldUseEncounterDisplayAdjustment("arrivalCapture")).toBe(true);
    expect(shouldUseEncounterDisplayAdjustment("scienceOrbit")).toBe(true);
  });

  it("returns false for empty or unrelated segment types", () => {
    expect(shouldUseEncounterDisplayAdjustment(null)).toBe(false);
    expect(shouldUseEncounterDisplayAdjustment(undefined)).toBe(false);
    expect(shouldUseEncounterDisplayAdjustment("deepSpaceCruise")).toBe(false);
  });
});
