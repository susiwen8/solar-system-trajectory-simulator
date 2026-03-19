import type { ProbeCameraView } from "./camera";
import { scaleDistanceKm } from "./scale";

export type ProbeCameraFrame = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fovDeg: number;
  zoom: number;
};

export function buildProbeCameraFrame(
  samplePositionKm: [number, number, number],
  view: ProbeCameraView,
  zoom: number,
): ProbeCameraFrame {
  const probePosition = toSceneVector(samplePositionKm);
  const forward = toSceneDirection(view.lookDirection);
  const right = normalizeSceneDirection(cross(forward, [0, 1, 0]));
  const cinematic = cinematicOffsets(view.mode);

  const position: [number, number, number] = [
    probePosition[0] - forward[0] * cinematic.behind + right[0] * cinematic.lateral,
    probePosition[1] + cinematic.height,
    probePosition[2] - forward[2] * cinematic.behind + right[2] * cinematic.lateral,
  ];
  const lookAt: [number, number, number] = [
    probePosition[0] + forward[0] * cinematic.lookAhead,
    probePosition[1] + cinematic.lookLift,
    probePosition[2] + forward[2] * cinematic.lookAhead,
  ];

  return {
    position,
    lookAt,
    fovDeg: view.fovDeg,
    zoom,
  };
}

function cinematicOffsets(mode: ProbeCameraView["mode"]) {
  if (mode === "flyby-emphasis") {
    return {
      behind: 8,
      height: 2.6,
      lateral: 4.4,
      lookAhead: 6.5,
      lookLift: 0.5,
    };
  }

  if (mode === "approach-emphasis") {
    return {
      behind: 10.5,
      height: 3.8,
      lateral: 0,
      lookAhead: 8.5,
      lookLift: 0.7,
    };
  }

  return {
    behind: 15,
    height: 5.8,
    lateral: 0,
    lookAhead: 12,
    lookLift: 1,
  };
}

function toSceneVector(positionKm: [number, number, number]): [number, number, number] {
  return [
    scaleDistanceKm(positionKm[0]) * 1.8,
    scaleDistanceKm(positionKm[2]) * 0.8,
    scaleDistanceKm(positionKm[1]) * 1.8,
  ];
}

function normalizeSceneDirection(direction: [number, number, number]): [number, number, number] {
  const magnitude = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]);
  if (magnitude <= 0) {
    return [0, 0, 1];
  }

  return [direction[0] / magnitude, direction[1] / magnitude, direction[2] / magnitude];
}

function toSceneDirection(direction: [number, number, number]): [number, number, number] {
  return normalizeSceneDirection([direction[0], direction[2] * 0.45, direction[1]]);
}

function cross(left: [number, number, number], right: [number, number, number]): [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}
