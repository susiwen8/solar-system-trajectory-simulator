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
  it("maps real radii into stable scene radii without reordering bodies", () => {
    expect(sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.jupiter)).toBeGreaterThan(
      sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.earth),
    );
  });
});

describe("PROBE_PHYSICAL_BASELINE_METERS", () => {
  it("keeps the probe tiny next to planets", () => {
    expect(PROBE_PHYSICAL_BASELINE_METERS.busDiameter).toBeLessThan(5);
    expect(PROBE_PHYSICAL_BASELINE_METERS.spanWidth).toBeLessThan(25);
  });
});
