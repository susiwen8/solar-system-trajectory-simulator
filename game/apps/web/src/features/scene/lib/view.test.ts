import { describe, expect, it } from "vitest";

import type { BodyState, TrajectorySample } from "../../mission/types";
import { computeBirdsEyeFrame } from "./view";

describe("computeBirdsEyeFrame", () => {
  it("keeps a sun-centered bird's-eye frame while expanding to fit the trajectory", () => {
    const samples: TrajectorySample[] = [
      {
        epochSeconds: 0,
        positionKm: [149597870.7, 0, 0],
        velocityKmPerSec: [0, 29.78, 0],
      },
      {
        epochSeconds: 21600,
        positionKm: [149500000, 643248, 0],
        velocityKmPerSec: [-0.1, 29.77, 0],
      },
      {
        epochSeconds: 43200,
        positionKm: [149250000, 1286496, 0],
        velocityKmPerSec: [-0.2, 29.74, 0],
      },
    ];

    const bodies: BodyState[] = [
      {
        bodyId: "sun",
        epoch: "2026-01-01T00:00:00Z",
        positionKm: [0, 0, 0],
        velocityKmPerSec: [0, 0, 0],
        muKm3PerS2: 132712440018,
        sourceName: "keplerian-elements",
      },
    ];

    const frame = computeBirdsEyeFrame(samples, bodies);

    expect(frame.center.x).toBe(0);
    expect(frame.center.z).toBe(0);
    expect(frame.halfSpan).toBeGreaterThan(100);
    expect(frame.halfSpan).toBeLessThan(130);
  });
});
