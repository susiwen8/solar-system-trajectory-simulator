export type EmptyPreviewCameraState = {
  yawRad: number;
  pitchRad: number;
  radiusScale: number;
};

type EmptyPreviewDragDelta = {
  deltaX: number;
  deltaY: number;
};

const DEFAULT_PITCH_RAD = -0.68;
const DEFAULT_RADIUS_SCALE = 1.22;
const MIN_PITCH_RAD = -1.25;
const MAX_PITCH_RAD = 0.18;
const MIN_RADIUS_SCALE = 0.82;
const MAX_RADIUS_SCALE = 1.92;
const DRAG_YAW_SENSITIVITY = 0.0072;
const DRAG_PITCH_SENSITIVITY = 0.0058;
const WHEEL_ZOOM_SENSITIVITY = 0.0011;
const AMBIENT_YAW_RAD_PER_SECOND = 0.11;

export function createDefaultEmptyPreviewCameraState(): EmptyPreviewCameraState {
  return {
    yawRad: 0,
    pitchRad: DEFAULT_PITCH_RAD,
    radiusScale: DEFAULT_RADIUS_SCALE,
  };
}

export function advanceEmptyPreviewYaw(
  state: EmptyPreviewCameraState,
  deltaSeconds: number,
): EmptyPreviewCameraState {
  return clampEmptyPreviewCameraState({
    ...state,
    yawRad: state.yawRad + Math.max(0, deltaSeconds) * AMBIENT_YAW_RAD_PER_SECOND,
  });
}

export function applyEmptyPreviewDrag(
  state: EmptyPreviewCameraState,
  delta: EmptyPreviewDragDelta,
): EmptyPreviewCameraState {
  return clampEmptyPreviewCameraState({
    yawRad: state.yawRad + delta.deltaX * DRAG_YAW_SENSITIVITY,
    pitchRad: state.pitchRad - delta.deltaY * DRAG_PITCH_SENSITIVITY,
    radiusScale: state.radiusScale,
  });
}

export function applyEmptyPreviewZoom(
  state: EmptyPreviewCameraState,
  wheelDelta: number,
): EmptyPreviewCameraState {
  return clampEmptyPreviewCameraState({
    ...state,
    radiusScale: state.radiusScale + wheelDelta * WHEEL_ZOOM_SENSITIVITY,
  });
}

function clampEmptyPreviewCameraState(
  state: EmptyPreviewCameraState,
): EmptyPreviewCameraState {
  return {
    yawRad: state.yawRad,
    pitchRad: clamp(state.pitchRad, MIN_PITCH_RAD, MAX_PITCH_RAD),
    radiusScale: clamp(state.radiusScale, MIN_RADIUS_SCALE, MAX_RADIUS_SCALE),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
