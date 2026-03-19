export type OrbitCameraState = {
  yawRad: number;
  pitchRad: number;
  radiusScale: number;
};

type OrbitDragDelta = {
  deltaX: number;
  deltaY: number;
};

const DEFAULT_PITCH_RAD = 0.22;
const MIN_PITCH_RAD = -1.15;
const MAX_PITCH_RAD = 1.15;
const MIN_RADIUS_SCALE = 0.72;
const MAX_RADIUS_SCALE = 1.9;
const DRAG_YAW_SENSITIVITY = 0.008;
const DRAG_PITCH_SENSITIVITY = 0.008;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;

export function createDefaultOrbitCameraState(): OrbitCameraState {
  return {
    yawRad: 0,
    pitchRad: DEFAULT_PITCH_RAD,
    radiusScale: 1,
  };
}

export function clampOrbitCameraState(state: OrbitCameraState): OrbitCameraState {
  return {
    yawRad: state.yawRad,
    pitchRad: clamp(state.pitchRad, MIN_PITCH_RAD, MAX_PITCH_RAD),
    radiusScale: clamp(state.radiusScale, MIN_RADIUS_SCALE, MAX_RADIUS_SCALE),
  };
}

export function applyOrbitDragDelta(
  state: OrbitCameraState,
  delta: OrbitDragDelta,
): OrbitCameraState {
  return clampOrbitCameraState({
    yawRad: state.yawRad + delta.deltaX * DRAG_YAW_SENSITIVITY,
    pitchRad: state.pitchRad - delta.deltaY * DRAG_PITCH_SENSITIVITY,
    radiusScale: state.radiusScale,
  });
}

export function applyOrbitWheelDelta(
  state: OrbitCameraState,
  deltaY: number,
): OrbitCameraState {
  return clampOrbitCameraState({
    ...state,
    radiusScale: state.radiusScale + deltaY * WHEEL_ZOOM_SENSITIVITY,
  });
}

export function applyOrbitPinchScale(
  state: OrbitCameraState,
  pinchRatio: number,
): OrbitCameraState {
  if (!Number.isFinite(pinchRatio) || pinchRatio <= 0) {
    return state;
  }

  return clampOrbitCameraState({
    ...state,
    radiusScale: state.radiusScale / pinchRatio,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
