export type CameraMotionState = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fovDeg: number;
  zoom: number;
};

export type ProbeMotionState = {
  position: [number, number, number];
  forward: [number, number, number];
  engineGlowIntensity: number;
  streakOpacity: number;
};

export function advanceCameraMotion(
  current: CameraMotionState,
  target: CameraMotionState,
  smoothing: number,
): CameraMotionState {
  const next: CameraMotionState = {
    position: lerpVec3(current.position, target.position, smoothing),
    lookAt: lerpVec3(current.lookAt, target.lookAt, smoothing),
    fovDeg: lerpScalar(current.fovDeg, target.fovDeg, smoothing),
    zoom: lerpScalar(current.zoom, target.zoom, smoothing),
  };

  if (isCloseVec3(next.position, target.position) && isCloseVec3(next.lookAt, target.lookAt) && Math.abs(next.fovDeg - target.fovDeg) < 0.001 && Math.abs(next.zoom - target.zoom) < 0.001) {
    return target;
  }

  return next;
}

export function advanceProbeMotion(
  current: ProbeMotionState,
  target: ProbeMotionState,
  smoothing: number,
): ProbeMotionState {
  const next: ProbeMotionState = {
    position: lerpVec3(current.position, target.position, smoothing),
    forward: normalizeVec3(lerpVec3(current.forward, target.forward, smoothing)),
    engineGlowIntensity: lerpScalar(current.engineGlowIntensity, target.engineGlowIntensity, smoothing),
    streakOpacity: lerpScalar(current.streakOpacity, target.streakOpacity, smoothing),
  };

  if (
    isCloseVec3(next.position, target.position) &&
    isCloseVec3(next.forward, target.forward) &&
    Math.abs(next.engineGlowIntensity - target.engineGlowIntensity) < 0.001 &&
    Math.abs(next.streakOpacity - target.streakOpacity) < 0.001
  ) {
    return target;
  }

  return next;
}

function lerpScalar(current: number, target: number, smoothing: number) {
  return current + (target - current) * smoothing;
}

function lerpVec3(
  current: [number, number, number],
  target: [number, number, number],
  smoothing: number,
): [number, number, number] {
  return [
    lerpScalar(current[0], target[0], smoothing),
    lerpScalar(current[1], target[1], smoothing),
    lerpScalar(current[2], target[2], smoothing),
  ];
}

function normalizeVec3(direction: [number, number, number]): [number, number, number] {
  const magnitude = Math.hypot(direction[0], direction[1], direction[2]);
  if (magnitude <= 0) {
    return [0, 0, 1];
  }

  return [direction[0] / magnitude, direction[1] / magnitude, direction[2] / magnitude];
}

function isCloseVec3(left: [number, number, number], right: [number, number, number]) {
  return (
    Math.abs(left[0] - right[0]) < 0.001 &&
    Math.abs(left[1] - right[1]) < 0.001 &&
    Math.abs(left[2] - right[2]) < 0.001
  );
}
