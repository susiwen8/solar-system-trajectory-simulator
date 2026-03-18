import type { ScenePoint, TrajectorySample } from "../../mission/types";
import { scaleDistanceKm } from "./scale";

export function toScenePoints(samples: TrajectorySample[]): ScenePoint[] {
  return samples.map((sample) => ({
    x: scaleDistanceKm(sample.positionKm[0]),
    y: scaleDistanceKm(sample.positionKm[1]),
    z: scaleDistanceKm(sample.positionKm[2])
  }));
}
