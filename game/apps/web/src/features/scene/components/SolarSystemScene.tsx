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
import type { BodyState, ManeuverEvent, MissionSegment, TrajectoryResult } from "../../mission/types";
import TrajectoryInsetMap from "./TrajectoryInsetMap";
import { computeProbeCameraView, type ProbeCameraView } from "../lib/camera";
import { buildProbeCameraFrame } from "../lib/camera-frame";
import {
  advanceCameraMotion,
  advanceProbeMotion,
  type CameraMotionState,
  type ProbeMotionState,
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
import { buildInsetMapModel } from "../lib/inset-map";
import { getMissionTimelineSnapshot } from "../lib/mission-timeline";
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
import { compressSceneDistanceKm } from "../lib/scale";
import {
  buildSpeedTelemetry,
  formatSpeedValue,
} from "../lib/speed-telemetry";
import { resolveProbeThrustState } from "../lib/probe-thrust";
import {
  buildArrivalCaptureModel,
  buildDisplayCapturePathPoints,
} from "../lib/arrival-capture";

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
  bodiesGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  frameHandle: number | null;
  currentMotion: CameraMotionState | null;
  currentProbeMotion: ProbeMotionState | null;
  missionGroup: THREE.Group;
  playbackGroup: THREE.Group;
  probeVisual: ProbeVisualRuntime;
  renderer: THREE.WebGLRenderer;
  resizeObserver: ResizeObserver | null;
  render: () => void;
  scene: THREE.Scene;
  targetMotion: CameraMotionState | null;
  targetProbeMotion: ProbeMotionState | null;
  setProbeTarget: (motion: ProbeMotionState) => void;
  setView: (
    samplePositionKm: [number, number, number],
    view: ProbeCameraView,
    zoom: number,
    orbitState: OrbitCameraState,
  ) => void;
  setZoom: (zoom: number) => void;
  stop: () => void;
};

