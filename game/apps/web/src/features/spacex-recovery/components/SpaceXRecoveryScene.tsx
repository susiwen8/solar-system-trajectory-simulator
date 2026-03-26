import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { t, type Language } from "../../../lib/i18n";
import {
  getRecoveryDemoSnapshot,
  type RecoveryDemoSnapshot,
  type RecoveryPhaseId,
  type Vec3,
} from "../lib/recovery-sequence";

export type SpaceXRecoverySceneProps = {
  language: Language;
  snapshot: RecoveryDemoSnapshot;
};

type SceneRuntime = {
  camera: THREE.PerspectiveCamera;
  firstStage: THREE.Group;
  firstStageEngineGlow: THREE.MeshStandardMaterial;
  firstStageTrail: THREE.Line;
  frameHandle: number | null;
  landingZoneMaterial: THREE.MeshStandardMaterial;
  renderer: THREE.WebGLRenderer;
  resizeObserver: ResizeObserver | null;
  scene: THREE.Scene;
  secondStage: THREE.Group;
  secondStageEngineGlow: THREE.MeshStandardMaterial;
  secondStageTrail: THREE.Line;
  stop: () => void;
};

type RecoveryScenePhaseCopy = {
  summary: string;
  title: string;
};

const RECOVERY_SCENE_PHASE_COPY: Record<Language, Record<RecoveryPhaseId, RecoveryScenePhaseCopy>> = {
  en: {
    liftoff: {
      title: "Liftoff",
      summary: "The full stack clears the pad before the downrange turn begins.",
    },
    "pitch-and-ascent": {
      title: "Pitch and Ascent",
      summary: "The rocket trades vertical climb for downrange speed while staying fully stacked.",
    },
    "stage-separation": {
      title: "Stage Separation",
      summary: "The booster and upper stage peel apart and begin to diverge into different jobs.",
    },
    "first-stage-boostback": {
      title: "First-Stage Boostback",
      summary: "The booster bends back toward the recovery corridor as the upper stage keeps accelerating.",
    },
    "first-stage-atmospheric-return": {
      title: "First-Stage Atmospheric Return",
      summary: "The booster falls back through denser air while the second stage keeps heading for orbit.",
    },
    "landing-burn-and-touchdown": {
      title: "Landing Burn and Touchdown",
      summary: "The returning booster slows for the last descent and settles onto the landing zone.",
    },
    "second-stage-orbital-continuation": {
      title: "Second-Stage Orbital Continuation",
      summary: "The recovery story ends while the upper stage continues building orbital energy overhead.",
    },
  },
  zh: {
    liftoff: {
      title: "一级起飞",
      summary: "整套箭体离开发射台，一级和二级仍作为一体上升。",
    },
    "pitch-and-ascent": {
      title: "俯仰爬升",
      summary: "火箭逐步压平飞行姿态，把垂直爬升转成更有效的水平速度。",
    },
    "stage-separation": {
      title: "一级二级分离",
      summary: "一级助推器和二级开始分离，分别进入回收与入轨两条任务线。",
    },
    "first-stage-boostback": {
      title: "一级返向点火",
      summary: "一级开始朝回收走廊折返，二级继续向远端加速。",
    },
    "first-stage-atmospheric-return": {
      title: "一级大气层返回",
      summary: "一级重新进入更稠密的大气层，二级则继续抬升轨道能量。",
    },
    "landing-burn-and-touchdown": {
      title: "着陆点火与落地",
      summary: "一级在最后阶段减速并对准回收区完成落地。",
    },
    "second-stage-orbital-continuation": {
      title: "二级继续入轨",
      summary: "一级回收段结束后，镜头把叙事重心交给继续入轨的二级。",
    },
  },
};

const STAGE_HEIGHT = 8;
const TRAJECTORY_SAMPLE_COUNT = 72;

