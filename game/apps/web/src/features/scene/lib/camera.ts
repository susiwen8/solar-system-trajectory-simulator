import type { BodyState, ClosestApproach, MissionSegment, TrajectorySample } from "../../mission/types";
import { resolveProbeProximityState, type ProbeSceneMode } from "./proximity";

export type ProbeCameraView = {
  mode: ProbeSceneMode;
  focusBodyId: string | null;
  lookDirection: [number, number, number];
  cameraOffsetKm: [number, number, number];
  fovDeg: number;
};

export type ComputeProbeCameraViewInput = {
  sample: TrajectorySample;
  bodies: BodyState[];
  closestApproach: ClosestApproach;
  activeSegment: MissionSegment | null;
};

export function computeProbeCameraView(input: ComputeProbeCameraViewInput): ProbeCameraView {
  const proximity = resolveProbeProximityState(input);
  const lookDirection = normalizeVector(input.sample.velocityKmPerSec);

  if (proximity.mode === "flyby-emphasis") {
    return {
      mode: proximity.mode,
      focusBodyId: proximity.focusBodyId,
      lookDirection,
      cameraOffsetKm: [-12_000, 4_000, 0],
      fovDeg: 38,
    };
  }

  if (proximity.mode === "approach-emphasis") {
    return {
      mode: proximity.mode,
      focusBodyId: proximity.focusBodyId,
      lookDirection,
      cameraOffsetKm: [-18_000, 6_000, 0],
      fovDeg: 48,
    };
  }

  return {
    mode: "cruise-follow",
    focusBodyId: proximity.focusBodyId,
    lookDirection,
    cameraOffsetKm: [-32_000, 10_000, 0],
    fovDeg: 58,
  };
}

function normalizeVector([x, y, z]: [number, number, number]): [number, number, number] {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (magnitude <= 0) {
    return [0, 1, 0];
  }

  return [x / magnitude, y / magnitude, z / magnitude];
}
