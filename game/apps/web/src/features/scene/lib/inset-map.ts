import type { BodyState, ClosestApproach, FlybyEvent, TrajectorySample } from "../../mission/types";

export type InsetMapPoint = {
  x: number;
  y: number;
};

export type InsetMapBodyPoint = InsetMapPoint & {
  bodyId: string;
};

export type InsetMapModel = {
  pathPoints: InsetMapPoint[];
  currentProbePoint: InsetMapPoint;
  targetBody: InsetMapBodyPoint | null;
  highlightBody: InsetMapBodyPoint | null;
  visibleBodies: InsetMapBodyPoint[];
  viewBox: {
    width: number;
    height: number;
  };
};

export type BuildInsetMapModelInput = {
  samples: TrajectorySample[];
  bodies: BodyState[];
  closestApproach: ClosestApproach;
  selectedSampleIndex: number;
  flybyEvents: FlybyEvent[];
};

const VIEWBOX = { width: 220, height: 220 };
const PADDING = 18;

export function buildInsetMapModel({
  samples,
  bodies,
  closestApproach,
  selectedSampleIndex,
  flybyEvents,
}: BuildInsetMapModelInput): InsetMapModel {
  const flybyBodyId = flybyEvents[0]?.bodyId ?? null;
  const flybyBodies = flybyEvents.map((event) => ({
    bodyId: event.bodyId,
    epoch: event.epoch,
    positionKm: event.positionKm,
    velocityKmPerSec: [0, 0, 0] as [number, number, number],
    muKm3PerS2: 0,
    sourceName: "flyby-event",
  }));
  const relevantBodies = uniqueBodies(
    [...bodies, ...flybyBodies].filter(
      (body) => body.bodyId === closestApproach.bodyId || body.bodyId === flybyBodyId || body.bodyId === "earth",
    ),
  );
  const points = [
    ...samples.map((sample) => sample.positionKm),
    ...relevantBodies.map((body) => body.positionKm),
    [0, 0, 0] as [number, number, number],
  ];

  const { minX, maxX, minY, maxY } = getBounds(points);
  const safeIndex = Math.min(Math.max(selectedSampleIndex, 0), Math.max(samples.length - 1, 0));
  const pathPoints = samples.map((sample) => projectPoint(sample.positionKm, minX, maxX, minY, maxY));
  const currentProbePoint = pathPoints[safeIndex] ?? projectPoint([0, 0, 0], minX, maxX, minY, maxY);
  const visibleBodies = relevantBodies.map((body) => ({
    bodyId: body.bodyId,
    ...projectPoint(body.positionKm, minX, maxX, minY, maxY),
  }));

  return {
    pathPoints,
    currentProbePoint,
    targetBody: visibleBodies.find((body) => body.bodyId === closestApproach.bodyId) ?? null,
    highlightBody: flybyBodyId ? visibleBodies.find((body) => body.bodyId === flybyBodyId) ?? null : null,
    visibleBodies,
    viewBox: VIEWBOX,
  };
}

function projectPoint(
  [xKm, yKm]: [number, number, number],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): InsetMapPoint {
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  return {
    x: PADDING + ((xKm - minX) / width) * (VIEWBOX.width - PADDING * 2),
    y: VIEWBOX.height - PADDING - ((yKm - minY) / height) * (VIEWBOX.height - PADDING * 2),
  };
}

function getBounds(points: Array<[number, number, number]>) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function uniqueBodies(bodies: BodyState[]) {
  return bodies.filter((body, index) => bodies.findIndex((candidate) => candidate.bodyId === body.bodyId) === index);
}
