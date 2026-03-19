import type { ManeuverEvent } from "../../mission/types";

export type ProbeThrustVisual = {
  engineGlowIntensity: number;
  streakOpacity: number;
};

export type ProbeThrustState = ProbeThrustVisual & {
  thrustDirection: ManeuverEvent["thrustDirection"] | null;
};

const MAX_ENGINE_GLOW_INTENSITY = 1.15;
const MAX_STREAK_OPACITY = 0.34;

export function resolveProbeThrustVisual(
  currentEpoch: string | null,
  maneuverEvents: ManeuverEvent[] | undefined,
): ProbeThrustVisual {
  const thrustState = resolveProbeThrustState(currentEpoch, maneuverEvents);

  return {
    engineGlowIntensity: thrustState.engineGlowIntensity,
    streakOpacity: thrustState.streakOpacity,
  };
}

export function resolveProbeThrustState(
  currentEpoch: string | null,
  maneuverEvents: ManeuverEvent[] | undefined,
): ProbeThrustState {
  if (!currentEpoch || !maneuverEvents?.length) {
    return {
      engineGlowIntensity: 0,
      streakOpacity: 0,
      thrustDirection: null,
    };
  }

  const currentTimeMs = new Date(currentEpoch).getTime();
  let strongestLevel = 0;
  let strongestDirection: ManeuverEvent["thrustDirection"] | null = null;

  for (const event of maneuverEvents) {
    const startMs = new Date(event.startEpoch).getTime();
    const endMs = startMs + event.durationSeconds * 1000;
    const fadeMs = resolveFadeDurationMs(event.durationSeconds);
    const level = resolveEventThrustLevel(currentTimeMs, startMs, endMs, fadeMs);
    if (level > strongestLevel) {
      strongestLevel = level;
      strongestDirection = event.thrustDirection;
    }
  }

  return {
    engineGlowIntensity: MAX_ENGINE_GLOW_INTENSITY * strongestLevel,
    streakOpacity: MAX_STREAK_OPACITY * strongestLevel,
    thrustDirection: strongestDirection,
  };
}

function resolveFadeDurationMs(durationSeconds: number) {
  const clampedFadeSeconds = Math.min(Math.max(durationSeconds * 0.15, 30), 300);
  return clampedFadeSeconds * 1000;
}

function resolveEventThrustLevel(currentTimeMs: number, startMs: number, endMs: number, fadeMs: number) {
  if (currentTimeMs >= startMs && currentTimeMs <= endMs) {
    return 1;
  }

  if (currentTimeMs >= startMs - fadeMs && currentTimeMs < startMs) {
    return (currentTimeMs - (startMs - fadeMs)) / fadeMs;
  }

  if (currentTimeMs > endMs && currentTimeMs <= endMs + fadeMs) {
    return 1 - (currentTimeMs - endMs) / fadeMs;
  }

  return 0;
}
