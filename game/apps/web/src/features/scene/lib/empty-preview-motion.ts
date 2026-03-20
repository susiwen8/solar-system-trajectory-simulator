export type EmptyPreviewCameraState = {
  yawRad: number;
  pitchRad: number;
  radiusScale: number;
};

export type EmptyPreviewCameraRig = {
  target: EmptyPreviewCameraState;
  rendered: EmptyPreviewCameraState;
};

type EmptyPreviewDragDelta = {
  deltaX: number;
  deltaY: number;
};

const DEFAULT_YAW_RAD = 0.92;
const DEFAULT_PITCH_RAD = 1.42;
const DEFAULT_RADIUS_SCALE = 0.96;
const MIN_PITCH_RAD = 0.95;
const MAX_PITCH_RAD = 1.56;
const MIN_RADIUS_SCALE = 0.74;
const MAX_RADIUS_SCALE = 1.5;
const DRAG_YAW_SENSITIVITY = 0.0072;
const DRAG_PITCH_SENSITIVITY = 0.0058;
const WHEEL_ZOOM_SENSITIVITY = 0.0011;
const AMBIENT_YAW_RAD_PER_SECOND = 0.11;
const CAMERA_SMOOTHING_PER_SECOND = 7.5;

export function createDefaultEmptyPreviewCameraState(): EmptyPreviewCameraState {
  return {
    yawRad: DEFAULT_YAW_RAD,
    pitchRad: DEFAULT_PITCH_RAD,
    radiusScale: DEFAULT_RADIUS_SCALE,
  };
}

export function createDefaultEmptyPreviewCameraRig(): EmptyPreviewCameraRig {
  const state = createDefaultEmptyPreviewCameraState();
  return {
    target: state,
    rendered: state,
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

export function advanceEmptyPreviewAmbientTarget(
  rig: EmptyPreviewCameraRig,
  deltaSeconds: number,
): EmptyPreviewCameraRig {
  return {
    ...rig,
    target: advanceEmptyPreviewYaw(rig.target, deltaSeconds),
  };
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

export function applyEmptyPreviewRigDrag(
  rig: EmptyPreviewCameraRig,
  delta: EmptyPreviewDragDelta,
): EmptyPreviewCameraRig {
  return {
    ...rig,
    target: applyEmptyPreviewDrag(rig.target, delta),
  };
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

export function applyEmptyPreviewRigZoom(
  rig: EmptyPreviewCameraRig,
  wheelDelta: number,
): EmptyPreviewCameraRig {
  return {
    ...rig,
    target: applyEmptyPreviewZoom(rig.target, wheelDelta),
  };
}

export function stepEmptyPreviewCameraRig(
  rig: EmptyPreviewCameraRig,
  deltaSeconds: number,
): EmptyPreviewCameraRig {
  const smoothing = 1 - Math.exp(-Math.max(0, deltaSeconds) * CAMERA_SMOOTHING_PER_SECOND);
  return {
    ...rig,
    rendered: {
      yawRad: lerp(rig.rendered.yawRad, rig.target.yawRad, smoothing),
      pitchRad: lerp(rig.rendered.pitchRad, rig.target.pitchRad, smoothing),
      radiusScale: lerp(rig.rendered.radiusScale, rig.target.radiusScale, smoothing),
    },
  };
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

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}
