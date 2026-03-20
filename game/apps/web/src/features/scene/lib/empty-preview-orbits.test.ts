import { describe, expect, it } from "vitest";

import { buildEmptyPreviewOrbitGuide } from "./empty-preview-orbits";

describe("empty preview orbit guides", () => {
  it("builds a more compact brighter guide for an inner planet", () => {
    const guide = buildEmptyPreviewOrbitGuide("earth", 48);

    expect(guide.radiusX).toBeGreaterThan(0);
    expect(guide.radiusY).toBeGreaterThan(0);
    expect(guide.opacity).toBeGreaterThan(0.2);
    expect(guide.eccentricity).toBeGreaterThan(0);
  });

  it("builds a softer wider guide for an outer planet", () => {
    const inner = buildEmptyPreviewOrbitGuide("earth", 48);
    const outer = buildEmptyPreviewOrbitGuide("neptune", 180);

    expect(outer.radiusX).toBeGreaterThan(inner.radiusX);
    expect(outer.opacity).toBeLessThan(inner.opacity);
    expect(outer.lineWidthScale).toBeGreaterThan(inner.lineWidthScale);
  });
});
