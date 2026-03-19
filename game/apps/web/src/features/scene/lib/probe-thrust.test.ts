import { describe, expect, it } from "vitest";

import type { ManeuverEvent } from "../../mission/types";
import { resolveProbeThrustVisual } from "./probe-thrust";

const maneuverEvents: ManeuverEvent[] = [
  {
    type: "TCM",
    startEpoch: "2026-01-02T00:00:00.000Z",
    durationSeconds: 3600,
    thrustDirection: "prograde",
    deltaVEstimateKmPerS: 0.002,
    propellantUsedKg: 1.2,
    massBeforeKg: 1800,
    massAfterKg: 1798.8,
  },
];

describe("resolveProbeThrustVisual", () => {
  it("keeps the engine off during cruise away from any maneuver window", () => {
    expect(resolveProbeThrustVisual("2026-01-01T12:00:00.000Z", maneuverEvents)).toEqual({
      engineGlowIntensity: 0,
      streakOpacity: 0,
    });
  });

  it("shows full thrust while a maneuver is active", () => {
    expect(resolveProbeThrustVisual("2026-01-02T00:30:00.000Z", maneuverEvents)).toEqual({
      engineGlowIntensity: 1.15,
      streakOpacity: 0.34,
    });
  });

  it("fades the engine down right after the maneuver ends", () => {
    const visual = resolveProbeThrustVisual("2026-01-02T01:02:30.000Z", maneuverEvents);

    expect(visual.engineGlowIntensity).toBeGreaterThan(0);
    expect(visual.engineGlowIntensity).toBeLessThan(1.15);
    expect(visual.streakOpacity).toBeGreaterThan(0);
    expect(visual.streakOpacity).toBeLessThan(0.34);
  });
});