type ProbeVisualRuntime = {
  engineGlowMaterial: THREE.MeshStandardMaterial;
  group: THREE.Group;
  streakMaterials: Array<{
    material: THREE.LineBasicMaterial;
    opacityScale: number;
  }>;
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
  const [renderMode, setRenderMode] = useState<"webgl" | "fallback">("fallback");
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [orbitCameraState, setOrbitCameraState] = useState<OrbitCameraState>(() => createDefaultOrbitCameraState());
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const copy = t(language);
  const telemetry = buildSpeedTelemetry(result.samples, selectedSampleIndex, "speed");
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
  const nextEvent = timelineSnapshot.nextEvent;
  const currentObjective = result.missionTimeline?.currentObjective ?? planetLabel(language, result.closestApproach.bodyId);
  const nextEventSummary = nextEvent && currentEpoch
    ? `${nextEvent.title} · ${formatTimeUntil(currentEpoch, nextEvent.epoch, language)}`
    : nextEvent?.title ?? copy.noUpcomingEvent;
  const activeSegment = findActiveSegment(result.segments ?? [], currentEpoch);
  const baseSampleIndex = Math.min(selectedSampleIndex, Math.max(result.samples.length - 1, 0));
  const activeSample = result.samples[baseSampleIndex] ?? result.samples[0];
  const displayedPathSamples = result.samples.slice(0, baseSampleIndex + 1);
  const cameraView = activeSample
    ? computeProbeCameraView({
        sample: activeSample,
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

    syncMissionScene(runtime, result, launchEpoch, language, arrivalCaptureModel, displayedCapturePathPoints);
  }, [result, launchEpoch, language, arrivalCaptureModel, displayedCapturePathPoints]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    syncPlaybackScene(runtime, bodies, result, hoveredBodyId, language, cameraView, zoomLevel, orbitCameraState, activeSample, displayedPathSamples, currentEpoch, arrivalCaptureModel, displayedCapturePathPoints);
  }, [activeSample, bodies, result, selectedSampleIndex, hoveredBodyId, language, cameraView, zoomLevel, orbitCameraState, displayedPathSamples, currentEpoch, arrivalCaptureModel, displayedCapturePathPoints]);

  useEffect(() => {
    runtimeRef.current?.setZoom(zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    setOrbitCameraState(createDefaultOrbitCameraState());
    pointerGestureRef.current = null;
    touchGestureRef.current = null;
  }, [result]);

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
          {activeSegment ? (
            <p>{`${copy.missionSegments}: ${localizeMissionSegment(language, activeSegment.segmentType)}`}</p>
          ) : null}
          <p>{`${copy.missionObjective}: ${currentObjective}`}</p>
          <p>{`${copy.nextEvent}: ${nextEventSummary}`}</p>
          <p>{`${copy.currentSpeed}: ${formatSpeedValue(telemetry.currentValue)}`}</p>
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
              <button type="button" className="scene-action-button" onClick={isPlaying ? onPause : onPlay}>
                {isPlaying ? copy.pause : copy.start}
              </button>
              <button type="button" className="scene-action-button scene-action-button--ghost" onClick={onReset}>
                {copy.reset}
              </button>
            </div>

            <label className="scene-slider">
              <span>{copy.playbackStep}</span>
              <input
                aria-label={copy.playbackStep}
                type="range"
                min={0}
                max={Math.max(result.samples.length - 1, 0)}
                step={1}
                value={selectedSampleIndex}
                onChange={(event) => onSampleIndexChange(Number(event.target.value))}
              />
            </label>

            <label className="scene-slider scene-slider--compact">
              <span>{copy.zoomLevel}</span>
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
        </div>

      </div>
    </section>
  );
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
      probeVisual.group.visible = true;
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

    const tick = () => {
      let needsRender = false;

      if (runtime.targetMotion) {
        const nextMotion = runtime.currentMotion
          ? advanceCameraMotion(runtime.currentMotion, runtime.targetMotion, 0.16)
          : runtime.targetMotion;
        if (nextMotion !== runtime.currentMotion) {
          runtime.currentMotion = nextMotion;
          applyMotion(runtime.currentMotion);
          needsRender = true;
        }
      }

      if (runtime.targetProbeMotion) {
        const nextProbeMotion = runtime.currentProbeMotion
          ? advanceProbeMotion(runtime.currentProbeMotion, runtime.targetProbeMotion, 0.22)
          : runtime.targetProbeMotion;
        if (nextProbeMotion !== runtime.currentProbeMotion) {
          runtime.currentProbeMotion = nextProbeMotion;
          applyProbeMotion(runtime.currentProbeMotion);
          needsRender = true;
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
      bodiesGroup,
      camera,
      frameHandle: null,
      currentMotion: null,
      currentProbeMotion: null,
      missionGroup,
      playbackGroup,
      probeVisual,
      renderer,
      render,
      resizeObserver: null,
      scene,
      targetMotion: null,
      targetProbeMotion: null,
      setProbeTarget: (motion) => {
        runtime.targetProbeMotion = motion;
        if (!runtime.currentProbeMotion) {
          runtime.currentProbeMotion = runtime.targetProbeMotion;
          applyProbeMotion(runtime.currentProbeMotion);
          render();
        }
      },
      setView: (samplePositionKm, view, zoom, orbitState) => {
        const frame = buildProbeCameraFrame(samplePositionKm, view, zoom, orbitState);

        runtime.targetMotion = {
          position: frame.position,
          lookAt: frame.lookAt,
          fovDeg: frame.fovDeg,
          zoom: frame.zoom,
        };
        if (!runtime.currentMotion) {
          runtime.currentMotion = runtime.targetMotion;
          applyMotion(runtime.currentMotion);
          render();
        }
      },
      setZoom: (zoom: number) => {
        if (runtime.targetMotion) {
          runtime.targetMotion = {
            ...runtime.targetMotion,
            zoom,
          };
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

  const missionTrajectorySamples = buildDisplayTrajectorySamples(
    result.samples,
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
  activeSample: TrajectoryResult["samples"][number],
  displayedPathSamples: TrajectoryResult["samples"],
  currentEpoch: string | null,
  arrivalCaptureModel: ReturnType<typeof buildArrivalCaptureModel>,
  displayedCapturePathPoints: ReturnType<typeof buildDisplayCapturePathPoints> | null,
) {
  clearGroup(runtime.playbackGroup);
  clearGroup(runtime.bodiesGroup);

  if (activeSample && cameraView) {
    runtime.setView(
      activeSample.positionKm,
      cameraView,
      zoomLevel,
      orbitCameraState,
    );
    runtime.setProbeTarget(buildProbeMotionState(activeSample, currentEpoch, result.maneuverEvents));
  } else {
    runtime.probeVisual.group.visible = false;
    runtime.currentProbeMotion = null;
    runtime.targetProbeMotion = null;
  }

  const captureCenter = bodies.find((body) => body.bodyId === arrivalCaptureModel?.bodyId)?.positionKm ?? null;
  const playbackTrajectorySamples = buildDisplayTrajectorySamples(
    displayedPathSamples,
    result.closestApproach.epochSeconds,
    displayedCapturePathPoints,
    captureCenter,
  );

  runtime.playbackGroup.add(createTrajectoryLine(playbackTrajectorySamples, "#8fe3ff", 0.96));
  runtime.playbackGroup.add(createTrajectoryMarkers(playbackTrajectorySamples));
  if (displayedCapturePathPoints && captureCenter) {
    runtime.playbackGroup.add(
      createCaptureOrbitLine(displayedCapturePathPoints, captureCenter, "#ffd59a", 0.96),
    );
  }

  for (const body of bodies) {
    runtime.bodiesGroup.add(
      createBodyMesh(
        body,
        hoveredBodyId === body.bodyId,
        body.bodyId === cameraView?.focusBodyId || body.bodyId === result.closestApproach.bodyId,
        body.bodyId === cameraView?.focusBodyId ? cameraView.focusBodyScale : 1,
      ),
    );
  }

  runtime.render();
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

function createTrajectoryMarkers(samples: TrajectoryResult["samples"]) {
  const points = samples.map((sample) => toThreeVector(sample.positionKm));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.PointsMaterial({
    color: "#9cf3ff",
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.92,
  });
  return new THREE.Points(geometry, material);
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
  const rightPanel = leftPanel.clone();
  rightPanel.position.set(0, 0, -3.6);
  modelGroup.add(rightPanel);

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

function createBodyMesh(body: BodyState, isHighlighted: boolean, isFocusBody: boolean, focusScale: number) {
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
    compressSceneDistanceKm(positionKm[0]) * 1.8,
    compressSceneDistanceKm(positionKm[2]) * 0.8,
    compressSceneDistanceKm(positionKm[1]) * 1.8
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

function formatTimeUntil(currentEpoch: string, eventEpoch: string, language: Language) {
  const deltaSeconds = Math.max((new Date(eventEpoch).getTime() - new Date(currentEpoch).getTime()) / 1000, 0);
  const days = deltaSeconds / 86_400;
  if (days >= 1) {
    return language === "zh" ? `${days.toFixed(1)} 天后` : `in ${days.toFixed(1)} days`;
  }

  const hours = deltaSeconds / 3_600;
  return language === "zh" ? `${hours.toFixed(1)} 小时后` : `in ${hours.toFixed(1)} hours`;
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
