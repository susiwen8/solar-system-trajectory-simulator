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
    stateVector: StateVector;
  };
  durationSeconds: number;
  outputStepSeconds: number;
};

export type TrajectorySample = {
  epochSeconds: number;
  positionKm: [number, number, number];
  velocityKmPerSec: [number, number, number];
};

export type TrajectoryResult = {
  referenceFrame: string;
  samples: TrajectorySample[];
  closestApproach: {
    bodyId: string;
    distanceKm: number;
    epochSeconds: number;
  };
  flightTimeSeconds: number;
  warnings: string[];
};

export type ScenePoint = {
  x: number;
  y: number;
  z: number;
};
