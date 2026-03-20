import type { ScenePoint, TrajectorySample } from "../../mission/types";
import { scaleDistanceKm } from "./scale";

export function toScenePoints(samples: TrajectorySample[]): ScenePoint[] {
  return samples.map((sample) => ({
    x: scaleDistanceKm(sample.positionKm[0]),
    y: scaleDistanceKm(sample.positionKm[1]),
    z: scaleDistanceKm(sample.positionKm[2])
  }));
}

export function interpolateTrajectorySample(
  current: TrajectorySample,
  next: TrajectorySample | undefined,
  alpha: number,
): TrajectorySample {
  if (!next) {
    return current;
  }

  const t = Math.min(Math.max(alpha, 0), 1);
  return {
    epochSeconds: lerp(current.epochSeconds, next.epochSeconds, t),
    positionKm: [
      lerp(current.positionKm[0], next.positionKm[0], t),
      lerp(current.positionKm[1], next.positionKm[1], t),
      lerp(current.positionKm[2], next.positionKm[2], t),
    ],
    velocityKmPerSec: [
      lerp(current.velocityKmPerSec[0], next.velocityKmPerSec[0], t),
      lerp(current.velocityKmPerSec[1], next.velocityKmPerSec[1], t),
      lerp(current.velocityKmPerSec[2], next.velocityKmPerSec[2], t),
    ],
    massKg:
      current.massKg != null && next.massKg != null
        ? lerp(current.massKg, next.massKg, t)
        : current.massKg ?? next.massKg,
  };
}

function lerp(current: number, next: number, alpha: number) {
  return current + (next - current) * alpha;
}
