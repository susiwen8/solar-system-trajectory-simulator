import { describe, expect, it } from "vitest";

import {
  BODY_PHYSICAL_RADII_KM,
  PROBE_PHYSICAL_BASELINE_METERS,
  sceneBodyRadiusFromPhysicalKm,
} from "./body-physics";

describe("BODY_PHYSICAL_RADII_KM", () => {
  it("keeps gas giants larger than terrestrial planets", () => {
    expect(BODY_PHYSICAL_RADII_KM.jupiter).toBeGreaterThan(BODY_PHYSICAL_RADII_KM.earth);
    expect(BODY_PHYSICAL_RADII_KM.saturn).toBeGreaterThan(BODY_PHYSICAL_RADII_KM.mars);
  });

  it("keeps the sun larger than every planet", () => {
    expect(BODY_PHYSICAL_RADII_KM.sun).toBeGreaterThan(BODY_PHYSICAL_RADII_KM.jupiter);
  });
});

describe("sceneBodyRadiusFromPhysicalKm", () => {
  it("keeps planets readable without overpowering the probe", () => {
    expect(sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.earth)).toBe(2.8);
    expect(sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.jupiter)).toBe(5.1);
    expect(sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.sun)).toBe(7.8);
  });
});

describe("PROBE_PHYSICAL_BASELINE_METERS", () => {
  it("keeps the realism metadata available for reference", () => {
    expect(PROBE_PHYSICAL_BASELINE_METERS.busDiameter).toBeLessThan(5);
    expect(PROBE_PHYSICAL_BASELINE_METERS.spanWidth).toBeLessThan(25);
  });
});
