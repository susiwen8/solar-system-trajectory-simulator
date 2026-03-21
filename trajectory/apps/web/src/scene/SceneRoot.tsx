import { Canvas } from "@react-three/fiber";

import type { BodyOption, MissionCandidate, SpacecraftSample } from "../api/client";
import type { CameraMode } from "../state/missionStore";
import { BodyLayer } from "./BodyLayer";
import { CameraRig } from "./CameraRig";
import { SpacecraftMarker } from "./SpacecraftMarker";
import { TrajectoryLine } from "./TrajectoryLine";

type SceneRootProps = {
  bodies: BodyOption[];
  bodySamples: Record<string, SpacecraftSample[]>;
  candidate: MissionCandidate | null;
  cameraMode: CameraMode;
  playbackTimeSeconds: number;
  onToggleCamera: () => void;
};

function getCurrentSample(
  spacecraftSamples: SpacecraftSample[],
  playbackTimeSeconds: number
): SpacecraftSample | null {
  if (spacecraftSamples.length === 0) {
    return null;
  }
  const start = spacecraftSamples[0].timestamp;
  const targetTime = start + playbackTimeSeconds;
  let current = spacecraftSamples[0];
  for (const sample of spacecraftSamples) {
    if (sample.timestamp > targetTime) {
      break;
    }
    current = sample;
  }
  return current;
}

export function SceneRoot({
  bodies,
  bodySamples,
  candidate,
  cameraMode,
  playbackTimeSeconds,
  onToggleCamera
}: SceneRootProps) {
  const spacecraftSamples = candidate?.samples?.spacecraft ?? [];
  const currentSample = getCurrentSample(spacecraftSamples, playbackTimeSeconds);
  const isTestEnvironment =
    typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");

  if (isTestEnvironment) {
    return <div className="scene-shell" data-testid="scene-shell" />;
  }

  return (
    <div className="scene-shell" data-testid="scene-shell">
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <color attach="background" args={["#050816"]} />
        <ambientLight intensity={1.2} />
        <BodyLayer
          bodies={bodies}
          bodySamples={bodySamples}
          playbackTimeSeconds={playbackTimeSeconds}
        />
        <TrajectoryLine samples={spacecraftSamples} />
        <SpacecraftMarker
          positionKm={currentSample?.positionKm ?? null}
          onToggleCamera={onToggleCamera}
        />
        <CameraRig
          cameraMode={cameraMode}
          positionKm={currentSample?.positionKm ?? null}
        />
      </Canvas>
    </div>
  );
}
