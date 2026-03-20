import type { BodyState, ClosestApproach, MissionSegment, TrajectorySample } from "../../mission/types";
import { resolveProbeProximityState, type ProbeSceneMode } from "./proximity";

export type ProbeCameraView = {
  mode: ProbeSceneMode;
  focusBodyId: string | null;
  lookDirection: [number, number, number];
  cameraOffsetKm: [number, number, number];
  fovDeg: number;
  focusBodyScale: number;
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
      cameraOffsetKm: [-7_000, 1_800, 3_600],
      fovDeg: 40,
      focusBodyScale: 2.1,
    };
  }

  if (proximity.mode === "approach-emphasis") {
    return {
      mode: proximity.mode,
      focusBodyId: proximity.focusBodyId,
      lookDirection,
      cameraOffsetKm: [-12_000, 3_000, 0],
      fovDeg: 50,
      focusBodyScale: 1.45,
    };
  }

  return {
    mode: "cruise-follow",
    focusBodyId: proximity.focusBodyId,
    lookDirection,
    cameraOffsetKm: [-18_000, 4_500, 0],
    fovDeg: 58,
    focusBodyScale: 1,
  };
}

function normalizeVector([x, y, z]: [number, number, number]): [number, number, number] {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (magnitude <= 0) {
    return [0, 1, 0];
  }

  return [x / magnitude, y / magnitude, z / magnitude];
}
