import type { BodyState, TrajectorySample } from "../../mission/types";
import { scaleOverviewDistanceKm } from "./scale";

export type BirdsEyeFrame = {
  center: {
    x: number;
    z: number;
  };
  halfSpan: number;
};

export function computeBirdsEyeFrame(samples: TrajectorySample[], bodies: BodyState[]): BirdsEyeFrame {
  const samplePoints = samples.map((sample) => ({
    x: scaleOverviewDistanceKm(sample.positionKm[0]) * 1.8,
    z: scaleOverviewDistanceKm(sample.positionKm[1]) * 1.8,
  }));
  const sampleMaxRadius = Math.max(
    ...samplePoints.map((point) => Math.sqrt(point.x * point.x + point.z * point.z)),
    48,
  );
  const points = [
    ...samplePoints,
    ...bodies
      .map((body) => ({
        x: scaleOverviewDistanceKm(body.positionKm[0]) * 1.8,
        z: scaleOverviewDistanceKm(body.positionKm[1]) * 1.8,
      }))
      .filter((point) => Math.sqrt(point.x * point.x + point.z * point.z) <= sampleMaxRadius * 1.2),
  ];

  if (points.length === 0) {
    return {
      center: { x: 0, z: 0 },
      halfSpan: 60,
    };
  }

  const maxRadius = Math.max(...points.map((point) => Math.sqrt(point.x * point.x + point.z * point.z)), 48);

  return {
    center: {
      x: 0,
      z: 0,
    },
    halfSpan: maxRadius + 12,
  };
}
