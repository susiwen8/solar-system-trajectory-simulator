export type BodyId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type StateVector = {
  positionKm: [number, number, number];
  velocityKmPerSec: [number, number, number];
};

export type MissionRequest = {
  departureBody: "earth";
  targetBody: Exclude<BodyId, "earth"> | "earth";
  launchEpoch: string;
  initialState: {
    stateVector?: StateVector;
    launchFromBody?: {
      mode: "autoTransfer";
    };
  };
  durationSeconds?: number;
  outputStepSeconds?: number;
};

export type MissionTourRequest = {
  departureBody: "earth";
  requiredVisitBodies: Exclude<BodyId, "earth">[];
  launchEpoch: string;
  maxAssistBodiesPerLeg?: number;
  maxReturnedCandidates?: number;
  allowAssistBodies?: boolean;
  allowRepeatedFlybys?: boolean;
};

export type TrajectorySample = {
  epochSeconds: number;
  positionKm: [number, number, number];
  velocityKmPerSec: [number, number, number];
};

export type ClosestApproach = {
  bodyId: string;
  distanceKm: number;
  epochSeconds: number;
};

export type FlybyEvent = {
  bodyId: string;
  epoch: string;
  positionKm: [number, number, number];
  periapsisAltitudeKm: number;
  turnAngleDeg: number;
  inboundVInfinityKmPerS: number;
  outboundVInfinityKmPerS: number;
};

export type VisitEvent = {
  bodyId: string;
  epoch: string;
  positionKm: [number, number, number];
};

export type MissionLeg = {
  startBody: string;
  endBody: string;
  assistBodies: string[];
  durationSeconds: number;
  deltaVKmPerS: number;
  closestApproachKm: number;
};

export type MissionCandidate = {
  sequenceBodies?: string[];
  visitOrder?: string[];
  fullSequenceBodies?: string[];
  legs?: MissionLeg[];
  visitEvents?: VisitEvent[];
  score: number;
  deltaVKmPerS: number;
  flightTimeSeconds: number;
  samples: TrajectorySample[];
  closestApproach: ClosestApproach;
  warnings: string[];
  flybyEvents: FlybyEvent[];
};

export type TrajectoryResult = {
  referenceFrame: string;
  ephemerisSource: string;
  samples: TrajectorySample[];
  closestApproach: ClosestApproach;
  flightTimeSeconds: number;
  warnings: string[];
  candidates?: MissionCandidate[];
  sequenceBodies?: string[];
  visitOrder?: string[];
  fullSequenceBodies?: string[];
  visitEvents?: VisitEvent[];
  legs?: MissionLeg[];
  score?: number;
  deltaVKmPerS?: number;
  flybyEvents?: FlybyEvent[];
};

export type ScenePoint = {
  x: number;
  y: number;
  z: number;
};

export type BodyState = {
  bodyId: string;
  epoch: string;
  positionKm: [number, number, number];
  velocityKmPerSec: [number, number, number];
  muKm3PerS2: number;
  sourceName: string;
};

export type EphemerisBodiesResponse = {
  referenceFrame: string;
  epoch: string;
  ephemerisSource: string;
  bodies: BodyState[];
};
