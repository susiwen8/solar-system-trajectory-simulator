import type { BodyState, ClosestApproach, FlybyEvent, TrajectorySample } from "../../mission/types";

export type InsetMapPoint = {
  x: number;
  y: number;
};

export type InsetMapBodyPoint = InsetMapPoint & {
  bodyId: string;
};

export type InsetMapOrbitPath = {
  bodyId: string;
  points: InsetMapPoint[];
};

export type InsetMapModel = {
  orbitPaths: InsetMapOrbitPath[];
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
const ORBIT_SEGMENTS = 96;

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
  const orbitDefinitions = relevantBodies.map((body) => ({
    bodyId: body.bodyId,
    radiusKm: Math.hypot(body.positionKm[0], body.positionKm[1]),
  }));
  const maxRadiusKm = Math.max(
    1,
    ...samples.map((sample) => Math.hypot(sample.positionKm[0], sample.positionKm[1])),
    ...relevantBodies.map((body) => Math.hypot(body.positionKm[0], body.positionKm[1])),
    ...orbitDefinitions.map((orbit) => orbit.radiusKm),
  );

  const safeIndex = Math.min(Math.max(selectedSampleIndex, 0), Math.max(samples.length - 1, 0));
  const pathPoints = samples.map((sample) => projectPoint(sample.positionKm, maxRadiusKm));
  const currentProbePoint = pathPoints[safeIndex] ?? projectPoint([0, 0, 0], maxRadiusKm);
  const visibleBodies = relevantBodies.map((body) => ({
    bodyId: body.bodyId,
    ...projectPoint(body.positionKm, maxRadiusKm),
  }));
  const orbitPaths = orbitDefinitions.map((orbit) => ({
    bodyId: orbit.bodyId,
    points: buildCircularOrbitPoints(orbit.radiusKm).map((point) => projectPoint(point, maxRadiusKm)),
  }));

  return {
    orbitPaths,
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
  maxRadiusKm: number,
): InsetMapPoint {
  const drawableRadius = (Math.min(VIEWBOX.width, VIEWBOX.height) - PADDING * 2) / 2;
  const scale = drawableRadius / Math.max(maxRadiusKm, 1);
  const centerX = VIEWBOX.width / 2;
  const centerY = VIEWBOX.height / 2;
  return {
    x: centerX + xKm * scale,
    y: centerY - yKm * scale,
  };
}

function buildCircularOrbitPoints(radiusKm: number): Array<[number, number, number]> {
  return Array.from({ length: ORBIT_SEGMENTS + 1 }, (_, index) => {
    const theta = (index / ORBIT_SEGMENTS) * Math.PI * 2;
    return [
      Math.cos(theta) * radiusKm,
      Math.sin(theta) * radiusKm,
      0,
    ] as [number, number, number];
  });
}

function uniqueBodies(bodies: BodyState[]) {
  return bodies.filter((body, index) => bodies.findIndex((candidate) => candidate.bodyId === body.bodyId) === index);
}