export default function SpaceXRecoveryScene({ language, snapshot }: SpaceXRecoverySceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const snapshotRef = useRef(snapshot);
  const [renderMode, setRenderMode] = useState<"pending" | "webgl" | "fallback">("pending");
  const copy = t(language);
  const phaseCopy = RECOVERY_SCENE_PHASE_COPY[language][snapshot.activePhase.id];

  snapshotRef.current = snapshot;

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) {
      return;
    }

    const runtime = createRecoveryRuntime(canvas, surface);
    if (!runtime) {
      setRenderMode("fallback");
      return;
    }

    runtimeRef.current = runtime;
    setRenderMode("webgl");
    syncRecoveryScene(runtime, snapshotRef.current);
    runtime.renderer.render(runtime.scene, runtime.camera);

    const animate = (time: number) => {
      const activeRuntime = runtimeRef.current;
      if (!activeRuntime) {
        return;
      }

      pulseEngineGlow(activeRuntime, snapshotRef.current, time / 1000);
      activeRuntime.renderer.render(activeRuntime.scene, activeRuntime.camera);
      activeRuntime.frameHandle = window.requestAnimationFrame(animate);
    };

    runtime.frameHandle = window.requestAnimationFrame(animate);

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

    syncRecoveryScene(runtime, snapshot);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [snapshot]);

  return (
    <section
      className="recovery-scene recovery-scene--3d"
      aria-label={copy.recoverySceneLabel}
      data-phase={snapshot.activePhase.id}
      data-testid="spacex-recovery-scene"
    >
      <div ref={surfaceRef} className="recovery-scene__viewport">
        <canvas ref={canvasRef} aria-label={copy.threeCanvas} className="recovery-scene__canvas" />

        <div className="recovery-scene__hud">
          <p className="eyebrow">{copy.recoverySceneLabel}</p>
          <h2>{phaseCopy.title}</h2>
          <p>{phaseCopy.summary}</p>
          <p>{copy.recoverySceneBody}</p>
        </div>

        {renderMode === "fallback" ? (
          <div className="recovery-scene__fallback" role="status">
            <p className="eyebrow">{copy.fallback}</p>
            <p>{copy.recoverySceneFallbackTitle}</p>
            <p>{copy.recoverySceneFallbackBody}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function createRecoveryRuntime(canvas: HTMLCanvasElement, surface: HTMLDivElement): SceneRuntime | null {
  const rendererContext = resolveWebGlContext(canvas);
  if (!rendererContext) {
    return null;
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      context: rendererContext,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(surface.clientWidth || 1, surface.clientHeight || 1, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#03101d");
    scene.fog = new THREE.Fog("#03101d", 90, 360);

    const camera = new THREE.PerspectiveCamera(40, resolveAspect(surface), 0.1, 600);
    scene.add(camera);

    scene.add(new THREE.AmbientLight("#8eb7ff", 1.05));

    const sunLight = new THREE.DirectionalLight("#ffd98a", 1.4);
    sunLight.position.set(42, 78, -28);
    scene.add(sunLight);

    const recoveryFill = new THREE.DirectionalLight("#70aaff", 0.85);
    recoveryFill.position.set(-26, 20, 34);
    scene.add(recoveryFill);

    scene.add(buildSkyDome());
    scene.add(buildGroundPlane());
    scene.add(buildLaunchMount());

    const landingZone = buildLandingZone();
    scene.add(landingZone.mesh);

    const firstStage = buildRocketStage("#dfe8f4", "#ff9a3d", 1);
    const secondStage = buildRocketStage("#9dc7ff", "#6dbdff", 0.82);
    scene.add(firstStage.group);
    scene.add(secondStage.group);

    const firstStageTrail = buildTrajectoryLine("stageOne", "#f7b357");
    const secondStageTrail = buildTrajectoryLine("stageTwo", "#79c6ff");
    scene.add(firstStageTrail);
    scene.add(secondStageTrail);
    scene.add(buildStarField());

    const resize = () => {
      renderer.setSize(surface.clientWidth || 1, surface.clientHeight || 1, false);
      camera.aspect = resolveAspect(surface);
      camera.updateProjectionMatrix();
    };

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(surface);
    window.addEventListener("resize", resize);

    let runtime: SceneRuntime;
    runtime = {
      camera,
      firstStage: firstStage.group,
      firstStageEngineGlow: firstStage.engineGlowMaterial,
      firstStageTrail,
      frameHandle: null,
      landingZoneMaterial: landingZone.material,
      renderer,
      resizeObserver,
      scene,
      secondStage: secondStage.group,
      secondStageEngineGlow: secondStage.engineGlowMaterial,
      secondStageTrail,
      stop: () => {
        if (runtime.frameHandle != null) {
          window.cancelAnimationFrame(runtime.frameHandle);
        }
        runtime.resizeObserver?.disconnect();
        window.removeEventListener("resize", resize);
      },
    };

    return runtime;
  } catch {
    return null;
  }
}

function syncRecoveryScene(runtime: SceneRuntime, snapshot: RecoveryDemoSnapshot) {
  applyVehicleTransform(runtime.firstStage, snapshot.firstStage.transform.position, snapshot.firstStage.transform.rotation);
  applyVehicleTransform(runtime.secondStage, snapshot.secondStage.transform.position, snapshot.secondStage.transform.rotation);

  applyTrajectoryState(runtime.firstStageTrail, snapshot.trajectory.stageOne.progress, snapshot.trajectory.stageOne.visible);
  applyTrajectoryState(runtime.secondStageTrail, snapshot.trajectory.stageTwo.progress, snapshot.trajectory.stageTwo.visible);

  runtime.camera.position.set(...snapshot.camera.position);
  runtime.camera.lookAt(...snapshot.camera.target);

  runtime.landingZoneMaterial.emissiveIntensity = snapshot.activePhase.id === "landing-burn-and-touchdown" ? 0.9 : 0.3;
  pulseEngineGlow(runtime, snapshot, 0);
}

function pulseEngineGlow(runtime: SceneRuntime, snapshot: RecoveryDemoSnapshot, elapsedSeconds: number) {
  const pulse = 0.14 + (Math.sin(elapsedSeconds * 5.8) + 1) * 0.08;
  const firstStageBurning = snapshot.activePhase.id !== "second-stage-orbital-continuation";
  const secondStageBurning =
    snapshot.activePhase.id === "stage-separation" ||
    snapshot.activePhase.id === "first-stage-boostback" ||
    snapshot.activePhase.id === "first-stage-atmospheric-return" ||
    snapshot.activePhase.id === "landing-burn-and-touchdown" ||
    snapshot.activePhase.id === "second-stage-orbital-continuation";

  runtime.firstStageEngineGlow.emissiveIntensity = firstStageBurning ? 1 + pulse : 0.18;
  runtime.secondStageEngineGlow.emissiveIntensity = secondStageBurning ? 0.72 + pulse * 0.6 : 0.14;
}

function applyVehicleTransform(group: THREE.Group, position: Vec3, rotation: Vec3) {
  group.position.set(...position);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
}

function applyTrajectoryState(line: THREE.Line, progress: number, visible: boolean) {
  const geometry = line.geometry;
  const positionAttribute = geometry.getAttribute("position");
  const drawCount = visible ? Math.max(2, Math.round(positionAttribute.count * progress)) : 0;

  geometry.setDrawRange(0, drawCount);
  line.visible = visible && drawCount > 1;

  const material = line.material;
  if (material instanceof THREE.LineBasicMaterial) {
    material.opacity = visible ? 0.9 : 0.24;
  }
}

function buildGroundPlane() {
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(170, 64),
    new THREE.MeshStandardMaterial({
      color: "#0b2235",
      metalness: 0.1,
      roughness: 0.88,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = -0.04;
  return surface;
}

function buildSkyDome() {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(260, 36, 18),
    new THREE.MeshBasicMaterial({
      color: "#08192d",
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.66,
    }),
  );
  dome.position.set(30, 60, 0);
  return dome;
}

function buildLaunchMount() {
  const group = new THREE.Group();

  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 18, 2.5),
    new THREE.MeshStandardMaterial({
      color: "#203347",
      metalness: 0.24,
      roughness: 0.72,
    }),
  );
  tower.position.set(-2.4, 9, -2.2);

  const support = new THREE.Mesh(
    new THREE.BoxGeometry(6, 1.8, 6),
    new THREE.MeshStandardMaterial({
      color: "#182634",
      metalness: 0.2,
      roughness: 0.86,
    }),
  );
  support.position.set(0, 0.9, 0);

  group.add(tower);
  group.add(support);
  return group;
}

function buildLandingZone() {
  const material = new THREE.MeshStandardMaterial({
    color: "#153450",
    emissive: "#6dc1ff",
    emissiveIntensity: 0.3,
    metalness: 0.24,
    roughness: 0.52,
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 1.2, 28), material);
  mesh.position.set(4, -0.6, 0);
  return {
    material,
    mesh,
  };
}

function buildRocketStage(bodyColor: string, glowColor: string, scale: number) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const shellMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    emissive: "#08111d",
    emissiveIntensity: 0.16,
    metalness: 0.44,
    roughness: 0.36,
  });

  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.96, STAGE_HEIGHT, 18), shellMaterial);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.92, 2.3, 18), shellMaterial);
  const interstage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.82, 1.6, 18),
    new THREE.MeshStandardMaterial({
      color: "#20364e",
      metalness: 0.32,
      roughness: 0.42,
    }),
  );
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.72, 1.8, 18),
    new THREE.MeshStandardMaterial({
      color: "#edf4ff",
      metalness: 0.18,
      roughness: 0.3,
    }),
  );

  const engineGlowMaterial = new THREE.MeshStandardMaterial({
    color: "#ffd7a1",
    emissive: glowColor,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.88,
  });
  const engineGlow = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.8, 18), engineGlowMaterial);

  shell.position.y = STAGE_HEIGHT * 0.5;
  tank.position.y = 2.1;
  interstage.position.y = STAGE_HEIGHT - 0.4;
  nose.position.y = STAGE_HEIGHT + 0.8;
  engineGlow.position.y = -0.92;
  engineGlow.rotation.z = Math.PI;

  group.add(shell);
  group.add(tank);
  group.add(interstage);
  group.add(nose);
  group.add(engineGlow);

  for (const offset of [-0.55, 0.55]) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.2, 0.7),
      new THREE.MeshStandardMaterial({
        color: "#314a63",
        metalness: 0.18,
        roughness: 0.62,
      }),
    );
    fin.position.set(offset, 0.8, 0);
    group.add(fin);
  }

  return { engineGlowMaterial, group };
}

