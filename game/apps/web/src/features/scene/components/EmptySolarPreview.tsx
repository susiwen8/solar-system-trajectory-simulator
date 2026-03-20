import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import * as THREE from "three";

import { t, type Language } from "../../../lib/i18n";
import type { BodyState } from "../../mission/types";
import { BODY_PHYSICAL_RADII_KM, sceneBodyRadiusFromPhysicalKm } from "../lib/body-physics";
import {
  applyEmptyPreviewDrag,
  applyEmptyPreviewZoom,
  advanceEmptyPreviewYaw,
  createDefaultEmptyPreviewCameraState,
  type EmptyPreviewCameraState,
} from "../lib/empty-preview-motion";
import { scaleOverviewDistanceKm } from "../lib/scale";

type EmptySolarPreviewProps = {
  bodies: BodyState[];
  language: Language;
};

type PreviewRuntime = {
  bodyGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  frameHandle: number | null;
  orbitGroup: THREE.Group;
  renderer: THREE.WebGLRenderer;
  resizeObserver: ResizeObserver | null;
  scene: THREE.Scene;
  stop: () => void;
};

type PointerGesture = {
  pointerId: number;
  lastX: number;
  lastY: number;
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
  neptune: "#6f93ff",
};

export default function EmptySolarPreview({ bodies, language }: EmptySolarPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<PreviewRuntime | null>(null);
  const cameraStateRef = useRef<EmptyPreviewCameraState>(createDefaultEmptyPreviewCameraState());
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const copy = t(language);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) {
      return;
    }

    const runtime = createPreviewRuntime(canvas, surface);
    if (!runtime) {
      return;
    }

    runtimeRef.current = runtime;

    const animate = (time: number) => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const previousTime = lastFrameTimeRef.current ?? time;
      const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
      lastFrameTimeRef.current = time;
      cameraStateRef.current = advanceEmptyPreviewYaw(cameraStateRef.current, deltaSeconds);
      updatePreviewCamera(runtime.camera, cameraStateRef.current, bodies);
      runtime.renderer.render(runtime.scene, runtime.camera);
      runtime.frameHandle = window.requestAnimationFrame(animate);
    };

    runtime.frameHandle = window.requestAnimationFrame(animate);

    return () => {
      lastFrameTimeRef.current = null;
      runtime.stop();
      disposeObject(runtime.scene);
      runtime.renderer.dispose();
      runtimeRef.current = null;
    };
  }, [bodies]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    syncPreviewBodies(runtime, bodies);
    updatePreviewCamera(runtime.camera, cameraStateRef.current, bodies);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [bodies]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    pointerGestureRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    cameraStateRef.current = applyEmptyPreviewDrag(cameraStateRef.current, { deltaX, deltaY });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerGestureRef.current?.pointerId === event.pointerId) {
      pointerGestureRef.current = null;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    cameraStateRef.current = applyEmptyPreviewZoom(cameraStateRef.current, event.deltaY);
  }

  return (
    <div
      ref={surfaceRef}
      className="scene-shell__surface scene-shell__surface--empty-preview"
      data-testid="empty-orbit-preview"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} aria-label={copy.threeCanvas} className="scene-canvas" />
    </div>
  );
}

function createPreviewRuntime(canvas: HTMLCanvasElement, surface: HTMLDivElement): PreviewRuntime | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(surface.clientWidth || 1, surface.clientHeight || 1, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, resolveAspect(surface), 0.1, 400);

    scene.fog = new THREE.FogExp2("#07111e", 0.006);
    scene.add(new THREE.AmbientLight("#a8c4ff", 1.2));

    const sunLight = new THREE.PointLight("#ffd27a", 2.7, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    const orbitGroup = new THREE.Group();
    const bodyGroup = new THREE.Group();
    scene.add(orbitGroup);
    scene.add(bodyGroup);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          renderer.setSize(surface.clientWidth || 1, surface.clientHeight || 1, false);
          camera.aspect = resolveAspect(surface);
          camera.updateProjectionMatrix();
        })
      : null;

    resizeObserver?.observe(surface);

    let runtime: PreviewRuntime;
    runtime = {
      bodyGroup,
      camera,
      frameHandle: null,
      orbitGroup,
      renderer,
      resizeObserver,
      scene,
      stop: () => {
        if (runtime.frameHandle != null) {
          window.cancelAnimationFrame(runtime.frameHandle);
        }
        runtime.resizeObserver?.disconnect();
      },
    };
    return runtime;
  } catch {
    return null;
  }
}

