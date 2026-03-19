import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { planetLabel, t, type Language } from "../../../lib/i18n";
import type { BodyState, ManeuverEvent, TrajectoryResult } from "../../mission/types";
import { scaleDistanceKm } from "../lib/scale";
import {
  buildSpeedTelemetry,
  formatDeltaSpeed,
  formatSpeedValue,
  type SpeedTelemetryMode,
} from "../lib/speed-telemetry";
import { computeBirdsEyeFrame, type BirdsEyeFrame } from "../lib/view";

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
  camera: THREE.OrthographicCamera;
  dynamicGroup: THREE.Group;
  frame: BirdsEyeFrame;
  renderer: THREE.WebGLRenderer;
  resizeObserver: ResizeObserver | null;
  render: () => void;
  scene: THREE.Scene;
  setFrame: (frame: BirdsEyeFrame) => void;
  setZoom: (zoom: number) => void;
  stop: () => void;
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

const bodyRadii: Record<string, number> = {
  sun: 10,
  mercury: 2.6,
  venus: 3.4,
  earth: 3.6,
  mars: 3.1,
  jupiter: 6.4,
  saturn: 5.8,
  uranus: 4.8,
  neptune: 4.7
};

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.4;
const DEFAULT_ZOOM = 1.15;

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
  const [renderMode, setRenderMode] = useState<"webgl" | "fallback">("fallback");
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [telemetryMode, setTelemetryMode] = useState<SpeedTelemetryMode>("speed");
  const copy = t(language);
  const telemetry = buildSpeedTelemetry(result.samples, selectedSampleIndex, telemetryMode);
  const activeManeuver = findActiveManeuver(result.maneuverEvents, currentEpoch);
  const upcomingManeuver = activeManeuver ? null : findUpcomingManeuver(result.maneuverEvents, currentEpoch);
  const telemetryModeOptions: Array<{ key: SpeedTelemetryMode; label: string }> = [
    { key: "speed", label: copy.speedModeMagnitude },
    { key: "vx", label: copy.speedModeVx },
    { key: "vy", label: copy.speedModeVy },
    { key: "vz", label: copy.speedModeVz },
  ];

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

    syncSceneObjects(runtime, bodies, result, launchEpoch, selectedSampleIndex, hoveredBodyId, language);
  }, [bodies, result, launchEpoch, selectedSampleIndex, hoveredBodyId, language]);

  useEffect(() => {
    runtimeRef.current?.setZoom(zoomLevel);
  }, [zoomLevel]);

  function handleZoomChange(nextZoom: number) {
    setZoomLevel(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
  }

  return (
    <section className="scene-shell" aria-label={copy.trajectoryScene}>
      <div className="scene-shell__hud">
        <div className="scene-shell__hud-copy">
          <p className="eyebrow">{copy.trajectoryScene}</p>
          <h3>{copy.fixedBirdsEye}</h3>
          <p>{currentEpoch ? `${copy.currentEpoch}: ${currentEpoch}` : copy.currentEpochPending}</p>
        </div>

        <div className="scene-shell__target-card">
          <span>{copy.targetLabel}</span>
          <strong>{planetLabel(language, result.closestApproach.bodyId)}</strong>
        </div>
      </div>

      <div
        ref={surfaceRef}
        className="scene-shell__surface"
        onWheel={(event) => {
          event.preventDefault();
          handleZoomChange(zoomLevel + (event.deltaY < 0 ? 0.12 : -0.12));
        }}
      >
        <canvas ref={canvasRef} aria-label={copy.threeCanvas} className="scene-canvas" />

        <div className="scene-telemetry" aria-label={copy.speedTelemetry}>
          <div className="scene-telemetry__header">
            <div>
              <span className="scene-telemetry__label">{copy.speedTelemetry}</span>
              <strong>
                {telemetryModeOptions.find((option) => option.key === telemetryMode)?.label ?? copy.speedModeMagnitude}
              </strong>
            </div>
            <div className="scene-telemetry__tabs" aria-label={copy.speedTelemetry}>
              {telemetryModeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="scene-telemetry__tab"
                  data-active={telemetryMode === option.key ? "true" : "false"}
                  onClick={() => setTelemetryMode(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="scene-telemetry__metrics">
            <div className="scene-telemetry__metric">
              <span className="scene-telemetry__label">
                {telemetryMode === "speed" ? copy.currentSpeed : copy.currentSpeedComponent}
              </span>
              <strong>{formatSpeedValue(telemetry.currentValue)}</strong>
            </div>
            <div className="scene-telemetry__metric">
              <span className="scene-telemetry__label">{copy.speedDelta}</span>
              <strong>{formatDeltaSpeed(telemetry.deltaValue)}</strong>
            </div>
          </div>

          <SpeedTelemetryChart
            points={telemetry.points}
            selectedSampleIndex={selectedSampleIndex}
            ariaLabel={copy.speedTelemetry}
          />
        </div>

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

        <div className="scene-shell__footer-meta">
          <div>
            <span>{copy.currentSample}</span>
            <strong>{selectedSampleIndex + 1}</strong>
          </div>
          <div>
            <span>{copy.samples}</span>
            <strong>{result.samples.length}</strong>
          </div>
          <div>
            <span>{copy.warnings}</span>
            <strong>{result.warnings.length}</strong>
          </div>
          {result.visitEvents?.length ? (
            <div>
              <span>{copy.visitEventsLabel}</span>
              <strong>{result.visitEvents.length}</strong>
            </div>
          ) : null}
          {result.maneuverEvents?.length ? (
            <div>
              <span>{copy.maneuverEventsLabel}</span>
              <strong>{result.maneuverEvents.length}</strong>
            </div>
          ) : null}
          <div>
            <span>{copy.renderer}</span>
            <strong>{renderMode === "webgl" ? copy.threeJs : copy.fallback}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

type SpeedTelemetryChartProps = {
  points: number[];
  selectedSampleIndex: number;
  ariaLabel: string;
};

function SpeedTelemetryChart({ points, selectedSampleIndex, ariaLabel }: SpeedTelemetryChartProps) {
  if (points.length === 0) {
    return null;
  }

  const width = 240;
  const height = 92;
  const padding = 10;
  const safeIndex = Math.min(Math.max(selectedSampleIndex, 0), points.length - 1);
  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
  const span = Math.max(maxValue - minValue, 1);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coordinates = points.map((value, index) => {
    const x = padding + index * stepX;
    const normalized = (value - minValue) / span;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const activePoint = coordinates[safeIndex];

  return (
    <svg
      className="scene-telemetry__chart"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      role="img"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="rgba(147, 231, 255, 0.95)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#f7bf66" />
    </svg>
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

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    camera.position.set(0, 260, 0.01);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight("#8aa7d9", 1.9);
    const sunLight = new THREE.PointLight("#ffd49e", 3.2, 0, 1.5);
    sunLight.position.set(0, 0, 0);

    const dynamicGroup = new THREE.Group();

    scene.add(ambient);
    scene.add(sunLight);
    scene.add(dynamicGroup);

    const render = () => {
      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = Math.max(surface.clientWidth, 1);
      const height = Math.max(surface.clientHeight, 1);
      const frustumHeight = runtime.frame.halfSpan * 2;
      const aspect = width / height;
      camera.left = (-frustumHeight * aspect) / 2;
      camera.right = (frustumHeight * aspect) / 2;
      camera.top = frustumHeight / 2;
      camera.bottom = -frustumHeight / 2;
      camera.position.set(runtime.frame.center.x, 260, runtime.frame.center.z + 0.01);
      camera.lookAt(runtime.frame.center.x, 0, runtime.frame.center.z);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };

    const runtime: SceneRuntime = {
      camera,
      dynamicGroup,
      frame: {
        center: { x: 0, z: 0 },
        halfSpan: 60,
      },
      renderer,
      render,
      resizeObserver: null,
      scene,
      setFrame: (frame: BirdsEyeFrame) => {
        runtime.frame = frame;
        resize();
      },
      setZoom: (zoom: number) => {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        render();
      },
      stop: () => {
        runtime.resizeObserver?.disconnect();
      },
    };

    resize();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(surface);
    runtime.resizeObserver = resizeObserver;

    return runtime;
  } catch {
    return null;
  }
}

function syncSceneObjects(
  runtime: SceneRuntime,
  bodies: BodyState[],
  result: TrajectoryResult,
  launchEpoch: string | null,
  selectedSampleIndex: number,
  hoveredBodyId: string | null,
  language: Language
) {
  clearGroup(runtime.dynamicGroup);
  runtime.setFrame(computeBirdsEyeFrame(result.samples, bodies));

  const launchSample = result.samples[0];
  const closestSample = findSampleForEpoch(result, result.closestApproach.epochSeconds);

  if (launchSample) {
    runtime.dynamicGroup.add(createAnchorMesh(launchSample.positionKm, "earth", "launch", language));
  }
  if (closestSample) {
    runtime.dynamicGroup.add(
      createAnchorMesh(closestSample.positionKm, result.closestApproach.bodyId, "arrival", language)
    );
  }
  for (const flybyEvent of result.flybyEvents ?? []) {
    runtime.dynamicGroup.add(createFlybyMarker(flybyEvent.positionKm, flybyEvent.bodyId, language));
  }
  for (const visitEvent of result.visitEvents ?? []) {
    runtime.dynamicGroup.add(createVisitMarker(visitEvent.positionKm, visitEvent.bodyId, language));
  }
  if (launchEpoch) {
    for (const maneuverEvent of result.maneuverEvents ?? []) {
      const maneuverSample = findSampleForEventEpoch(result, launchEpoch, maneuverEvent.startEpoch);
      if (maneuverSample) {
        runtime.dynamicGroup.add(createManeuverMarker(maneuverSample.positionKm, maneuverEvent.type, language));
      }
    }
  }
  runtime.dynamicGroup.add(createTrajectoryLine(result.samples, "#8fe3ff", 0.22));
  runtime.dynamicGroup.add(createTrajectoryLine(result.samples.slice(0, selectedSampleIndex + 1), "#8fe3ff", 0.96));
  runtime.dynamicGroup.add(createTrajectoryMarkers(result.samples.slice(0, selectedSampleIndex + 1)));
  runtime.dynamicGroup.add(createProbeMarker(result.samples[selectedSampleIndex]));

  for (const body of bodies) {
    runtime.dynamicGroup.add(createBodyMesh(body, hoveredBodyId === body.bodyId));
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

function createProbeMarker(sample: TrajectoryResult["samples"][number] | undefined) {
  const geometry = new THREE.SphereGeometry(1.6, 20, 20);
  const material = new THREE.MeshStandardMaterial({
    color: "#8fe3ff",
    emissive: "#54d2ff",
    emissiveIntensity: 1.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  if (sample) {
    mesh.position.copy(toThreeVector(sample.positionKm));
  }
  return mesh;
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

  const coreGeometry = new THREE.SphereGeometry((bodyRadii[bodyId] ?? 1.8) * 0.78, 20, 20);
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

function createBodyMesh(body: BodyState, isHighlighted: boolean) {
  const radius = bodyRadii[body.bodyId] ?? 1.8;
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(radius, 24, 24);
  const material = new THREE.MeshStandardMaterial({
    color: bodyColors[body.bodyId] ?? "#f5f3ed",
    emissive: body.bodyId === "sun" || isHighlighted ? bodyColors[body.bodyId] ?? "#f5f3ed" : "#000000",
    emissiveIntensity: body.bodyId === "sun" ? 1.6 : isHighlighted ? 1.15 : 0,
    metalness: 0.1,
    roughness: 0.8,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const orbitMarker = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.35, radius * 1.7, 40),
    new THREE.MeshBasicMaterial({
      color: bodyColors[body.bodyId] ?? "#f5f3ed",
      transparent: true,
      opacity: body.bodyId === "sun" ? 0.22 : 0.34,
      side: THREE.DoubleSide,
    }),
  );
  orbitMarker.rotation.x = -Math.PI / 2;

  group.position.copy(toThreeVector(body.positionKm));
  group.add(orbitMarker);
  group.add(mesh);
  if (isHighlighted) {
    group.scale.setScalar(1.2);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
