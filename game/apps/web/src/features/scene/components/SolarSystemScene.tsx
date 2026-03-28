import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import * as THREE from "three";

import { localizeMissionSegment, planetLabel, t, type Language } from "../../../lib/i18n";
import { formatRelativeDurationSeconds } from "../../../lib/duration";
import type { BodyState, ManeuverEvent, MissionSegment, TrajectoryResult } from "../../mission/types";
import TrajectoryInsetMap from "./TrajectoryInsetMap";
import { computeProbeCameraView, type ProbeCameraView } from "../lib/camera";
import { buildProbeCameraFrame } from "../lib/camera-frame";
import { buildNavigationVisuals, type NavigationVisuals } from "../lib/navigation-visuals";
import {
  type CameraMotionState,
  type ProbeMotionState,
  interpolateCameraMotion,
  interpolateProbeMotion,
  isCameraMotionClose,
  isProbeMotionClose,
} from "../lib/camera-motion";
import {
  applyOrbitDragDelta,
  applyOrbitPinchScale,
  applyOrbitWheelDelta,
  createDefaultOrbitCameraState,
  type OrbitCameraState,
} from "../lib/orbit-camera";
import {
  computeFocusBodyVisualProfile,
  getPlanetaryRingProfile,
} from "../lib/focus-visuals";
import { areBodyStatesClose, interpolateBodyStates } from "../lib/body-motion";
import { buildInsetMapModel } from "../lib/inset-map";
import {
  buildMissionTimelinePhaseMarkers,
  getMissionTimelineSnapshot,
  type MissionTimelinePhaseMarker,
} from "../lib/mission-timeline";
import { resolveProbeAttitudeDirection } from "../lib/probe-attitude";
import {
  PROBE_EFFECTS_SCALE,
  PROBE_MODEL_ALIGNMENT_YAW_RAD,
  PROBE_VISUAL_SCALE,
} from "../lib/probe-model";
import {
  BODY_PHYSICAL_RADII_KM,
  sceneBodyRadiusFromPhysicalKm,
} from "../lib/body-physics";
import { scaleDistanceKm } from "../lib/scale";
import {
  buildSpeedTelemetry,
  formatSpeedValue,
} from "../lib/speed-telemetry";
import { resolveProbeThrustState } from "../lib/probe-thrust";
import {
  buildArrivalCaptureModel,
  buildDisplayCapturePathPoints,
  estimateArrivalCaptureOrbitDurationSeconds,
  sampleArrivalCaptureOrbit,
} from "../lib/arrival-capture";
import {
  buildStableEncounterAdjustedSamples,
  enforceMinimumEncounterClearance,
} from "../lib/encounter-visual";
import { shouldUseEncounterDisplayAdjustment } from "../lib/scene-encounter";
import { resolveBodyFocusVisual } from "../lib/scene-focus";
import { resolveNextScenePerspective, type ScenePerspective } from "../lib/scene-perspective";

type SolarSystemSceneProps = {
  result: TrajectoryResult;
  bodies: BodyState[];
  launchEpoch: string | null;
  currentEpoch: string | null;
  selectedSampleIndex: number;
  onSampleIndexChange: (index: number) => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  language: Language;
};

type SceneRuntime = {
  bodyTransition: MotionTransition<BodyState[]> | null;
  bodyVisuals: Map<string, BodyVisualRuntime>;
  currentBodies: BodyState[] | null;
  bodiesGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  frameHandle: number | null;
  currentMotion: CameraMotionState | null;
  currentProbeMotion: ProbeMotionState | null;
  motionTransition: MotionTransition<CameraMotionState> | null;
  missionGroup: THREE.Group;
  playbackGroup: THREE.Group;
  probeMotionTransition: MotionTransition<ProbeMotionState> | null;
  probeVisual: ProbeVisualRuntime;
  renderer: THREE.WebGLRenderer;
  resizeObserver: ResizeObserver | null;
  render: () => void;
  scene: THREE.Scene;
  targetBodies: BodyState[] | null;
  targetMotion: CameraMotionState | null;
  targetProbeMotion: ProbeMotionState | null;
  setProbeTarget: (motion: ProbeMotionState) => void;
  hitTestProbe: (clientX: number, clientY: number) => boolean;
  setView: (
    samplePositionKm: [number, number, number],
    view: ProbeCameraView,
    zoom: number,
    orbitState: OrbitCameraState,
    perspective: ScenePerspective,
  ) => void;
  setProbeVisible: (visible: boolean) => void;
  setZoom: (zoom: number) => void;
  stop: () => void;
};

type MotionTransition<T> = {
  durationMs: number;
  source: T;
  startTimeMs: number;
  target: T;
};

type ProbeVisualRuntime = {
  engineGlowMaterial: THREE.MeshStandardMaterial;
  group: THREE.Group;
  pickables: THREE.Object3D[];
  streakMaterials: Array<{
    material: THREE.LineBasicMaterial;
    opacityScale: number;
  }>;
};

type BodyVisualRuntime = {
  group: THREE.Group;
  styleKey: string;
};

const bodyColors: Record<string, string> = {
  sun: "#f4b400",
  mercury: "#b8aea1",
  venus: "#d6b989",
  earth: "#6ab8ff",
  mars: "#e27c61",
  jupiter: "#d9b07b",
  saturn: "#d7ca9e",
  uranus: "#8fdce0",
  neptune: "#6f93ff"
};

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.4;
const DEFAULT_ZOOM = 1.15;
const PLAYBACK_TRANSITION_MS = 80;
const ENCOUNTER_CLEARANCE_MULTIPLIER = 1.08;
const ARRIVAL_SEGMENT_TYPES = new Set([
  "arrivalHyperbolicApproach",
  "orbitInsertionBurn",
  "parkingOrbit",
  "arrivalCapture",
  "scienceOrbit",
]);

type PointerOrbitGesture = {
  pointerId: number;
  lastX: number;
  lastY: number;
};

type TouchOrbitGesture =
  | {
      mode: "rotate";
      touchId: number;
      lastX: number;
      lastY: number;
    }
  | {
      mode: "pinch";
      lastDistance: number;
    };

