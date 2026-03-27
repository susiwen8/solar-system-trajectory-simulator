export type RecoveryCameraMode = "launch-pad" | "side-follow" | "recovery-overview";

export type RecoveryPhaseId =
  | "liftoff"
  | "pitch-and-ascent"
  | "stage-separation"
  | "first-stage-boostback"
  | "first-stage-atmospheric-return"
  | "landing-burn-and-touchdown"
  | "second-stage-orbital-continuation";

export type Vec3 = [number, number, number];

export type RecoveryPhase = {
  id: RecoveryPhaseId;
  label: string;
  startProgress: number;
  endProgress: number;
  cameraMode: RecoveryCameraMode;
  highlights: string[];
};

export type RecoveryTransform = {
  position: Vec3;
  rotation: Vec3;
};

export type RecoveryCameraState = {
  mode: RecoveryCameraMode;
  position: Vec3;
  target: Vec3;
};

export type RecoveryTrajectoryState = {
  visible: boolean;
  progress: number;
};

export type RecoveryDemoSnapshot = {
  progress: number;
  activePhase: RecoveryPhase;
  firstStage: {
    transform: RecoveryTransform;
  };
  secondStage: {
    transform: RecoveryTransform;
  };
  camera: RecoveryCameraState;
  trajectory: {
    stageOne: RecoveryTrajectoryState;
    stageTwo: RecoveryTrajectoryState;
  };
  phaseHighlights: string[];
};

export const RECOVERY_DEMO_DURATION_SECONDS = 180;

export const RECOVERY_PHASES: RecoveryPhase[] = [
  {
    id: "liftoff",
    label: "Liftoff",
    startProgress: 0,
    endProgress: 0.1,
    cameraMode: "launch-pad",
    highlights: [
      "Liftoff: both stages rise together as the stack clears the pad.",
      "Liftoff: the demo starts with the launch frame held close to the tower.",
    ],
  },
  {
    id: "pitch-and-ascent",
    label: "Pitch and Ascent",
    startProgress: 0.1,
    endProgress: 0.26,
    cameraMode: "launch-pad",
    highlights: [
      "Pitch and Ascent: the rocket tips over to build horizontal speed.",
      "Pitch and Ascent: the camera still reads the stack from the launch pad.",
    ],
  },
  {
    id: "stage-separation",
    label: "Stage Separation",
    startProgress: 0.26,
    endProgress: 0.4,
    cameraMode: "side-follow",
    highlights: [
      "Stage Separation: the interstage clears and the vehicles begin to diverge.",
      "Stage Separation: the side-on view makes the split easy to read.",
    ],
  },
  {
    id: "first-stage-boostback",
    label: "First-Stage Boostback",
    startProgress: 0.4,
    endProgress: 0.58,
    cameraMode: "side-follow",
    highlights: [
      "First-Stage Boostback: the booster turns toward the offshore drone-ship recovery corridor.",
      "First-Stage Boostback: the upper stage keeps accelerating outward.",
    ],
  },
  {
    id: "first-stage-atmospheric-return",
    label: "First-Stage Atmospheric Return",
    startProgress: 0.58,
    endProgress: 0.78,
    cameraMode: "side-follow",
    highlights: [
      "First-Stage Atmospheric Return: the booster falls back through denser air.",
      "First-Stage Atmospheric Return: the second stage stays outbound while the booster comes home.",
    ],
  },
  {
    id: "landing-burn-and-touchdown",
    label: "Landing Burn and Touchdown",
    startProgress: 0.78,
    endProgress: 0.9,
    cameraMode: "recovery-overview",
    highlights: [
      "Landing Burn and Touchdown: the booster slows for the final descent onto the drone ship.",
      "Landing Burn and Touchdown: the overview framing keeps the offshore recovery target readable.",
    ],
  },
  {
    id: "second-stage-orbital-continuation",
    label: "Second-Stage Orbital Continuation",
    startProgress: 0.9,
    endProgress: 1,
    cameraMode: "recovery-overview",
    highlights: [
      "Second-Stage Orbital Continuation: the upper stage keeps building orbital energy.",
      "Second-Stage Orbital Continuation: the booster story ends while the mission continues.",
    ],
  },
];