function syncPreviewBodies(runtime: PreviewRuntime, bodies: BodyState[]) {
  runtime.bodyGroup.clear();
  runtime.orbitGroup.clear();

  const visibleBodies = bodies.length ? bodies : buildFallbackBodies();
  for (const body of visibleBodies) {
    const position = bodyToScenePosition(body);
    const radius = sceneBodyRadiusFromPhysicalKm(
      BODY_PHYSICAL_RADII_KM[body.bodyId as keyof typeof BODY_PHYSICAL_RADII_KM] ?? 3000,
    );

    const material = new THREE.MeshStandardMaterial({
      color: bodyColors[body.bodyId] ?? "#eef4fb",
      emissive: body.bodyId === "sun" ? "#f4b400" : "#000000",
      emissiveIntensity: body.bodyId === "sun" ? 0.9 : 0,
      roughness: body.bodyId === "sun" ? 0.45 : 0.72,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 20),
      material,
    );
    mesh.position.copy(position);
    runtime.bodyGroup.add(mesh);

    if (body.bodyId !== "sun") {
      runtime.orbitGroup.add(createOrbitGuide(position));
    }
  }
}

function updatePreviewCamera(
  camera: THREE.PerspectiveCamera,
  state: EmptyPreviewCameraState,
  bodies: BodyState[],
) {
  const visibleBodies = bodies.length ? bodies : buildFallbackBodies();
  const maxDistance = Math.max(
    ...visibleBodies.map((body) => bodyToScenePosition(body).length()),
    14,
  );
  const distance = maxDistance * (1.45 + state.radiusScale);
  const cosPitch = Math.cos(state.pitchRad);
  const sinPitch = Math.sin(state.pitchRad);
  const cosYaw = Math.cos(state.yawRad);
  const sinYaw = Math.sin(state.yawRad);

  camera.position.set(
    distance * cosPitch * sinYaw,
    distance * Math.abs(sinPitch) + maxDistance * 0.42 + 10,
    distance * cosPitch * cosYaw,
  );
  camera.lookAt(0, 0, 0);
}

function createOrbitGuide(position: THREE.Vector3) {
  const radius = Math.max(Math.hypot(position.x, position.z), 2.4);
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(96).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: "#88a9cc",
    opacity: 0.24,
    transparent: true,
  });
  return new THREE.LineLoop(geometry, material);
}

function bodyToScenePosition(body: BodyState) {
  return new THREE.Vector3(
    scaleOverviewDistanceKm(body.positionKm[0]),
    scaleOverviewDistanceKm(body.positionKm[2]) * 0.18,
    scaleOverviewDistanceKm(body.positionKm[1]),
  );
}

function buildFallbackBodies(): BodyState[] {
  return [
    {
      bodyId: "sun",
      epoch: "fallback",
      positionKm: [0, 0, 0],
      velocityKmPerSec: [0, 0, 0],
      muKm3PerS2: 132712440018,
      sourceName: "fallback",
    },
  ];
}

function resolveAspect(surface: HTMLDivElement) {
  return Math.max((surface.clientWidth || 1) / Math.max(surface.clientHeight || 1, 1), 1);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if ("geometry" in child && child.geometry instanceof THREE.BufferGeometry) {
      child.geometry.dispose();
    }

    if ("material" in child && child.material) {
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if ("dispose" in material && typeof material.dispose === "function") {
        material.dispose();
      }
    }
  });
}