export default function SolarSystemScene({
  result,
  bodies,
  launchEpoch,
  currentEpoch,
  selectedSampleIndex,
  onSampleIndexChange,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  language,
}: SolarSystemSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const pointerGestureRef = useRef<PointerOrbitGesture | null>(null);
  const touchGestureRef = useRef<TouchOrbitGesture | null>(null);
  const orbitLoopFrameRef = useRef<number | null>(null);
  const captureOrbitElapsedSecondsRef = useRef(0);
  const [renderMode, setRenderMode] = useState<"webgl" | "fallback">("fallback");
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [orbitCameraState, setOrbitCameraState] = useState<OrbitCameraState>(() => createDefaultOrbitCameraState());
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [scenePerspective, setScenePerspective] = useState<ScenePerspective>("topdown-follow");
  const [selectedPhaseJumpId, setSelectedPhaseJumpId] = useState<string | null>(null);
  const [captureOrbitElapsedSeconds, setCaptureOrbitElapsedSeconds] = useState(0);
  const copy = t(language);
  const telemetry = buildSpeedTelemetry(result.samples, selectedSampleIndex, "speed");
  const navigationVisuals = buildNavigationVisuals(result, selectedSampleIndex, launchEpoch);
  const arrivalCaptureModel = buildArrivalCaptureModel(result);
  const displayedCapturePathPoints = arrivalCaptureModel
    ? buildDisplayCapturePathPoints(
        arrivalCaptureModel.pathPoints,
        bodySceneRadius(arrivalCaptureModel.bodyId),
      )
    : null;
  const activeManeuver = findActiveManeuver(result.maneuverEvents, currentEpoch);
  const upcomingManeuver = activeManeuver ? null : findUpcomingManeuver(result.maneuverEvents, currentEpoch);
  const timelineSnapshot = getMissionTimelineSnapshot(result.missionTimeline, currentEpoch);
  const activePhaseJumpId = selectedPhaseJumpId ?? timelineSnapshot.currentPhase?.id ?? null;
  const playbackPhaseMarkers = buildMissionTimelinePhaseMarkers(
    result.missionTimeline,
    result.samples,
    launchEpoch,
    currentEpoch,
    activePhaseJumpId,
  );
  const activePlaybackPhaseMarker = playbackPhaseMarkers.find((marker) => marker.isActive) ?? null;
  const nextEvent = timelineSnapshot.nextEvent;
  const currentObjective = result.missionTimeline?.currentObjective ?? planetLabel(language, result.closestApproach.bodyId);
  const nextEventSummary = nextEvent && currentEpoch
    ? `${nextEvent.title} · ${formatTimeUntil(currentEpoch, nextEvent.epoch, language)}`
    : nextEvent?.title ?? copy.noUpcomingEvent;
  const activeSegment = findActiveSegment(result.segments ?? [], currentEpoch);
  const currentMissionSegmentLabel = activePlaybackPhaseMarker
    ? formatPlaybackPhaseMarkerLabel(language, activePlaybackPhaseMarker)
    : activeSegment
      ? localizeMissionSegment(language, activeSegment.segmentType)
      : null;
  const baseSampleIndex = Math.min(selectedSampleIndex, Math.max(result.samples.length - 1, 0));
  const isTerminalPlaybackSample = baseSampleIndex >= Math.max(result.samples.length - 1, 0);
  const activeSample = result.samples[baseSampleIndex] ?? result.samples[0];
  const displayedPathSamples = result.samples.slice(0, baseSampleIndex + 1);
  const captureBody = arrivalCaptureModel
    ? bodies.find((body) => body.bodyId === arrivalCaptureModel.bodyId) ?? null
    : null;
  const captureLoopDurationSeconds =
    arrivalCaptureModel && captureBody
      ? arrivalCaptureModel.durationSeconds ??
        estimateArrivalCaptureOrbitDurationSeconds(arrivalCaptureModel.pathPoints, captureBody.muKm3PerS2)
      : null;
  const captureOrbitPlaybackState =
    activeSample &&
    isTerminalPlaybackSample &&
    displayedCapturePathPoints &&
    captureBody
      ? sampleArrivalCaptureOrbit(
          displayedCapturePathPoints,
          captureBody.positionKm,
          captureLoopDurationSeconds && captureLoopDurationSeconds > 0
            ? captureOrbitElapsedSeconds / captureLoopDurationSeconds
            : 0,
        )
      : null;
  const terminalOrbitProbeSample =
    activeSample && captureOrbitPlaybackState
      ? {
          ...activeSample,
          positionKm: captureOrbitPlaybackState.positionKm,
          velocityKmPerSec: captureOrbitPlaybackState.velocityKmPerSec,
        }
      : null;
  const sceneProbeSample =
    terminalOrbitProbeSample ??
    activeSample;
  const cameraView = sceneProbeSample
    ? computeProbeCameraView({
        sample: sceneProbeSample,
        bodies,
        closestApproach: result.closestApproach,
        activeSegment,
      })
    : null;
  const insetMapModel = buildInsetMapModel({
    samples: result.samples,
    bodies,
    closestApproach: result.closestApproach,
    selectedSampleIndex,
    flybyEvents: result.flybyEvents ?? [],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) {
      return;
    }

    const runtime = createSceneRuntime(canvas, surface);
    if (!runtime) {
      setRenderMode("fallback");
      return;
    }

    runtimeRef.current = runtime;
    runtime.setZoom(zoomLevel);
    setRenderMode("webgl");

    return () => {
      runtime.stop();
      disposeObject(runtime.scene);
      runtime.renderer.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    syncMissionScene(runtime, result, launchEpoch, language, arrivalCaptureModel, displayedCapturePathPoints, navigationVisuals);
  }, [result, launchEpoch, language, arrivalCaptureModel, displayedCapturePathPoints, navigationVisuals]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    syncPlaybackScene(runtime, bodies, result, hoveredBodyId, language, cameraView, zoomLevel, orbitCameraState, scenePerspective, activeSample, terminalOrbitProbeSample, activeSegment, displayedPathSamples, currentEpoch, arrivalCaptureModel, displayedCapturePathPoints);
  }, [activeSample, activeSegment, bodies, result, selectedSampleIndex, hoveredBodyId, language, cameraView, zoomLevel, orbitCameraState, scenePerspective, displayedPathSamples, currentEpoch, arrivalCaptureModel, displayedCapturePathPoints, terminalOrbitProbeSample]);

  useEffect(() => {
    runtimeRef.current?.setZoom(zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    setOrbitCameraState(createDefaultOrbitCameraState());
    setScenePerspective("topdown-follow");
    setSelectedPhaseJumpId(null);
    captureOrbitElapsedSecondsRef.current = 0;
    setCaptureOrbitElapsedSeconds(0);
    pointerGestureRef.current = null;
    touchGestureRef.current = null;
  }, [result]);

  useEffect(() => {
    if (orbitLoopFrameRef.current != null) {
      window.cancelAnimationFrame(orbitLoopFrameRef.current);
      orbitLoopFrameRef.current = null;
    }

    const canLoopCaptureOrbit =
      isPlaying &&
      isTerminalPlaybackSample &&
      displayedCapturePathPoints != null &&
      displayedCapturePathPoints.length > 1 &&
      captureBody != null;
    if (canLoopCaptureOrbit) {
      const startElapsedSeconds = captureOrbitElapsedSecondsRef.current;
      const startTimeMs = performance.now() - startElapsedSeconds * 1000;
      const tick = (now: number) => {
        const nextElapsedSeconds = (now - startTimeMs) / 1000;
        captureOrbitElapsedSecondsRef.current = nextElapsedSeconds;
        setCaptureOrbitElapsedSeconds(nextElapsedSeconds);
        orbitLoopFrameRef.current = window.requestAnimationFrame(tick);
      };
      orbitLoopFrameRef.current = window.requestAnimationFrame(tick);
      return () => {
        if (orbitLoopFrameRef.current != null) {
          window.cancelAnimationFrame(orbitLoopFrameRef.current);
          orbitLoopFrameRef.current = null;
        }
      };
    }

    if (!isTerminalPlaybackSample) {
      captureOrbitElapsedSecondsRef.current = 0;
      setCaptureOrbitElapsedSeconds(0);
    }

    return () => {
      if (orbitLoopFrameRef.current != null) {
        window.cancelAnimationFrame(orbitLoopFrameRef.current);
        orbitLoopFrameRef.current = null;
      }
    };
  }, [
    captureBody,
    displayedCapturePathPoints,
    isPlaying,
    isTerminalPlaybackSample,
  ]);

  function handlePlaybackSampleChange(nextIndex: number) {
    setSelectedPhaseJumpId(null);
    onSampleIndexChange(nextIndex);
  }

  function handlePhaseJump(phaseId: string, sampleIndex: number) {
    setSelectedPhaseJumpId(phaseId);
    onSampleIndexChange(sampleIndex);
  }

  function handleZoomChange(nextZoom: number) {
    setZoomLevel(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
  }

  function handleSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }

    pointerGestureRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleSurfacePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.lastX;
    const deltaY = event.clientY - gesture.lastY;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    pointerGestureRef.current = {
      ...gesture,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setOrbitCameraState((current) => applyOrbitDragDelta(current, { deltaX, deltaY }));
  }

  function handleSurfacePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerGestureRef.current?.pointerId === event.pointerId) {
      pointerGestureRef.current = null;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleSurfaceClick(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const clickedProbe = runtime.hitTestProbe(event.clientX, event.clientY);
    setScenePerspective((current) => resolveNextScenePerspective(current, clickedProbe));
  }

  function handleSurfaceWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setOrbitCameraState((current) => applyOrbitWheelDelta(current, event.deltaY));
  }

  function handleSurfaceTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2) {
      touchGestureRef.current = {
        mode: "pinch",
        lastDistance: measureTouchDistance(event.touches[0], event.touches[1]),
      };
      event.preventDefault();
      return;
    }

    if (event.touches.length === 1) {
      touchGestureRef.current = {
        mode: "rotate",
        touchId: event.touches[0].identifier,
        lastX: event.touches[0].clientX,
        lastY: event.touches[0].clientY,
      };
    }
  }

  function handleSurfaceTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const gesture = touchGestureRef.current;
    if (!gesture) {
      return;
    }

    if (gesture.mode === "pinch" && event.touches.length >= 2) {
      const nextDistance = measureTouchDistance(event.touches[0], event.touches[1]);
      if (gesture.lastDistance > 0) {
        setOrbitCameraState((current) => applyOrbitPinchScale(current, nextDistance / gesture.lastDistance));
      }
      touchGestureRef.current = {
        mode: "pinch",
        lastDistance: nextDistance,
      };
      event.preventDefault();
      return;
    }

    if (gesture.mode === "rotate" && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.lastX;
      const deltaY = touch.clientY - gesture.lastY;
      touchGestureRef.current = {
        mode: "rotate",
        touchId: touch.identifier,
        lastX: touch.clientX,
        lastY: touch.clientY,
      };
      setOrbitCameraState((current) => applyOrbitDragDelta(current, { deltaX, deltaY }));
      event.preventDefault();
    }
  }

  function handleSurfaceTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2) {
      touchGestureRef.current = {
        mode: "pinch",
        lastDistance: measureTouchDistance(event.touches[0], event.touches[1]),
      };
      return;
    }

    if (event.touches.length === 1) {
      touchGestureRef.current = {
        mode: "rotate",
        touchId: event.touches[0].identifier,
        lastX: event.touches[0].clientX,
        lastY: event.touches[0].clientY,
      };
      return;
    }

    touchGestureRef.current = null;
  }

  return (
    <section className="scene-shell" aria-label={copy.trajectoryScene}>
      <div className="scene-shell__hud">
        <div className="scene-shell__hud-copy">
          <p>{currentEpoch ? `${copy.currentEpoch}: ${currentEpoch}` : copy.currentEpochPending}</p>
          {currentMissionSegmentLabel ? (
            <p>{`${copy.missionSegments}: ${currentMissionSegmentLabel}`}</p>
          ) : null}
          <p>{`${copy.missionObjective}: ${currentObjective}`}</p>
          <p>{`${copy.nextEvent}: ${nextEventSummary}`}</p>
          <p>{`${copy.currentSpeed}: ${formatSpeedValue(telemetry.currentValue)}`}</p>
          {navigationVisuals.hud ? (
            <>
              <p>{`${copy.navigationMode}: ${copy.navigationDispersed}`}</p>
              {navigationVisuals.hud.predictedMissKm != null ? (
                <p>{`${copy.maxPredictedMiss}: ${formatDistanceKmValue(navigationVisuals.hud.predictedMissKm)}`}</p>
              ) : null}
              {navigationVisuals.hud.positionDeviationKm != null ? (
                <p>{`${copy.maxPositionDeviation}: ${formatDistanceKmValue(navigationVisuals.hud.positionDeviationKm)}`}</p>
              ) : null}
              <p>
                {`${copy.correctionStatus}: ${
                  navigationVisuals.hud.correctionStatus === "within-thresholds"
                    ? copy.withinThresholds
                    : navigationVisuals.hud.correctionStatus === "tcm-triggered"
                      ? copy.activeManeuver
                      : copy.maneuverExecution
                }`}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={surfaceRef}
        className="scene-shell__surface"
        data-testid="scene-surface"
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        onClick={handleSurfaceClick}
        onWheel={handleSurfaceWheel}
        onTouchStart={handleSurfaceTouchStart}
        onTouchMove={handleSurfaceTouchMove}
        onTouchEnd={handleSurfaceTouchEnd}
        onTouchCancel={() => {
          touchGestureRef.current = null;
        }}
      >
        <canvas ref={canvasRef} aria-label={copy.threeCanvas} className="scene-canvas" />
        {arrivalCaptureModel ? (
          <span
            hidden
            data-testid="arrival-capture-orbit"
            data-probe-mode={terminalOrbitProbeSample ? "capture-orbit" : "transfer"}
            data-source={arrivalCaptureModel.source}
          />
        ) : null}

        <TrajectoryInsetMap model={insetMapModel} language={language} />

        {(activeManeuver || upcomingManeuver) ? (
          <div className="scene-maneuver-panel" aria-label={copy.maneuverEventsLabel}>
            <span className="scene-maneuver-panel__label">
              {activeManeuver ? copy.activeManeuver : copy.upcomingManeuver}
            </span>
            <strong>{(activeManeuver ?? upcomingManeuver)?.type}</strong>
            <div className="scene-maneuver-panel__meta">
              <span>{copy.burnDuration}</span>
              <strong>{formatDurationSeconds((activeManeuver ?? upcomingManeuver)?.durationSeconds ?? 0)}</strong>
            </div>
            <div className="scene-maneuver-panel__meta">
              <span>{copy.burnDirection}</span>
              <strong>{(activeManeuver ?? upcomingManeuver)?.thrustDirection}</strong>
            </div>
            {(activeManeuver ?? upcomingManeuver)?.massAfterKg != null ? (
              <div className="scene-maneuver-panel__meta">
                <span>{copy.remainingMass}</span>
                <strong>{formatMassKg((activeManeuver ?? upcomingManeuver)?.massAfterKg ?? 0)}</strong>
              </div>
            ) : null}
          </div>
        ) : null}

      </div>

      <div className="scene-body-list scene-body-list--inline" aria-label={copy.visibleBodies}>
        {bodies.map((body) => (
          <div
            key={body.bodyId}
            className="scene-body-chip"
            data-active={hoveredBodyId === body.bodyId ? "true" : "false"}
            title={`${planetLabel(language, body.bodyId)} · ${body.sourceName}`}
            aria-label={`${copy.bodyPrefix}: ${planetLabel(language, body.bodyId)}`}
            onMouseEnter={() => setHoveredBodyId(body.bodyId)}
            onMouseLeave={() => setHoveredBodyId(null)}
            onFocus={() => setHoveredBodyId(body.bodyId)}
            onBlur={() => setHoveredBodyId(null)}
            tabIndex={0}
          >
            <span
              className="scene-body-chip__dot"
              style={{ background: bodyColors[body.bodyId] ?? "#f5f3ed" }}
              aria-hidden="true"
            />
            <span>{`${copy.bodyPrefix}: ${planetLabel(language, body.bodyId)}`}</span>
          </div>
        ))}
      </div>

      <div className="scene-shell__footer">
        <div className="scene-shell__footer-main">
          <div className="scene-shell__footer-controls">
            <div className="scene-playback-actions">
              <button
                type="button"
                className="scene-action-button"
                onClick={() => {
                  if (isPlaying) {
                    onPause();
                    return;
                  }
                  setSelectedPhaseJumpId(null);
                  onPlay();
                }}
              >
                {isPlaying ? copy.pause : copy.start}
              </button>
              <button
                type="button"
                className="scene-action-button scene-action-button--ghost"
                onClick={() => {
                  setSelectedPhaseJumpId(null);
                  onReset();
                }}
              >
                {copy.reset}
              </button>
            </div>

            <div className="scene-slider">
              <span className="scene-slider__label">{copy.playbackStep}</span>
              <input
                aria-label={copy.playbackStep}
                type="range"
                min={0}
                max={Math.max(result.samples.length - 1, 0)}
                step={1}
                value={selectedSampleIndex}
                onChange={(event) => handlePlaybackSampleChange(Number(event.target.value))}
              />
            </div>

            <label className="scene-slider scene-slider--compact">
              <span className="scene-slider__label">{copy.zoomLevel}</span>
              <input
                aria-label={copy.zoomLevel}
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoomLevel}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
              />
            </label>
          </div>

          {playbackPhaseMarkers.length ? (
            <div
              className="scene-phase-jump-bar"
              data-testid="playback-phase-jump-bar"
              aria-label={copy.phaseTimeline}
            >
              {playbackPhaseMarkers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  className="scene-phase-jump-chip"
                  data-active={marker.isActive ? "true" : "false"}
                  data-testid={`playback-phase-jump-${marker.id}`}
                  aria-label={`${copy.phaseTimeline}: ${formatPlaybackPhaseMarkerLabel(language, marker)} · ${marker.startEpoch}`}
                  aria-pressed={marker.isActive}
                  title={`${formatPlaybackPhaseMarkerLabel(language, marker)} · ${marker.startEpoch}`}
                  onClick={() => handlePhaseJump(marker.id, marker.sampleIndex)}
                >
                  {formatPlaybackPhaseMarkerLabel(language, marker)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

      </div>
    </section>
  );
}

function formatPlaybackPhaseMarkerLabel(language: Language, marker: MissionTimelinePhaseMarker): string {
  if (
    marker.phaseType === "targetApproach" ||
    marker.phaseType === "arrivalPass" ||
    marker.phaseType === "scienceOperations" ||
    marker.phaseType === "downlink"
  ) {
    return marker.title;
  }

  const localized = localizeMissionSegment(language, marker.phaseType);
  return localized === marker.phaseType ? marker.title : localized;
}

function createSceneRuntime(canvas: HTMLCanvasElement, surface: HTMLDivElement): SceneRuntime | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#07111e", 0.0015);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
    camera.position.set(0, 32, 84);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight("#8aa7d9", 1.9);
    const sunLight = new THREE.PointLight("#ffd49e", 3.2, 0, 1.5);
    sunLight.position.set(0, 0, 0);

    const missionGroup = new THREE.Group();
    const bodiesGroup = new THREE.Group();
    const playbackGroup = new THREE.Group();
    const probeVisual = createProbeVisual();
    let probeVisible = true;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    scene.add(ambient);
    scene.add(sunLight);
    scene.add(missionGroup);
    scene.add(bodiesGroup);
    scene.add(playbackGroup);
    scene.add(probeVisual.group);

    const render = () => {
      renderer.render(scene, camera);
    };

    const applyMotion = (motion: CameraMotionState) => {
      camera.fov = motion.fovDeg;
      camera.zoom = motion.zoom;
      camera.position.set(motion.position[0], motion.position[1], motion.position[2]);
      camera.lookAt(motion.lookAt[0], motion.lookAt[1], motion.lookAt[2]);
      camera.updateProjectionMatrix();
    };

    const applyProbeMotion = (motion: ProbeMotionState) => {
      probeVisual.group.visible = probeVisible;
      probeVisual.group.position.set(motion.position[0], motion.position[1], motion.position[2]);
      probeVisual.group.lookAt(
        motion.position[0] + motion.forward[0],
        motion.position[1] + motion.forward[1],
        motion.position[2] + motion.forward[2],
      );
      probeVisual.engineGlowMaterial.emissiveIntensity = motion.engineGlowIntensity;
      probeVisual.engineGlowMaterial.opacity =
        motion.engineGlowIntensity <= 0.001 ? 0 : clamp(motion.engineGlowIntensity * 0.7, 0, 0.96);

      for (const streak of probeVisual.streakMaterials) {
        streak.material.opacity = motion.streakOpacity * streak.opacityScale;
      }
    };

    const tick = (now: number) => {
      let needsRender = false;

      if (runtime.bodyTransition) {
        const alpha = clamp((now - runtime.bodyTransition.startTimeMs) / runtime.bodyTransition.durationMs, 0, 1);
        const nextBodies =
          alpha >= 1
            ? runtime.bodyTransition.target
            : interpolateBodyStates(runtime.bodyTransition.source, runtime.bodyTransition.target, alpha);
        applyBodyStates(runtime, nextBodies);
        runtime.currentBodies = nextBodies;
        needsRender = true;
        if (alpha >= 1) {
          runtime.bodyTransition = null;
        }
      }

      if (runtime.motionTransition) {
        const alpha = clamp((now - runtime.motionTransition.startTimeMs) / runtime.motionTransition.durationMs, 0, 1);
        const nextMotion =
          alpha >= 1
            ? runtime.motionTransition.target
            : interpolateCameraMotion(runtime.motionTransition.source, runtime.motionTransition.target, alpha);
        if (nextMotion !== runtime.currentMotion) {
          runtime.currentMotion = nextMotion;
          applyMotion(runtime.currentMotion);
          needsRender = true;
        }
        if (alpha >= 1) {
          runtime.motionTransition = null;
        }
      }

      if (runtime.probeMotionTransition) {
        const alpha = clamp((now - runtime.probeMotionTransition.startTimeMs) / runtime.probeMotionTransition.durationMs, 0, 1);
        const nextProbeMotion =
          alpha >= 1
            ? runtime.probeMotionTransition.target
            : interpolateProbeMotion(runtime.probeMotionTransition.source, runtime.probeMotionTransition.target, alpha);
        if (nextProbeMotion !== runtime.currentProbeMotion) {
          runtime.currentProbeMotion = nextProbeMotion;
          applyProbeMotion(runtime.currentProbeMotion);
          needsRender = true;
        }
        if (alpha >= 1) {
          runtime.probeMotionTransition = null;
        }
      }

      if (needsRender) {
        render();
      }
      runtime.frameHandle = window.requestAnimationFrame(tick);
    };

    const resize = () => {
      const width = Math.max(surface.clientWidth, 1);
      const height = Math.max(surface.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };

    const runtime: SceneRuntime = {
      bodyTransition: null,
      bodyVisuals: new Map(),
      currentBodies: null,
      bodiesGroup,
      camera,
      frameHandle: null,
      currentMotion: null,
      currentProbeMotion: null,
      motionTransition: null,
      missionGroup,
      playbackGroup,
      probeMotionTransition: null,
      probeVisual,
      renderer,
      render,
      resizeObserver: null,
      scene,
      targetBodies: null,
      targetMotion: null,
      targetProbeMotion: null,
      hitTestProbe: (clientX, clientY) => {
        if (!probeVisual.group.visible) {
          return false;
        }

        const bounds = surface.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) {
          return false;
        }

        pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(probeVisual.pickables, true).length > 0;
      },
      setProbeTarget: (motion) => {
        if (runtime.targetProbeMotion && isProbeMotionClose(runtime.targetProbeMotion, motion)) {
          return;
        }
        runtime.targetProbeMotion = motion;
        if (!runtime.currentProbeMotion) {
          runtime.probeMotionTransition = null;
          runtime.currentProbeMotion = runtime.targetProbeMotion;
          applyProbeMotion(runtime.currentProbeMotion);
          render();
          return;
        }

        runtime.probeMotionTransition = {
          durationMs: PLAYBACK_TRANSITION_MS,
          source: runtime.currentProbeMotion,
          startTimeMs: performance.now(),
          target: motion,
        };
      },
      setView: (samplePositionKm, view, zoom, orbitState, perspective) => {
        const frame = buildProbeCameraFrame(samplePositionKm, view, zoom, orbitState, perspective);

        const nextTarget = {
          position: frame.position,
          lookAt: frame.lookAt,
          fovDeg: frame.fovDeg,
          zoom: frame.zoom,
        };
        if (runtime.targetMotion && isCameraMotionClose(runtime.targetMotion, nextTarget)) {
          return;
        }
        runtime.targetMotion = nextTarget;
        if (!runtime.currentMotion) {
          runtime.motionTransition = null;
          runtime.currentMotion = runtime.targetMotion;
          applyMotion(runtime.currentMotion);
          render();
          return;
        }

        runtime.motionTransition = {
          durationMs: PLAYBACK_TRANSITION_MS,
          source: runtime.currentMotion,
          startTimeMs: performance.now(),
          target: nextTarget,
        };
      },
      setProbeVisible: (visible) => {
        probeVisible = visible;
        probeVisual.group.visible = visible;
        render();
      },
      setZoom: (zoom: number) => {
        if (runtime.targetMotion) {
          const nextTarget = {
            ...runtime.targetMotion,
            zoom,
          };
          if (isCameraMotionClose(runtime.targetMotion, nextTarget)) {
            return;
          }
          runtime.targetMotion = nextTarget;
          if (runtime.currentMotion) {
            runtime.motionTransition = {
              durationMs: PLAYBACK_TRANSITION_MS,
              source: runtime.currentMotion,
              startTimeMs: performance.now(),
              target: nextTarget,
            };
          }
        }
      },
      stop: () => {
        runtime.resizeObserver?.disconnect();
        if (runtime.frameHandle != null) {
          window.cancelAnimationFrame(runtime.frameHandle);
        }
      },
    };

    resize();
    runtime.frameHandle = window.requestAnimationFrame(tick);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(surface);
    runtime.resizeObserver = resizeObserver;

    return runtime;
  } catch {
    return null;
  }
}

function syncMissionScene(
  runtime: SceneRuntime,
  result: TrajectoryResult,
  launchEpoch: string | null,
  language: Language,
  arrivalCaptureModel: ReturnType<typeof buildArrivalCaptureModel>,
  displayedCapturePathPoints: ReturnType<typeof buildDisplayCapturePathPoints> | null,
  navigationVisuals: NavigationVisuals,
){
  clearGroup(runtime.missionGroup);

  const launchSample = result.samples[0];
  const closestSample = findSampleForEpoch(result, result.closestApproach.epochSeconds);

  if (launchSample) {
    runtime.missionGroup.add(createAnchorMesh(launchSample.positionKm, "earth", "launch", language));
  }
  if (closestSample) {
    runtime.missionGroup.add(
      createAnchorMesh(closestSample.positionKm, result.closestApproach.bodyId, "arrival", language)
    );
  }
  for (const flybyEvent of result.flybyEvents ?? []) {
    runtime.missionGroup.add(createFlybyMarker(flybyEvent.positionKm, flybyEvent.bodyId, language));
  }
  for (const visitEvent of result.visitEvents ?? []) {
    runtime.missionGroup.add(createVisitMarker(visitEvent.positionKm, visitEvent.bodyId, language));
  }
  if (launchEpoch) {
    for (const maneuverEvent of result.maneuverEvents ?? []) {
      const maneuverSample = findSampleForEventEpoch(result, launchEpoch, maneuverEvent.startEpoch);
      if (maneuverSample) {
        runtime.missionGroup.add(createManeuverMarker(maneuverSample.positionKm, maneuverEvent.type, language));
      }
    }
  }
  for (const navigationMarker of navigationVisuals.tcmMarkers) {
    runtime.missionGroup.add(createManeuverMarker(navigationMarker.sample.positionKm, "TCM", language));
  }

  if (navigationVisuals.nominalPath.length > 0) {
    const nominalTrajectorySamples = buildDisplayTrajectorySamples(
      navigationVisuals.nominalPath,
      result.closestApproach.epochSeconds,
      null,
      null,
    );
    runtime.missionGroup.add(createTrajectoryLine(nominalTrajectorySamples, "#b5c7d1", 0.12));
  }

  const missionTrajectorySamples = buildDisplayTrajectorySamples(
    navigationVisuals.dispersedPath.length > 0 ? navigationVisuals.dispersedPath : result.samples,
    result.closestApproach.epochSeconds,
    displayedCapturePathPoints,
    closestSample?.positionKm ?? null,
  );
  runtime.missionGroup.add(createTrajectoryLine(missionTrajectorySamples, "#8fe3ff", 0.22));
  if (displayedCapturePathPoints && closestSample) {
    runtime.missionGroup.add(
      createCaptureOrbitLine(displayedCapturePathPoints, closestSample.positionKm, "#ffd59a", 0.88),
    );
  }
  runtime.render();
}

function syncPlaybackScene(
  runtime: SceneRuntime,
  bodies: BodyState[],
  result: TrajectoryResult,
  hoveredBodyId: string | null,
  language: Language,
  cameraView: ProbeCameraView | null,
  zoomLevel: number,
  orbitCameraState: OrbitCameraState,
  scenePerspective: ScenePerspective,
  activeSample: TrajectoryResult["samples"][number],
  terminalOrbitProbeSample: TrajectoryResult["samples"][number] | null,
  activeSegment: MissionSegment | null,
  displayedPathSamples: TrajectoryResult["samples"],
  currentEpoch: string | null,
  arrivalCaptureModel: ReturnType<typeof buildArrivalCaptureModel>,
  displayedCapturePathPoints: ReturnType<typeof buildDisplayCapturePathPoints> | null,
) {
  clearGroup(runtime.playbackGroup);
  syncBodyVisuals(runtime, bodies, hoveredBodyId, cameraView, result.closestApproach.bodyId, language, scenePerspective);

  if (!runtime.currentBodies) {
    runtime.currentBodies = bodies;
    runtime.targetBodies = bodies;
    runtime.bodyTransition = null;
    applyBodyStates(runtime, bodies);
  } else if (!runtime.targetBodies || !areBodyStatesClose(runtime.targetBodies, bodies)) {
    runtime.targetBodies = bodies;
    runtime.bodyTransition = {
      durationMs: PLAYBACK_TRANSITION_MS,
      source: runtime.currentBodies,
      startTimeMs: performance.now(),
      target: bodies,
    };
  }

  const activeEncounter = shouldUseEncounterDisplayAdjustment(activeSegment?.segmentType)
    ? resolveActiveEncounterDisplay(
        bodies,
        result,
        activeSegment,
        arrivalCaptureModel,
      )
    : null;
  const adjustedDisplayedPathSamples = activeEncounter
    ? buildStableEncounterAdjustedSamples(result.samples, displayedPathSamples.length, {
        bodyPositionKm: activeEncounter.bodyPositionKm,
        encounterIndex: activeEncounter.encounterIndex,
        minSceneRadius: activeEncounter.minSceneRadius,
        halfWindow: activeEncounter.halfWindow,
      })
    : displayedPathSamples;
  const displayedActiveSample =
    adjustedDisplayedPathSamples[adjustedDisplayedPathSamples.length - 1] ??
    activeSample;

  if ((terminalOrbitProbeSample || displayedActiveSample) && cameraView) {
    const probePositionSample = terminalOrbitProbeSample
      ? terminalOrbitProbeSample
      : activeEncounter
      ? {
          ...displayedActiveSample,
          positionKm: enforceMinimumEncounterClearance(
            displayedActiveSample.positionKm,
            activeEncounter.bodyPositionKm,
            activeEncounter.minSceneRadius,
          ),
        }
      : displayedActiveSample;
    runtime.setView(
      probePositionSample.positionKm,
      cameraView,
      zoomLevel,
      orbitCameraState,
      scenePerspective,
    );
    runtime.setProbeTarget(buildProbeMotionState(probePositionSample, currentEpoch, result.maneuverEvents));
    runtime.setProbeVisible(scenePerspective !== "first-person");
  } else {
    runtime.setProbeVisible(false);
    runtime.currentProbeMotion = null;
    runtime.probeMotionTransition = null;
    runtime.targetProbeMotion = null;
  }

  const captureCenter = bodies.find((body) => body.bodyId === arrivalCaptureModel?.bodyId)?.positionKm ?? null;
  const playbackTrajectorySamples = buildDisplayTrajectorySamples(
    adjustedDisplayedPathSamples,
    result.closestApproach.epochSeconds,
    displayedCapturePathPoints,
    captureCenter,
  );

  for (const visual of createPlaybackTrajectoryVisuals(
    playbackTrajectorySamples,
    displayedCapturePathPoints,
    captureCenter,
  )) {
    runtime.playbackGroup.add(visual);
  }

  runtime.render();
}

function resolveActiveEncounterDisplay(
  bodies: BodyState[],
  result: TrajectoryResult,
  activeSegment: MissionSegment | null,
  arrivalCaptureModel: ReturnType<typeof buildArrivalCaptureModel>,
) {
  if (!result.samples.length) {
    return null;
  }

  if (arrivalCaptureModel && activeSegment && ARRIVAL_SEGMENT_TYPES.has(activeSegment.segmentType)) {
    const body = bodies.find((candidate) => candidate.bodyId === arrivalCaptureModel.bodyId);
    if (!body) {
      return null;
    }

    const closestIndex = result.samples.findIndex(
      (sample) => sample.epochSeconds === result.closestApproach.epochSeconds,
    );
    return {
      bodyPositionKm: body.positionKm,
      encounterIndex: closestIndex >= 0 ? closestIndex : result.samples.length - 1,
      minSceneRadius: bodySceneRadius(arrivalCaptureModel.bodyId) * ENCOUNTER_CLEARANCE_MULTIPLIER,
      halfWindow: 2,
    };
  }

  return null;
}

function findSampleForEpoch(result: TrajectoryResult, epochSeconds: number) {
  return result.samples.find((sample) => sample.epochSeconds === epochSeconds);
}

function findSampleForEventEpoch(
  result: TrajectoryResult,
  launchEpoch: string,
  eventEpoch: string,
) {
  const offsetSeconds = (new Date(eventEpoch).getTime() - new Date(launchEpoch).getTime()) / 1000;
  return result.samples.reduce<TrajectoryResult["samples"][number] | undefined>((closest, sample) => {
    if (!closest) {
      return sample;
    }
    const currentDistance = Math.abs(sample.epochSeconds - offsetSeconds);
    const bestDistance = Math.abs(closest.epochSeconds - offsetSeconds);
    return currentDistance < bestDistance ? sample : closest;
  }, undefined);
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function syncBodyVisuals(
  runtime: SceneRuntime,
  bodies: BodyState[],
  hoveredBodyId: string | null,
  cameraView: ProbeCameraView | null,
  closestApproachBodyId: string,
  language: Language,
  scenePerspective: ScenePerspective,
) {
  const desiredIds = new Set(bodies.map((body) => body.bodyId));

  for (const [bodyId, visual] of runtime.bodyVisuals.entries()) {
    if (desiredIds.has(bodyId)) {
      continue;
    }
    runtime.bodiesGroup.remove(visual.group);
    disposeObject(visual.group);
    runtime.bodyVisuals.delete(bodyId);
  }

  for (const body of bodies) {
    const isHighlighted = hoveredBodyId === body.bodyId;
    const { isFocusBody, focusScale } = resolveBodyFocusVisual({
      bodyId: body.bodyId,
      perspective: scenePerspective,
      cameraFocusBodyId: cameraView?.focusBodyId ?? null,
      cameraFocusScale: cameraView?.focusBodyScale ?? 1,
      closestApproachBodyId,
    });
    const styleKey = `${isHighlighted}:${isFocusBody}:${focusScale}`;
    const existing = runtime.bodyVisuals.get(body.bodyId);

    if (existing && existing.styleKey === styleKey) {
      continue;
    }

    const displayedBody = runtime.currentBodies?.find((candidate) => candidate.bodyId === body.bodyId) ?? body;
    const group = createBodyMesh(
      {
        ...body,
        positionKm: displayedBody.positionKm,
      },
      isHighlighted,
      isFocusBody,
      focusScale,
      language,
    );

    if (existing) {
      runtime.bodiesGroup.remove(existing.group);
      disposeObject(existing.group);
    }

    runtime.bodiesGroup.add(group);
    runtime.bodyVisuals.set(body.bodyId, {
      group,
      styleKey,
    });
  }
}

function applyBodyStates(runtime: SceneRuntime, bodies: BodyState[]) {
  for (const body of bodies) {
    const visual = runtime.bodyVisuals.get(body.bodyId);
    if (!visual) {
      continue;
    }
    visual.group.position.copy(toThreeVector(body.positionKm));
  }
}

function buildDisplayTrajectorySamples(
  samples: TrajectoryResult["samples"],
  closestApproachEpochSeconds: number,
  displayedCapturePathPoints: ReturnType<typeof buildDisplayCapturePathPoints> | null,
  captureCenter: [number, number, number] | null,
) {
  if (!displayedCapturePathPoints || !captureCenter || samples.length === 0 || displayedCapturePathPoints.length === 0) {
    return samples;
  }

  const closestIndex = samples.findIndex((sample) => sample.epochSeconds === closestApproachEpochSeconds);
  if (closestIndex === -1) {
    return samples;
  }

  const captureStartPoint = translateCapturePoint(displayedCapturePathPoints[0], captureCenter);
  const captureStartSample = {
    ...samples[closestIndex],
    positionKm: captureStartPoint,
  };

  return [...samples.slice(0, closestIndex), captureStartSample];
}

function createTrajectoryLine(
  samples: TrajectoryResult["samples"],
  color: string,
  opacity: number,
) {
  const points = samples.map((sample) => toThreeVector(sample.positionKm));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
  return new THREE.Line(geometry, material);
}

function createCaptureOrbitLine(
  pathPoints: Array<[number, number, number]>,
  centerPositionKm: [number, number, number],
  color: string,
  opacity: number,
) {
  const translatedPoints = pathPoints.map((point) => toThreeVector(translateCapturePoint(point, centerPositionKm)));
  const geometry = new THREE.BufferGeometry().setFromPoints(translatedPoints);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
  return new THREE.LineLoop(geometry, material);
}

export function createPlaybackTrajectoryVisuals(
  samples: TrajectoryResult["samples"],
  displayedCapturePathPoints: ReturnType<typeof buildDisplayCapturePathPoints> | null,
  captureCenter: [number, number, number] | null,
) {
  const visuals: THREE.Object3D[] = [createTrajectoryLine(samples, "#8fe3ff", 0.96)];
  if (displayedCapturePathPoints && captureCenter) {
    visuals.push(createCaptureOrbitLine(displayedCapturePathPoints, captureCenter, "#ffd59a", 0.96));
  }
  return visuals;
}

function translateCapturePoint(
  localPoint: [number, number, number],
  centerPositionKm: [number, number, number],
): [number, number, number] {
  return [
    centerPositionKm[0] + localPoint[0],
    centerPositionKm[1] + localPoint[1],
    centerPositionKm[2] + localPoint[2],
  ];
}

function createProbeVisual(): ProbeVisualRuntime {
  const group = new THREE.Group();
  const orientedGroup = new THREE.Group();
  orientedGroup.rotation.y = PROBE_MODEL_ALIGNMENT_YAW_RAD;
  group.add(orientedGroup);
  const pickables: THREE.Object3D[] = [];

  const modelGroup = new THREE.Group();
  modelGroup.scale.setScalar(PROBE_VISUAL_SCALE);
  orientedGroup.add(modelGroup);

  const effectsGroup = new THREE.Group();
  effectsGroup.scale.setScalar(PROBE_EFFECTS_SCALE);
  orientedGroup.add(effectsGroup);

  const bus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.95, 4.4, 12),
    new THREE.MeshStandardMaterial({
      color: "#c8d6e8",
      emissive: "#8fe3ff",
      emissiveIntensity: 0.28,
      metalness: 0.52,
      roughness: 0.46,
    }),
  );
  bus.rotation.z = Math.PI / 2;
  modelGroup.add(bus);
  pickables.push(bus);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 18, 18, 0, Math.PI),
    new THREE.MeshStandardMaterial({
      color: "#edf4fb",
      emissive: "#69bfff",
      emissiveIntensity: 0.15,
      metalness: 0.1,
      roughness: 0.28,
      side: THREE.DoubleSide,
    }),
  );
  dish.position.x = -2.2;
  dish.rotation.z = -Math.PI / 2;
  modelGroup.add(dish);
  pickables.push(dish);

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: "#4e86c8",
    emissive: "#1b4576",
    emissiveIntensity: 0.48,
    metalness: 0.28,
    roughness: 0.42,
  });
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 4.8), panelMaterial);
  leftPanel.position.set(0, 0, 3.6);
  modelGroup.add(leftPanel);
  pickables.push(leftPanel);
  const rightPanel = leftPanel.clone();
  rightPanel.position.set(0, 0, -3.6);
  modelGroup.add(rightPanel);
  pickables.push(rightPanel);

  const engineGlowMaterial = new THREE.MeshStandardMaterial({
    color: "#f7bf66",
    emissive: "#f7bf66",
    emissiveIntensity: 0.72,
    transparent: true,
    opacity: 0.92,
  });
  const engineGlow = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 1.8, 18),
    engineGlowMaterial,
  );
  engineGlow.position.x = 2.6;
  engineGlow.rotation.z = -Math.PI / 2;
  effectsGroup.add(engineGlow);
  pickables.push(engineGlow);

  const streakMaterials: ProbeVisualRuntime["streakMaterials"] = [];
  const streakCount = 10;
  for (let index = 0; index < streakCount; index += 1) {
    const offset = (index - (streakCount - 1) / 2) * 1.3;
    const start = new THREE.Vector3(offset, 0.18, 4.4 + index * 0.8);
    const end = new THREE.Vector3(offset, 0.18, 9 + index * 1.05);
    const material = new THREE.LineBasicMaterial({
      color: "#8fe3ff",
      transparent: true,
      opacity: 0.18,
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    effectsGroup.add(new THREE.Line(geometry, material));
    streakMaterials.push({
      material,
      opacityScale: 1 - index * 0.06,
    });
  }

  group.visible = false;

  return {
    engineGlowMaterial,
    group,
    pickables,
    streakMaterials,
  };
}

function createAnchorMesh(
  positionKm: [number, number, number],
  bodyId: string,
  phase: "launch" | "arrival",
  language: Language
) {
  const group = new THREE.Group();
  group.position.copy(toThreeVector(positionKm));

  const ringColor = new THREE.Color(phase === "launch" ? "#b8d8ff" : "#ffd59a");
  const innerRadius = phase === "launch" ? 4.2 : 4.4;
  const outerRadius = phase === "launch" ? 5.8 : 6.2;
  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 48);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: phase === "launch" ? 0.96 : 0.9,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(outerRadius * 1.08, outerRadius * 1.34, 56),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: phase === "launch" ? 0.26 : 0.18,
      side: THREE.DoubleSide,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  group.add(halo);

  const coreGeometry = new THREE.SphereGeometry(bodySceneRadius(bodyId) * 0.78, 20, 20);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: bodyColors[bodyId] ?? "#f5f3ed",
    emissive: bodyColors[bodyId] ?? "#f5f3ed",
    emissiveIntensity: phase === "launch" ? 0.35 : 0.55,
    transparent: true,
    opacity: 0.58,
    metalness: 0.08,
    roughness: 0.72,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.y = phase === "launch" ? 0.2 : 0.35;
  group.add(core);

  const label = createAnchorLabel(
    phase === "launch"
      ? t(language).earthLaunch
      : `${planetLabel(language, bodyId)} ${t(language).arrivalSuffix}`,
    ringColor,
  );
  label.position.set(0, 0.6, outerRadius * 2.2);
  group.add(label);

  return group;
}

