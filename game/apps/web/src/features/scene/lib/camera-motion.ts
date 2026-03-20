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

export function interpolateCameraMotion(
  current: CameraMotionState,
  target: CameraMotionState,
  alpha: number,
): CameraMotionState {
  const t = clampAlpha(alpha);
  return {
    position: lerpVec3(current.position, target.position, t),
    lookAt: lerpVec3(current.lookAt, target.lookAt, t),
    fovDeg: lerpScalar(current.fovDeg, target.fovDeg, t),
    zoom: lerpScalar(current.zoom, target.zoom, t),
  };
}

export function advanceCameraMotion(
  current: CameraMotionState,
  target: CameraMotionState,
  smoothing: number,
): CameraMotionState {
  const next = interpolateCameraMotion(current, target, smoothing);

  if (isCloseVec3(next.position, target.position) && isCloseVec3(next.lookAt, target.lookAt) && Math.abs(next.fovDeg - target.fovDeg) < 0.001 && Math.abs(next.zoom - target.zoom) < 0.001) {
    return target;
  }

  return next;
}

export function interpolateProbeMotion(
  current: ProbeMotionState,
  target: ProbeMotionState,
  alpha: number,
): ProbeMotionState {
  const t = clampAlpha(alpha);
  return {
    position: lerpVec3(current.position, target.position, t),
    forward: normalizeVec3(lerpVec3(current.forward, target.forward, t)),
    engineGlowIntensity: lerpScalar(current.engineGlowIntensity, target.engineGlowIntensity, t),
    streakOpacity: lerpScalar(current.streakOpacity, target.streakOpacity, t),
  };
}

export function advanceProbeMotion(
  current: ProbeMotionState,
  target: ProbeMotionState,
  smoothing: number,
): ProbeMotionState {
  const next = interpolateProbeMotion(current, target, smoothing);

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

export function isCameraMotionClose(left: CameraMotionState, right: CameraMotionState) {
  return (
    isCloseVec3(left.position, right.position) &&
    isCloseVec3(left.lookAt, right.lookAt) &&
    Math.abs(left.fovDeg - right.fovDeg) < 0.001 &&
    Math.abs(left.zoom - right.zoom) < 0.001
  );
}

export function isProbeMotionClose(left: ProbeMotionState, right: ProbeMotionState) {
  return (
    isCloseVec3(left.position, right.position) &&
    isCloseVec3(left.forward, right.forward) &&
    Math.abs(left.engineGlowIntensity - right.engineGlowIntensity) < 0.001 &&
    Math.abs(left.streakOpacity - right.streakOpacity) < 0.001
  );
}

function lerpScalar(current: number, target: number, smoothing: number) {
  return current + (target - current) * smoothing;
}

function clampAlpha(alpha: number) {
  return Math.min(Math.max(alpha, 0), 1);
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