function buildTrajectoryLine(stage: "stageOne" | "stageTwo", color: string) {
  const points = buildTrajectorySamples(stage).map((point) => new THREE.Vector3(...point));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setDrawRange(0, 2);

  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    }),
  );
}

function buildTrajectorySamples(stage: "stageOne" | "stageTwo") {
  return Array.from({ length: TRAJECTORY_SAMPLE_COUNT }, (_, index) => {
    const progress = index / (TRAJECTORY_SAMPLE_COUNT - 1);
    const sampledSnapshot = getRecoveryDemoSnapshot(progress);
    return stage === "stageOne"
      ? sampledSnapshot.firstStage.transform.position
      : sampledSnapshot.secondStage.transform.position;
  });
}

function buildStarField() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(120 * 3);

  for (let index = 0; index < vertices.length; index += 3) {
    vertices[index] = THREE.MathUtils.randFloatSpread(360);
    vertices[index + 1] = THREE.MathUtils.randFloat(10, 220);
    vertices[index + 2] = THREE.MathUtils.randFloatSpread(360);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: "#dbe9ff",
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.68,
    }),
  );
}

function resolveWebGlContext(canvas: HTMLCanvasElement) {
  // jsdom never provides a WebGL context, so skip the noisy not-implemented branch in tests.
  if (typeof navigator !== "undefined" && /\bjsdom\b/i.test(navigator.userAgent)) {
    return null;
  }

  try {
    return (
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null)
    );
  } catch {
    return null;
  }
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