function createBodyMesh(
  body: BodyState,
  isHighlighted: boolean,
  isFocusBody: boolean,
  focusScale: number,
  language: Language,
) {
  const radius = bodySceneRadius(body.bodyId);
  const group = new THREE.Group();
  const focusVisual = isFocusBody ? computeFocusBodyVisualProfile(body.bodyId, focusScale >= 2 ? "flyby-emphasis" : focusScale > 1 ? "approach-emphasis" : "cruise-follow") : null;
  const ringProfile = getPlanetaryRingProfile(body.bodyId);
  const geometry = new THREE.SphereGeometry(radius, 24, 24);
  const material = new THREE.MeshStandardMaterial({
    color: bodyColors[body.bodyId] ?? "#f5f3ed",
    emissive: body.bodyId === "sun" || isHighlighted || isFocusBody ? bodyColors[body.bodyId] ?? "#f5f3ed" : "#000000",
    emissiveIntensity: body.bodyId === "sun" ? 1.6 : isFocusBody ? 1.35 : isHighlighted ? 1.15 : 0,
    metalness: 0.1,
    roughness: 0.8,
  });
  const mesh = new THREE.Mesh(geometry, material);

  group.position.copy(toThreeVector(body.positionKm));
  group.add(mesh);
  if (ringProfile) {
    group.add(createPlanetaryRing(radius, ringProfile));
  }
  if (isFocusBody && body.bodyId !== "sun") {
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * (focusVisual?.haloScale ?? 1.18), 24, 24),
      new THREE.MeshBasicMaterial({
        color: focusVisual?.atmosphereColor ?? bodyColors[body.bodyId] ?? "#f5f3ed",
        transparent: true,
        opacity: focusVisual?.haloOpacity ?? 0.12,
        side: THREE.DoubleSide,
      }),
    );
    group.add(halo);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * ((focusVisual?.haloScale ?? 1.18) + 0.06), 24, 24),
      new THREE.MeshBasicMaterial({
        color: focusVisual?.atmosphereColor ?? bodyColors[body.bodyId] ?? "#f5f3ed",
        transparent: true,
        opacity: focusVisual?.atmosphereOpacity ?? 0.08,
        side: THREE.DoubleSide,
      }),
    );
    group.add(atmosphere);

    if ((focusVisual?.bandCount ?? 0) > 0) {
      group.add(createGasGiantBands(radius, focusVisual?.bandCount ?? 0, focusVisual?.bandOpacity ?? 0.12));
    }
  }
  if (isHighlighted || isFocusBody) {
    group.scale.setScalar(isFocusBody ? Math.min(focusScale, 1.04) : 1.06);
  }
  if (body.bodyId !== "sun") {
    const label = createAnchorLabel(
      planetLabel(language, body.bodyId),
      new THREE.Color(bodyColors[body.bodyId] ?? "#f5f3ed"),
    );
    label.position.set(0, radius * 1.65 + 1.1, 0);
    label.scale.multiplyScalar(0.52);
    group.add(label);
  }
  return group;
}

