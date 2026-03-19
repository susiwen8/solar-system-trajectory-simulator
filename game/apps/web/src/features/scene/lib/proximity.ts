import type { BodyState, ClosestApproach, MissionSegment, TrajectorySample } from "../../mission/types";

export type ProbeSceneMode = "cruise-follow" | "approach-emphasis" | "flyby-emphasis";

export type ProbeSceneContext = {
  sample: TrajectorySample;
  bodies: BodyState[];
  closestApproach: ClosestApproach;
  activeSegment: MissionSegment | null;
};

export type ProbeProximityState = {
  mode: ProbeSceneMode;
  focusBodyId: string | null;
  focusDistanceKm: number | null;
};

const APPROACH_DISTANCE_KM = 1_000_000;

export function resolveProbeProximityState({
  sample,
  bodies,
  closestApproach,
  activeSegment,
}: ProbeSceneContext): ProbeProximityState {
  const flybyBodyId =
    activeSegment?.segmentType === "gravityAssistFlyby" ? activeSegment.metadata?.bodyId ?? activeSegment.initialState.referenceBodyId ?? null : null;

  if (flybyBodyId) {
    return {
      mode: "flyby-emphasis",
      focusBodyId: flybyBodyId,
      focusDistanceKm: distanceToBodyKm(sample, bodies.find((body) => body.bodyId === flybyBodyId) ?? null),
    };
  }

  const focusBodyId = closestApproach.bodyId ?? null;
  const focusBody = bodies.find((body) => body.bodyId === focusBodyId) ?? null;
  const focusDistanceKm = distanceToBodyKm(sample, focusBody);

  if (focusBodyId && (closestApproach.distanceKm <= APPROACH_DISTANCE_KM || (focusDistanceKm ?? Infinity) <= APPROACH_DISTANCE_KM)) {
    return {
      mode: "approach-emphasis",
      focusBodyId,
      focusDistanceKm,
    };
  }

  return {
    mode: "cruise-follow",
    focusBodyId,
    focusDistanceKm,
  };
}

function distanceToBodyKm(sample: TrajectorySample, body: BodyState | null) {
  if (!body) {
    return null;
  }

  const dx = sample.positionKm[0] - body.positionKm[0];
  const dy = sample.positionKm[1] - body.positionKm[1];
  const dz = sample.positionKm[2] - body.positionKm[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
