import { describe, expect, it } from "vitest";

import {
  PROBE_EFFECTS_SCALE,
  PROBE_VISUAL_SCALE,
  rotateProbeModelAxis,
} from "./probe-model";

describe("rotateProbeModelAxis", () => {
  it("maps the probe engine axis to backward along the runtime forward frame", () => {
    expect(rotateProbeModelAxis([1, 0, 0])).toEqual([0, 0, -1]);
  });

  it("maps the antenna side to the runtime forward direction", () => {
    expect(rotateProbeModelAxis([-1, 0, 0])).toEqual([0, 0, 1]);
  });
});

describe("probe visual scale", () => {
  it("restores the readable pre-realism probe scale", () => {
    expect(PROBE_VISUAL_SCALE).toBe(0.34);
  });

  it("restores the matching pre-realism effects scale", () => {
    expect(PROBE_EFFECTS_SCALE).toBe(0.44);
    expect(PROBE_EFFECTS_SCALE).toBeGreaterThan(PROBE_VISUAL_SCALE);
  });
});