function createPlanetaryRing(
  radius: number,
  ringProfile: ReturnType<typeof getPlanetaryRingProfile> extends infer T ? Exclude<T, null> : never,
) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * ringProfile.innerScale, radius * ringProfile.outerScale, 64),
    new THREE.MeshBasicMaterial({
      color: ringProfile.color,
      transparent: true,
      opacity: ringProfile.opacity,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.rotation.z = ringProfile.tiltRad;
  return ring;
}

function createGasGiantBands(radius: number, bandCount: number, opacity: number) {
  const group = new THREE.Group();

  for (let index = 0; index < bandCount; index += 1) {
    const normalized = bandCount === 1 ? 0 : index / (bandCount - 1);
    const yOffset = (normalized - 0.5) * radius * 1.15;
    const ringRadius = Math.max(radius * (0.64 - Math.abs(normalized - 0.5) * 0.26), radius * 0.38);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.09, 10, 48),
      new THREE.MeshBasicMaterial({
        color: "#f6e2bf",
        transparent: true,
        opacity,
      }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = yOffset;
    group.add(band);
  }

  return group;
}

function createFlybyMarker(
  positionKm: [number, number, number],
  bodyId: string,
  language: Language,
) {
  const copy = t(language);
  const group = new THREE.Group();
  group.position.copy(toThreeVector(positionKm));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.5, 8.4, 48),
    new THREE.MeshBasicMaterial({
      color: bodyColors[bodyId] ?? "#f5f3ed",
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const label = createAnchorLabel(
    `${planetLabel(language, bodyId)} ${copy.assistSuffix}`,
    new THREE.Color(bodyColors[bodyId] ?? "#f5f3ed"),
  );
  label.position.set(0, 0.6, 15);
  group.add(label);
  return group;
}

function createVisitMarker(
  positionKm: [number, number, number],
  bodyId: string,
  language: Language,
) {
  const copy = t(language);
  const group = new THREE.Group();
  group.position.copy(toThreeVector(positionKm));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(9.2, 11.6, 56),
    new THREE.MeshBasicMaterial({
      color: "#ffd46b",
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 18, 18),
    new THREE.MeshStandardMaterial({
      color: bodyColors[bodyId] ?? "#f5f3ed",
      emissive: "#ffd46b",
      emissiveIntensity: 0.45,
      metalness: 0.08,
      roughness: 0.72,
      transparent: true,
      opacity: 0.9,
    }),
  );
  core.position.y = 0.35;
  group.add(core);

  const label = createAnchorLabel(
    `${planetLabel(language, bodyId)} ${copy.visitSuffix}`,
    new THREE.Color("#ffd46b"),
  );
  label.position.set(0, 0.8, 19);
  group.add(label);
  return group;
}

function createManeuverMarker(
  positionKm: [number, number, number],
  maneuverType: string,
  language: Language,
) {
  const group = new THREE.Group();
  group.position.copy(toThreeVector(positionKm));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.4, 9.6, 52),
    new THREE.MeshBasicMaterial({
      color: "#8fe3ff",
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.4, 0),
    new THREE.MeshStandardMaterial({
      color: "#f7bf66",
      emissive: "#f7bf66",
      emissiveIntensity: 0.48,
      metalness: 0.12,
      roughness: 0.56,
    }),
  );
  core.position.y = 0.4;
  group.add(core);

  const label = createAnchorLabel(
    `${maneuverType} ${t(language).maneuverEventsLabel}`,
    new THREE.Color("#8fe3ff"),
  );
  label.position.set(0, 0.8, 18);
  group.add(label);
  return group;
}

function toThreeVector(positionKm: [number, number, number]) {
  return new THREE.Vector3(
    scaleDistanceKm(positionKm[0]) * 1.8,
    scaleDistanceKm(positionKm[2]) * 0.8,
    scaleDistanceKm(positionKm[1]) * 1.8
  );
}

function bodySceneRadius(bodyId: string) {
  const physicalRadiusKm =
    BODY_PHYSICAL_RADII_KM[bodyId as keyof typeof BODY_PHYSICAL_RADII_KM] ??
    BODY_PHYSICAL_RADII_KM.earth;
  return sceneBodyRadiusFromPhysicalKm(physicalRadiusKm);
}

function toThreeDirection(direction: [number, number, number]) {
  const vector = new THREE.Vector3(direction[0], direction[2] * 0.45, direction[1]).normalize();
  if (vector.lengthSq() === 0) {
    return new THREE.Vector3(0, 0, 1);
  }
  return vector;
}

function buildProbeMotionState(
  sample: TrajectoryResult["samples"][number],
  currentEpoch: string | null,
  maneuverEvents: ManeuverEvent[] | undefined,
): ProbeMotionState {
  const thrustState = resolveProbeThrustState(currentEpoch, maneuverEvents);
  const attitudeDirection = resolveProbeAttitudeDirection(sample, thrustState.thrustDirection);
  const forward = toThreeDirection(attitudeDirection);

  return {
    position: vectorToTuple(toThreeVector(sample.positionKm)),
    forward: vectorToTuple(forward),
    engineGlowIntensity: thrustState.engineGlowIntensity,
    streakOpacity: thrustState.streakOpacity,
  };
}

function vectorToTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function measureTouchDistance(left: Touch, right: Touch) {
  return Math.hypot(right.clientX - left.clientX, right.clientY - left.clientY);
}

function formatDurationSeconds(seconds: number) {
  if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(1)} h`;
  }
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)} min`;
  }
  return `${Math.round(seconds)} s`;
}