type TransformKeyframe = {
  progress: number;
  position: Vec3;
  rotation: Vec3;
};

type ScalarKeyframe = {
  progress: number;
  value: number;
};

type CameraKeyframe = {
  progress: number;
  position: Vec3;
  target: Vec3;
};

const ATTACHED_STACK_TRANSFORM_KEYFRAMES: TransformKeyframe[] = [
  { progress: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
  { progress: 0.1, position: [10, 8, 0], rotation: [0.04, 0, 0] },
  { progress: 0.26, position: [34, 32, 0], rotation: [0.1, 0.03, 0.01] },
];

const FIRST_STAGE_TRANSFORM_KEYFRAMES: TransformKeyframe[] = [
  ...ATTACHED_STACK_TRANSFORM_KEYFRAMES,
  { progress: 0.34, position: [54, 48, -1], rotation: [0.22, 0.1, 0] },
  { progress: 0.4, position: [62, 54, -4], rotation: [0.34, 0.12, -0.03] },
  { progress: 0.58, position: [46, 38, -10], rotation: [0.46, 0.18, -0.08] },
  { progress: 0.78, position: [38, 18, -16], rotation: [0.2, 0.08, -0.06] },
  { progress: 0.9, position: [32, 7, -19], rotation: [0.08, 0.03, -0.02] },
  { progress: 1, position: [28, 0.8, -20], rotation: [0, 0, 0] },
];

const SECOND_STAGE_TRANSFORM_KEYFRAMES: TransformKeyframe[] = [
  ...ATTACHED_STACK_TRANSFORM_KEYFRAMES,
  { progress: 0.34, position: [70, 64, 1], rotation: [0.14, 0.05, 0.02] },
  { progress: 0.4, position: [86, 76, 0], rotation: [0.14, 0.05, 0.01] },
  { progress: 0.58, position: [112, 102, 4], rotation: [0.12, 0.03, 0.01] },
  { progress: 0.78, position: [168, 152, 9], rotation: [0.08, 0.02, 0.01] },
  { progress: 0.9, position: [226, 206, 14], rotation: [0.05, 0.01, 0] },
  { progress: 1, position: [282, 260, 18], rotation: [0.04, 0, 0] },
];

const FIRST_STAGE_TRAJECTORY_KEYFRAMES: ScalarKeyframe[] = [
  { progress: 0, value: 0 },
  { progress: 0.1, value: 0.12 },
  { progress: 0.4, value: 0.48 },
  { progress: 0.58, value: 0.71 },
  { progress: 0.78, value: 0.88 },
  { progress: 0.9, value: 0.96 },
  { progress: 1, value: 1 },
];

const SECOND_STAGE_TRAJECTORY_KEYFRAMES: ScalarKeyframe[] = [
  { progress: 0, value: 0 },
  { progress: 0.26, value: 0 },
  { progress: 0.4, value: 0.28 },
  { progress: 0.58, value: 0.62 },
  { progress: 0.78, value: 0.84 },
  { progress: 0.9, value: 0.94 },
  { progress: 1, value: 1 },
];

const CAMERA_KEYFRAMES: CameraKeyframe[] = [
  { progress: 0, position: [-24, 16, -30], target: [0, 0, 0] },
  { progress: 0.1, position: [-20, 17, -29], target: [8, 7, 0] },
  { progress: 0.26, position: [-16, 18, -31], target: [34, 32, 0] },
  { progress: 0.4, position: [-22, 20, -34], target: [86, 76, 0] },
  { progress: 0.58, position: [-30, 22, -40], target: [60, 46, -8] },
  { progress: 0.78, position: [-42, 26, -48], target: [52, 18, -15] },
  { progress: 0.9, position: [-58, 34, -58], target: [92, 64, -4] },
  { progress: 1, position: [-82, 48, -66], target: [200, 188, 12] },
];

export function getRecoveryPhase(progress: number): RecoveryPhase {
  const clampedProgress = clampProgress(progress);
  const phase =
    RECOVERY_PHASES.find((candidate) => {
      const isLastPhase = candidate === RECOVERY_PHASES[RECOVERY_PHASES.length - 1];
      if (isLastPhase) {
        return clampedProgress >= candidate.startProgress && clampedProgress <= candidate.endProgress;
      }

      return clampedProgress >= candidate.startProgress && clampedProgress < candidate.endProgress;
    }) ?? RECOVERY_PHASES[RECOVERY_PHASES.length - 1];

  return clonePhase(phase);
}

export function getRecoveryDemoSnapshot(progress: number): RecoveryDemoSnapshot {
  const clampedProgress = clampProgress(progress);
  const activePhase = getRecoveryPhase(clampedProgress);
  const camera = sampleCameraState(CAMERA_KEYFRAMES, clampedProgress);

  return {
    progress: clampedProgress,
    activePhase,
    firstStage: {
      transform: sampleTransform(FIRST_STAGE_TRANSFORM_KEYFRAMES, clampedProgress),
    },
    secondStage: {
      transform: sampleTransform(SECOND_STAGE_TRANSFORM_KEYFRAMES, clampedProgress),
    },
    camera: {
      mode: activePhase.cameraMode,
      position: camera.position,
      target: camera.target,
    },
    trajectory: {
      stageOne: {
        visible: true,
        progress: sampleScalar(FIRST_STAGE_TRAJECTORY_KEYFRAMES, clampedProgress),
      },
      stageTwo: {
        visible: clampedProgress >= 0.26,
        progress:
          clampedProgress >= 0.26
            ? sampleScalar(SECOND_STAGE_TRAJECTORY_KEYFRAMES, clampedProgress)
            : 0,
      },
    },
    phaseHighlights: [...activePhase.highlights],
  };
}

function sampleCameraState(
  keyframes: CameraKeyframe[],
  progress: number,
): Pick<RecoveryCameraState, "position" | "target"> {
  return {
    position: sampleVec3(
      keyframes.map(({ progress: keyframeProgress, position }) => ({
        progress: keyframeProgress,
        value: position,
      })),
      progress,
    ),
    target: sampleVec3(
      keyframes.map(({ progress: keyframeProgress, target }) => ({
        progress: keyframeProgress,
        value: target,
      })),
      progress,
    ),
  };
}

function sampleTransform(keyframes: TransformKeyframe[], progress: number): RecoveryTransform {
  return {
    position: sampleVec3(
      keyframes.map(({ progress: keyframeProgress, position }) => ({
        progress: keyframeProgress,
        value: position,
      })),
      progress,
    ),
    rotation: sampleVec3(
      keyframes.map(({ progress: keyframeProgress, rotation }) => ({
        progress: keyframeProgress,
        value: rotation,
      })),
      progress,
    ),
  };
}

function sampleScalar(keyframes: ScalarKeyframe[], progress: number): number {
  if (keyframes.length === 0) {
    return 0;
  }

  if (progress <= keyframes[0].progress) {
    return keyframes[0].value;
  }

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const current = keyframes[index];

    if (progress <= current.progress) {
      const span = current.progress - previous.progress;
      if (span <= 0) {
        return current.value;
      }

      const localProgress = (progress - previous.progress) / span;
      return previous.value + (current.value - previous.value) * localProgress;
    }
  }

  return keyframes[keyframes.length - 1].value;
}

function sampleVec3(keyframes: { progress: number; value: Vec3 }[], progress: number): Vec3 {
  if (keyframes.length === 0) {
    return [0, 0, 0];
  }

  if (progress <= keyframes[0].progress) {
    return [...keyframes[0].value];
  }

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const current = keyframes[index];

    if (progress <= current.progress) {
      const span = current.progress - previous.progress;
      if (span <= 0) {
        return [...current.value];
      }

      const localProgress = (progress - previous.progress) / span;
      return [
        lerp(previous.value[0], current.value[0], localProgress),
        lerp(previous.value[1], current.value[1], localProgress),
        lerp(previous.value[2], current.value[2], localProgress),
      ];
    }
  }

  return [...keyframes[keyframes.length - 1].value];
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function clonePhase(phase: RecoveryPhase): RecoveryPhase {
  return {
    ...phase,
    highlights: [...phase.highlights],
  };
}
