import type { ProbeCameraView } from "./camera";
import type { OrbitCameraState } from "./orbit-camera";
import { compressSceneDistanceKm } from "./scale";

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
  orbitState?: OrbitCameraState,
): ProbeCameraFrame {
  const probePosition = toSceneVector(samplePositionKm);
  const forward = toSceneDirection(view.lookDirection);
  const right = resolveRightVector(forward);
  const up = normalizeSceneDirection(cross(right, forward));
  const cinematic = cinematicOffsets(view.mode);

  if (orbitState) {
    const distanceScale = orbitState.radiusScale;
    const horizontalDistance = cinematic.behind * distanceScale;
    const lateralDistance = cinematic.lateral * distanceScale;
    const yawCos = Math.cos(orbitState.yawRad);
    const yawSin = Math.sin(orbitState.yawRad);
    const pitchCos = Math.cos(orbitState.pitchRad);
    const pitchSin = Math.sin(orbitState.pitchRad);

    const behindOffset = horizontalDistance * pitchCos * yawCos;
    const lateralOffset = horizontalDistance * pitchCos * yawSin + lateralDistance * yawCos;
    const verticalOffset = cinematic.height + horizontalDistance * pitchSin;
    const lookAhead = cinematic.lookAhead * Math.max(0.18, pitchCos);

    const position: [number, number, number] = [
      probePosition[0] - forward[0] * behindOffset + right[0] * lateralOffset + up[0] * verticalOffset,
      probePosition[1] - forward[1] * behindOffset + right[1] * lateralOffset + up[1] * verticalOffset,
      probePosition[2] - forward[2] * behindOffset + right[2] * lateralOffset + up[2] * verticalOffset,
    ];
    const lookAt: [number, number, number] = [
      probePosition[0] + forward[0] * lookAhead + up[0] * cinematic.lookLift,
      probePosition[1] + forward[1] * lookAhead + up[1] * cinematic.lookLift,
      probePosition[2] + forward[2] * lookAhead + up[2] * cinematic.lookLift,
    ];

    return {
      position,
      lookAt,
      fovDeg: view.fovDeg,
      zoom,
    };
  }

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
      behind: 5.2,
      height: 1.7,
      lateral: 3.1,
      lookAhead: 5,
      lookLift: 0.35,
    };
  }

  if (mode === "approach-emphasis") {
    return {
      behind: 6.8,
      height: 2.2,
      lateral: 0,
      lookAhead: 6.1,
      lookLift: 0.45,
    };
  }

  return {
    behind: 8.2,
    height: 2.6,
    lateral: 0,
    lookAhead: 7.2,
    lookLift: 0.45,
  };
}

function toSceneVector(positionKm: [number, number, number]): [number, number, number] {
  return [
    compressSceneDistanceKm(positionKm[0]) * 1.8,
    compressSceneDistanceKm(positionKm[2]) * 0.8,
    compressSceneDistanceKm(positionKm[1]) * 1.8,
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

function resolveRightVector(forward: [number, number, number]) {
  const worldUp: [number, number, number] = [0, 1, 0];
  const right = cross(forward, worldUp);
  const magnitude = Math.sqrt(right[0] * right[0] + right[1] * right[1] + right[2] * right[2]);

  if (magnitude <= 0.0001) {
    return [1, 0, 0] as [number, number, number];
  }

  return normalizeSceneDirection(right);
}

function cross(left: [number, number, number], right: [number, number, number]): [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}
