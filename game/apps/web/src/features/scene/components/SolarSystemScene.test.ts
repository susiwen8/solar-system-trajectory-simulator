import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { TrajectoryResult } from "../../mission/types";
import * as SolarSystemSceneModule from "./SolarSystemScene";

const playbackSamples: TrajectoryResult["samples"] = [
  {
    epochSeconds: 0,
    positionKm: [1, 0, 0],
    velocityKmPerSec: [0, 1, 0],
  },
  {
    epochSeconds: 10,
    positionKm: [2, 0, 0],
    velocityKmPerSec: [0, 1, 0],
  },
];

describe("SolarSystemScene playback visuals", () => {
  it("renders trajectory playback with lines only and no point markers", () => {
    expect("createPlaybackTrajectoryVisuals" in SolarSystemSceneModule).toBe(true);
    if (!("createPlaybackTrajectoryVisuals" in SolarSystemSceneModule)) {
      return;
    }

    const visuals = SolarSystemSceneModule.createPlaybackTrajectoryVisuals(
      playbackSamples,
      null,
      null,
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toBeInstanceOf(THREE.Line);
    expect(visuals.some((visual) => visual instanceof THREE.Points)).toBe(false);
  });
});
