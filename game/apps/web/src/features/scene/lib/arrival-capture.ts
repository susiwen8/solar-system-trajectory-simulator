import type { MissionSegment, TrajectoryResult } from "../../mission/types";
import { scaleDistanceKm } from "./scale";

export type ArrivalCapturePoint = [number, number, number];

export type ArrivalCaptureModel = {
  bodyId: string;
  durationSeconds: number | null;
  pathPoints: ArrivalCapturePoint[];
  referenceFrame: string;
  source: "segment-samples" | "synthetic-orbit-summary";
};

const CAPTURE_SEGMENT_TYPES = new Set(["parkingOrbit", "arrivalCapture", "scienceOrbit"]);
const NON_CAPTURE_SEGMENT_TYPES = new Set(["gravityAssistFlyby", "flybyEncounter"]);
const ORBIT_POINT_COUNT = 72;
const MIN_CAPTURE_CLEARANCE_MULTIPLIER = 1.28;

export function buildArrivalCaptureModel(result: TrajectoryResult): ArrivalCaptureModel | null {
  const segment = findArrivalCaptureSegment(result.segments ?? [], result.closestApproach.bodyId);
  if (!segment) {
    return null;
  }

  const bodyId = resolveSegmentBodyId(segment, result.closestApproach.bodyId);
  if (!bodyId) {
    return null;
  }

  if (segment.samples.length > 1 && isTargetCenteredSegment(segment, bodyId)) {
    return {
      bodyId,
      durationSeconds: resolveSegmentDurationSeconds(segment),
      pathPoints: segment.samples.map((sample) => sample.positionKm),
      referenceFrame: segment.initialState?.referenceFrame ?? segment.finalState?.referenceFrame ?? "unknown",
      source: "segment-samples",
    };
  }

  if (!segment.orbitSummary?.isBound) {
    return null;
  }

  return {
    bodyId,
    durationSeconds: null,
    pathPoints: buildSyntheticOrbitPath({
      periapsisKm: segment.orbitSummary.periapsisKm,
      apoapsisKm: segment.orbitSummary.apoapsisKm,
      inclinationDeg: segment.orbitSummary.inclinationDeg,
    }),
    referenceFrame: segment.finalState?.referenceFrame ?? segment.initialState?.referenceFrame ?? "unknown",
    source: "synthetic-orbit-summary",
  };
}

export function findArrivalCaptureSegment(segments: MissionSegment[], fallbackBodyId?: string): MissionSegment | null {
  for (const segment of [...segments].reverse()) {
    if (NON_CAPTURE_SEGMENT_TYPES.has(segment.segmentType)) {
      continue;
    }

    if (CAPTURE_SEGMENT_TYPES.has(segment.segmentType) && segment.orbitSummary?.isBound) {
      return segment;
    }

    const segmentBodyId = resolveSegmentBodyId(segment, fallbackBodyId ?? null);
    if (segmentBodyId && segment.orbitSummary?.isBound && segmentBodyId === fallbackBodyId) {
      return segment;
    }
  }

  return null;
}

export function buildSyntheticOrbitPath({
  periapsisKm,
  apoapsisKm,
  inclinationDeg,
}: {
  periapsisKm: number;
  apoapsisKm: number;
  inclinationDeg: number;
}): ArrivalCapturePoint[] {
  const semiMajorAxisKm = Math.max((periapsisKm + apoapsisKm) / 2, 1);
  const eccentricity = Math.max(0, Math.min((apoapsisKm - periapsisKm) / (apoapsisKm + periapsisKm), 0.98));
  const semiMinorAxisKm = semiMajorAxisKm * Math.sqrt(1 - eccentricity ** 2);
  const inclinationRad = (inclinationDeg * Math.PI) / 180;

  const points: ArrivalCapturePoint[] = [];
  for (let index = 0; index < ORBIT_POINT_COUNT; index += 1) {
    const theta = (index / ORBIT_POINT_COUNT) * Math.PI * 2;
    const x = semiMajorAxisKm * Math.cos(theta);
    const orbitalPlaneZ = semiMinorAxisKm * Math.sin(theta);
    const y = orbitalPlaneZ * Math.sin(inclinationRad);
    const z = orbitalPlaneZ * Math.cos(inclinationRad);
    points.push([x, y, z]);
  }

  if (points.length > 0) {
    points.push(points[0]);
  }

  return points;
}

