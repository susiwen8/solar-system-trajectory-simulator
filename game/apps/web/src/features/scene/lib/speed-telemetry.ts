import type { TrajectorySample } from "../../mission/types";

export type SpeedTelemetryMode = "speed" | "vx" | "vy" | "vz";

export type SpeedTelemetry = {
  currentValue: number;
  previousValue: number | null;
  deltaValue: number;
  points: number[];
};

const COMPONENT_INDEX: Record<Exclude<SpeedTelemetryMode, "speed">, number> = {
  vx: 0,
  vy: 1,
  vz: 2,
};

export function buildSpeedTelemetry(
  samples: TrajectorySample[],
  selectedSampleIndex: number,
  mode: SpeedTelemetryMode,
): SpeedTelemetry {
  if (samples.length === 0) {
    return {
      currentValue: 0,
      previousValue: null,
      deltaValue: 0,
      points: [],
    };
  }

  const points = samples.map((sample) => valueForMode(sample, mode));
  const safeIndex = clampIndex(selectedSampleIndex, points.length);
  const currentValue = points[safeIndex];
  const previousValue = safeIndex > 0 ? points[safeIndex - 1] : null;

  return {
    currentValue,
    previousValue,
    deltaValue: currentValue - (previousValue ?? currentValue),
    points,
  };
}

export function formatSpeedValue(value: number) {
  return `${value.toFixed(2)} km/s`;
}

export function formatDeltaSpeed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} km/s`;
}

function valueForMode(sample: TrajectorySample, mode: SpeedTelemetryMode) {
  const [vx, vy, vz] = sample.velocityKmPerSec;
  if (mode === "speed") {
    return Math.sqrt(vx * vx + vy * vy + vz * vz);
  }

  return sample.velocityKmPerSec[COMPONENT_INDEX[mode]];
}

function clampIndex(index: number, length: number) {
  if (length <= 1) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}
