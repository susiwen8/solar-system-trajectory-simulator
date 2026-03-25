import type { TrajectorySample } from "../../mission/types";
import { scaleDistanceKm } from "./scale";

type EncounterAdjustmentOptions = {
  bodyPositionKm: [number, number, number];
  encounterIndex: number;
  minSceneRadius: number;
  maxSceneRadius?: number;
  halfWindow?: number;
};

const DEFAULT_HALF_WINDOW = 3;
const XZ_SCENE_SCALE = 1.8;
const Y_SCENE_SCALE = 0.8;
const CONTROL_RADIUS_SCALE = 0.78;
const CLEARANCE_EPSILON_SCALE = 1.002;

export function buildEncounterAdjustedSamples(
  samples: TrajectorySample[],
  options: EncounterAdjustmentOptions,
): TrajectorySample[] {
  if (!samples.length || options.encounterIndex < 0 || options.encounterIndex >= samples.length) {
    return samples;
  }

  const halfWindow = Math.max(options.halfWindow ?? DEFAULT_HALF_WINDOW, 1);
  const startIndex = Math.max(0, options.encounterIndex - halfWindow);
  const endIndex = Math.min(samples.length - 1, options.encounterIndex + halfWindow);
  if (startIndex === endIndex) {
    return samples;
  }

  const startPosition = enforceMinimumEncounterClearance(
    samples[startIndex].positionKm,
    options.bodyPositionKm,
    options.minSceneRadius,
  );
  const endPosition = enforceMinimumEncounterClearance(
    samples[endIndex].positionKm,
    options.bodyPositionKm,
    options.minSceneRadius,
  );
  const startRelative = subtractPosition(startPosition, options.bodyPositionKm);
  const endRelative = subtractPosition(endPosition, options.bodyPositionKm);
  const controlRelative = buildEncounterControlPoint(startRelative, endRelative, options.minSceneRadius);

  return samples.map((sample, index) => {
    if (index < startIndex || index > endIndex) {
      return sample;
    }

    if (index === startIndex) {
      return { ...sample, positionKm: startPosition };
    }
    if (index === endIndex) {
      return { ...sample, positionKm: endPosition };
    }

    const t = (index - startIndex) / Math.max(endIndex - startIndex, 1);
    const relative = quadraticBezier(startRelative, controlRelative, endRelative, t);
    const candidate = addPosition(options.bodyPositionKm, relative);
    return {
      ...sample,
      positionKm: enforceMinimumEncounterClearance(
        candidate,
        options.bodyPositionKm,
        options.minSceneRadius,
      ),
    };
  });
}

export function buildStableEncounterAdjustedSamples(
  samples: TrajectorySample[],
  visibleCount: number,
  options: EncounterAdjustmentOptions,
): TrajectorySample[] {
  const clampedVisibleCount = Math.max(0, Math.min(visibleCount, samples.length));
  if (clampedVisibleCount === 0) {
    return [];
  }

  return buildEncounterAdjustedSamples(samples, options).slice(0, clampedVisibleCount);
}

export function enforceMinimumEncounterClearance(
  positionKm: [number, number, number],
  bodyPositionKm: [number, number, number],
  minSceneRadius: number,
  maxSceneRadius?: number,
): [number, number, number] {
  const relative = subtractPosition(positionKm, bodyPositionKm);
  const currentSceneRadius = measureEncounterSceneRadius(positionKm, bodyPositionKm);
  if (currentSceneRadius <= 1e-9) {
    return positionKm;
  }

  if (currentSceneRadius < minSceneRadius) {
    const scaleFactor = (minSceneRadius / currentSceneRadius) * CLEARANCE_EPSILON_SCALE;
    return addPosition(bodyPositionKm, scalePosition(relative, scaleFactor));
  }

  if (maxSceneRadius != null && currentSceneRadius > maxSceneRadius) {
    const scaleFactor = maxSceneRadius / currentSceneRadius;
    return addPosition(bodyPositionKm, scalePosition(relative, scaleFactor));
  }

  return positionKm;
}

export function measureEncounterSceneRadius(
  positionKm: [number, number, number],
  bodyPositionKm: [number, number, number],
): number {
  const [dx, dy, dz] = subtractPosition(positionKm, bodyPositionKm);
  return Math.hypot(
    scaleDistanceKm(dx) * XZ_SCENE_SCALE,
    scaleDistanceKm(dz) * Y_SCENE_SCALE,
    scaleDistanceKm(dy) * XZ_SCENE_SCALE,
  );
}

function buildEncounterControlPoint(
  startRelative: [number, number, number],
  endRelative: [number, number, number],
  minSceneRadius: number,
): [number, number, number] {
  const startDirection = normalizeOrFallback(startRelative, [1, 0, 0]);
  const endDirection = normalizeOrFallback(endRelative, [-1, 0, 0]);
  let controlDirection = normalizeOrFallback(
    addPosition(startDirection, endDirection),
    orthogonalDirection(startDirection),
  );
  if (vectorLength(controlDirection) <= 1e-9) {
    controlDirection = orthogonalDirection(startDirection);
  }

  const controlRadius =
    Math.max(vectorLength(startRelative), vectorLength(endRelative), 1) * CONTROL_RADIUS_SCALE;
  const candidate = scalePosition(controlDirection, controlRadius);
  const candidateSceneRadius = measureEncounterSceneRadius(candidate, [0, 0, 0]);
  if (candidateSceneRadius >= minSceneRadius) {
    return candidate;
  }

  return scalePosition(candidate, (minSceneRadius / Math.max(candidateSceneRadius, 1e-9)) * CLEARANCE_EPSILON_SCALE);
}

function quadraticBezier(
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
  t: number,
): [number, number, number] {
  const oneMinusT = 1 - t;
  return [
    oneMinusT * oneMinusT * start[0] + 2 * oneMinusT * t * control[0] + t * t * end[0],
    oneMinusT * oneMinusT * start[1] + 2 * oneMinusT * t * control[1] + t * t * end[1],
    oneMinusT * oneMinusT * start[2] + 2 * oneMinusT * t * control[2] + t * t * end[2],
  ];
}

function orthogonalDirection(vector: [number, number, number]): [number, number, number] {
  const axis = Math.abs(vector[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0] as [number, number, number];
  const cross = crossProduct(vector, axis);
  return normalizeOrFallback(cross, [0, 0, 1]);
}

function normalizeOrFallback(
  vector: [number, number, number],
  fallback: [number, number, number],
): [number, number, number] {
  const length = vectorLength(vector);
  if (length <= 1e-9) {
    return fallback;
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function vectorLength([x, y, z]: [number, number, number]): number {
  return Math.hypot(x, y, z);
}

function crossProduct(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
}

function subtractPosition(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [ax - bx, ay - by, az - bz];
}

function addPosition(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [ax + bx, ay + by, az + bz];
}

function scalePosition(
  [x, y, z]: [number, number, number],
  factor: number,
): [number, number, number] {
  return [x * factor, y * factor, z * factor];
}