export function buildDisplayCapturePathPoints(
  pathPoints: ArrivalCapturePoint[],
  bodyVisualRadius: number,
): ArrivalCapturePoint[] {
  if (pathPoints.length === 0) {
    return pathPoints;
  }

  const requiredSceneRadius = bodyVisualRadius * MIN_CAPTURE_CLEARANCE_MULTIPLIER;
  const currentMinimumSceneRadius = pathPoints.reduce((minimum, point) => {
    const pointRadius = measureSceneRadius(point);
    return pointRadius > 0 ? Math.min(minimum, pointRadius) : minimum;
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(currentMinimumSceneRadius) || currentMinimumSceneRadius <= 0) {
    return pathPoints;
  }

  const scaleFactor = Math.max(1, requiredSceneRadius / currentMinimumSceneRadius);
  if (scaleFactor === 1) {
    return pathPoints;
  }

  return pathPoints.map(([x, y, z]) => [x * scaleFactor, y * scaleFactor, z * scaleFactor]);
}

export function estimateArrivalCaptureOrbitDurationSeconds(
  pathPoints: ArrivalCapturePoint[],
  bodyMuKm3PerS2: number,
): number | null {
  if (pathPoints.length < 2 || bodyMuKm3PerS2 <= 0) {
    return null;
  }

  const radii = pathPoints
    .map(([x, y, z]) => Math.hypot(x, y, z))
    .filter((radius) => Number.isFinite(radius) && radius > 0);
  if (radii.length === 0) {
    return null;
  }

  const periapsisKm = Math.min(...radii);
  const apoapsisKm = Math.max(...radii);
  const semiMajorAxisKm = Math.max((periapsisKm + apoapsisKm) / 2, 1);
  return 2 * Math.PI * Math.sqrt((semiMajorAxisKm ** 3) / bodyMuKm3PerS2);
}

export function sampleArrivalCaptureOrbit(
  pathPoints: ArrivalCapturePoint[],
  centerPositionKm: ArrivalCapturePoint,
  progress: number,
): {
  positionKm: ArrivalCapturePoint;
  velocityKmPerSec: ArrivalCapturePoint;
} | null {
  const segmentCount = resolveClosedSegmentCount(pathPoints);
  if (segmentCount < 1) {
    return null;
  }

  const normalizedProgress = ((progress % 1) + 1) % 1;
  const scaledProgress = normalizedProgress * segmentCount;
  const currentIndex = Math.floor(scaledProgress) % segmentCount;
  const nextIndex = (currentIndex + 1) % segmentCount;
  const previousIndex = (currentIndex - 1 + segmentCount) % segmentCount;
  const alpha = scaledProgress - Math.floor(scaledProgress);

  const currentPoint = pathPoints[currentIndex];
  const nextPoint = pathPoints[nextIndex];
  const previousPoint = pathPoints[previousIndex];
  const positionKm = translateCapturePoint(
    interpolateCapturePoint(currentPoint, nextPoint, alpha),
    centerPositionKm,
  );
  const tangent = normalizeCapturePoint([
    nextPoint[0] - previousPoint[0],
    nextPoint[1] - previousPoint[1],
    nextPoint[2] - previousPoint[2],
  ]);

  return {
    positionKm,
    velocityKmPerSec: tangent,
  };
}

function resolveSegmentBodyId(segment: MissionSegment, fallbackBodyId: string | null): string | null {
  return segment.metadata?.bodyId ?? segment.finalState?.referenceBodyId ?? segment.initialState?.referenceBodyId ?? fallbackBodyId;
}

function isTargetCenteredSegment(segment: MissionSegment, bodyId: string): boolean {
  const initialBodyId = segment.initialState?.referenceBodyId;
  const finalBodyId = segment.finalState?.referenceBodyId;
  return initialBodyId === bodyId || finalBodyId === bodyId;
}

function measureSceneRadius([x, y, z]: ArrivalCapturePoint): number {
  return Math.hypot(
    scaleDistanceKm(x) * 1.8,
    scaleDistanceKm(z) * 0.8,
    scaleDistanceKm(y) * 1.8,
  );
}

function resolveSegmentDurationSeconds(segment: MissionSegment): number | null {
  if (segment.samples.length < 2) {
    return null;
  }

  const firstEpochSeconds = segment.samples[0]?.epochSeconds;
  const lastEpochSeconds = segment.samples[segment.samples.length - 1]?.epochSeconds;
  if (typeof firstEpochSeconds !== "number" || typeof lastEpochSeconds !== "number") {
    return null;
  }

  return Math.max(lastEpochSeconds - firstEpochSeconds, 0);
}

function resolveClosedSegmentCount(pathPoints: ArrivalCapturePoint[]) {
  if (pathPoints.length < 2) {
    return 0;
  }

  const firstPoint = pathPoints[0];
  const lastPoint = pathPoints[pathPoints.length - 1];
  const isClosed =
    firstPoint[0] === lastPoint[0] &&
    firstPoint[1] === lastPoint[1] &&
    firstPoint[2] === lastPoint[2];
  return isClosed ? pathPoints.length - 1 : pathPoints.length;
}

function interpolateCapturePoint(
  left: ArrivalCapturePoint,
  right: ArrivalCapturePoint,
  alpha: number,
): ArrivalCapturePoint {
  return [
    left[0] + (right[0] - left[0]) * alpha,
    left[1] + (right[1] - left[1]) * alpha,
    left[2] + (right[2] - left[2]) * alpha,
  ];
}

function normalizeCapturePoint([x, y, z]: ArrivalCapturePoint): ArrivalCapturePoint {
  const length = Math.hypot(x, y, z);
  if (length === 0) {
    return [0, 1, 0];
  }
  return [x / length, y / length, z / length];
}

function translateCapturePoint(
  localPoint: ArrivalCapturePoint,
  centerPositionKm: ArrivalCapturePoint,
): ArrivalCapturePoint {
  return [
    centerPositionKm[0] + localPoint[0],
    centerPositionKm[1] + localPoint[1],
    centerPositionKm[2] + localPoint[2],
  ];
}