function formatMassKg(value: number) {
  return `${value.toFixed(1)} kg`;
}

function formatDistanceKmValue(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)} km`;
}

function formatTimeUntil(currentEpoch: string, eventEpoch: string, language: Language) {
  const deltaSeconds = Math.max((new Date(eventEpoch).getTime() - new Date(currentEpoch).getTime()) / 1000, 0);
  return formatRelativeDurationSeconds(deltaSeconds, language);
}

function formatProbeViewMode(mode: ProbeCameraView["mode"], language: Language) {
  if (language === "zh") {
    if (mode === "flyby-emphasis") {
      return "飞越增强视角";
    }
    if (mode === "approach-emphasis") {
      return "目标接近视角";
    }
    return "混合跟随视角";
  }

  if (mode === "flyby-emphasis") {
    return "Flyby emphasis";
  }
  if (mode === "approach-emphasis") {
    return "Approach emphasis";
  }
  return "Hybrid follow view";
}

function findActiveManeuver(maneuverEvents: ManeuverEvent[] | undefined, currentEpoch: string | null) {
  if (!maneuverEvents?.length || !currentEpoch) {
    return null;
  }

  const currentTimeMs = new Date(currentEpoch).getTime();
  return (
    maneuverEvents.find((event) => {
      const startMs = new Date(event.startEpoch).getTime();
      const endMs = startMs + event.durationSeconds * 1000;
      return currentTimeMs >= startMs && currentTimeMs <= endMs;
    }) ?? null
  );
}

function findUpcomingManeuver(maneuverEvents: ManeuverEvent[] | undefined, currentEpoch: string | null) {
  if (!maneuverEvents?.length || !currentEpoch) {
    return null;
  }

  const currentTimeMs = new Date(currentEpoch).getTime();
  return (
    maneuverEvents
      .filter((event) => new Date(event.startEpoch).getTime() > currentTimeMs)
      .sort((left, right) => new Date(left.startEpoch).getTime() - new Date(right.startEpoch).getTime())[0] ?? null
  );
}

function findActiveSegment(segments: MissionSegment[], currentEpoch: string | null) {
  if (!segments.length) {
    return null;
  }

  if (!currentEpoch) {
    return segments[0] ?? null;
  }

  const currentTimeMs = new Date(currentEpoch).getTime();
  return (
    segments.find((segment) => {
      const startMs = new Date(segment.startEpoch).getTime();
      const endMs = new Date(segment.endEpoch).getTime();
      return currentTimeMs >= startMs && currentTimeMs <= endMs;
    }) ?? segments[0]
  );
}

function createAnchorLabel(text: string, color: THREE.Color) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Object3D();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(6, 18, 31, 0.86)";
  context.strokeStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.95)`;
  context.lineWidth = 3;
  roundRect(context, 8, 16, 304, 56, 18);
  context.fill();
  context.stroke();
  context.fillStyle = "#eef4fb";
  context.font = "600 28px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(18, 5.4, 1);
  return sprite;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        material.dispose();
      }
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  });
}
