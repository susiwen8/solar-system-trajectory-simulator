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
  it("keeps the probe clearly smaller than emphasized planets", () => {
    expect(PROBE_VISUAL_SCALE).toBeLessThan(0.1);
    expect(PROBE_VISUAL_SCALE).toBeGreaterThan(0.02);
  });

  it("keeps thrust effects slightly larger than the compressed probe body", () => {
    expect(PROBE_EFFECTS_SCALE).toBeGreaterThan(PROBE_VISUAL_SCALE);
    expect(PROBE_EFFECTS_SCALE).toBeLessThan(0.2);
  });
});
