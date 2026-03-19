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
  propulsionConfig?: PropulsionConfig;
};

export type MissionTourRequest = {
  departureBody: "earth";
  requiredVisitBodies: Exclude<BodyId, "earth">[];
  launchEpoch: string;
  maxAssistBodiesPerLeg?: number;
  maxReturnedCandidates?: number;
  allowAssistBodies?: boolean;
  allowRepeatedFlybys?: boolean;
  propulsionConfig?: PropulsionConfig;
};

export type PropulsionConfig = {
  initialMassKg: number;
  propellantMassKg: number;
  maxThrustN: number;
  ispSeconds: number;
};

export type TrajectorySample = {
  epochSeconds: number;
  positionKm: [number, number, number];
  velocityKmPerSec: [number, number, number];
  massKg?: number;
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

export type ManeuverEvent = {
  type: string;
  startEpoch: string;
  durationSeconds: number;
  thrustDirection: string;
  deltaVEstimateKmPerS: number;
  propellantUsedKg: number;
  massBeforeKg: number;
  massAfterKg: number;
};

export type MissionTimelineEvent = {
  id: string;
  type: string;
  epoch: string;
  title: string;
  description: string;
  relatedBody?: string | null;
};

export type MissionPhase = {
  id: string;
  type: string;
  startEpoch: string;
  endEpoch: string;
  title: string;
  description: string;
  relatedBody?: string | null;
  eventIds: string[];
};

export type MissionTimeline = {
  events: MissionTimelineEvent[];
  phases: MissionPhase[];
  currentObjective?: string | null;
  missionStartEpoch: string;
  missionEndEpoch: string;
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
  maneuverEvents?: ManeuverEvent[];
  finalMassKg?: number | null;
  totalPropellantUsedKg?: number | null;
  propulsionConfig?: PropulsionConfig | null;
  missionTimeline?: MissionTimeline | null;
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
  maneuverEvents?: ManeuverEvent[];
  finalMassKg?: number | null;
  totalPropellantUsedKg?: number | null;
  propulsionConfig?: PropulsionConfig | null;
  missionTimeline?: MissionTimeline | null;
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
