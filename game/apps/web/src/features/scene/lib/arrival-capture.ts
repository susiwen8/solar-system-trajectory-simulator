import type { MissionSegment, TrajectoryResult } from "../../mission/types";
import { scaleDistanceKm } from "./scale";

export type ArrivalCapturePoint = [number, number, number];

export type ArrivalCaptureModel = {
  bodyId: string;
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
