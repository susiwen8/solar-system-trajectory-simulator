import type {
  NavigationEvent,
  NavigationTelemetry,
  TrajectoryResult,
  TrajectorySample,
} from "../../mission/types";

export type NavigationHudSnapshot = {
  mode: "nominal" | "dispersed";
  predictedMissKm: number | null;
  positionDeviationKm: number | null;
  velocityDeviationKmPerS: number | null;
  correctionStatus: "within-thresholds" | "tcm-triggered" | "tcm-executed";
};

export type NavigationMarker = {
  event: NavigationEvent;
  sample: TrajectorySample;
};

export type NavigationVisuals = {
  nominalPath: TrajectorySample[];
  dispersedPath: TrajectorySample[];
  tcmMarkers: NavigationMarker[];
  hud: NavigationHudSnapshot | null;
};

export function buildNavigationVisuals(
  result: TrajectoryResult,
  selectedSampleIndex: number,
  launchEpoch: string | null,
): NavigationVisuals {
  const telemetry = result.navigationTelemetry;
  if (!telemetry?.enabled) {
    return {
      nominalPath: [],
      dispersedPath: result.samples,
      tcmMarkers: [],
      hud: null,
    };
  }

  const activeSample = result.samples[Math.min(selectedSampleIndex, Math.max(result.samples.length - 1, 0))];
  const activeEpochSeconds = activeSample?.epochSeconds ?? 0;
  const tcmMarkers = telemetry.navigationEvents
    .filter((event) => event.type === "tcmExecuted")
    .map((event) => resolveMarker(event, telemetry, result, launchEpoch))
    .filter((marker): marker is NavigationMarker => marker != null);
  const hud = buildNavigationHudSnapshot(telemetry, activeEpochSeconds, launchEpoch);

  return {
    nominalPath: telemetry.nominalSamples,
    dispersedPath: result.samples,
    tcmMarkers,
    hud,
  };
}

function resolveMarker(
  event: NavigationEvent,
  telemetry: NavigationTelemetry,
  result: TrajectoryResult,
  launchEpoch: string | null,
): NavigationMarker | null {
  const targetEpochSeconds = resolveEventEpochSeconds(event, launchEpoch);
  const sample = findClosestSample(telemetry.dispersedSamples.length ? telemetry.dispersedSamples : result.samples, targetEpochSeconds);
  if (!sample) {
    return null;
  }
  return { event, sample };
}

function buildNavigationHudSnapshot(
  telemetry: NavigationTelemetry,
  activeEpochSeconds: number,
  launchEpoch: string | null,
): NavigationHudSnapshot {
  const relevantEvent = telemetry.navigationEvents
    .filter((event) => resolveEventEpochSeconds(event, launchEpoch) <= activeEpochSeconds)
    .sort((left, right) => resolveEventEpochSeconds(left, launchEpoch) - resolveEventEpochSeconds(right, launchEpoch))
    .pop();

  if (!relevantEvent) {
    return {
      mode: "dispersed",
      predictedMissKm: telemetry.finalPredictedMissKm ?? null,
      positionDeviationKm: null,
      velocityDeviationKmPerS: null,
      correctionStatus: "within-thresholds",
    };
  }

  return {
    mode: "dispersed",
    predictedMissKm: relevantEvent.predictedMissAfterKm ?? relevantEvent.predictedMissBeforeKm ?? telemetry.finalPredictedMissKm ?? null,
    positionDeviationKm: relevantEvent.positionDeviationAfterKm ?? relevantEvent.positionDeviationBeforeKm ?? null,
    velocityDeviationKmPerS:
      relevantEvent.velocityDeviationAfterKmPerS ?? relevantEvent.velocityDeviationBeforeKmPerS ?? null,
    correctionStatus:
      relevantEvent.type === "tcmTriggered"
        ? "tcm-triggered"
        : relevantEvent.type === "tcmExecuted"
          ? "tcm-executed"
          : "within-thresholds",
  };
}

function resolveEventEpochSeconds(event: NavigationEvent, launchEpoch: string | null): number {
  if (!launchEpoch) {
    return Number.POSITIVE_INFINITY;
  }
  return (Date.parse(event.epoch) - Date.parse(launchEpoch)) / 1000;
}

function findClosestSample(samples: TrajectorySample[], epochSeconds: number): TrajectorySample | null {
  if (!samples.length || !Number.isFinite(epochSeconds)) {
    return null;
  }

  return samples.reduce<TrajectorySample | null>((closest, sample) => {
    if (!closest) {
      return sample;
    }
    return Math.abs(sample.epochSeconds - epochSeconds) < Math.abs(closest.epochSeconds - epochSeconds)
      ? sample
      : closest;
  }, null);
}
