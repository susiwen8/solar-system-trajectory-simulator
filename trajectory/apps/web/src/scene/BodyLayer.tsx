import { MeshBasicMaterial } from "three";

import type { BodyOption } from "../api/client";
import { haloRadiusForBody, kmToWorldUnits } from "./sceneScale";

type BodyLayerProps = {
  bodies: BodyOption[];
  bodySamples: Record<string, { timestamp: number; positionKm: number[] }[]>;
  playbackTimeSeconds: number;
};

const DEFAULT_RADII: Record<string, number> = {
  earth: 6378.1,
  mars: 3389.5,
  jupiter: 69911
};

function getBodyPosition(
  bodyId: string,
  bodySamples: Record<string, { timestamp: number; positionKm: number[] }[]>,
  playbackTimeSeconds: number,
  fallbackIndex: number
) {
  const samples = bodySamples[bodyId] ?? [];
  if (samples.length === 0) {
    return [(fallbackIndex + 1) * 1.4, 0, 0] as const;
  }

  const start = samples[0].timestamp;
  const targetTime = start + playbackTimeSeconds;
  let current = samples[0];
  for (const sample of samples) {
    if (sample.timestamp > targetTime) {
      break;
    }
    current = sample;
  }

  return [
    kmToWorldUnits(current.positionKm[0]),
    kmToWorldUnits(current.positionKm[1]),
    kmToWorldUnits(current.positionKm[2] ?? 0)
  ] as const;
}

export function BodyLayer({
  bodies,
  bodySamples,
  playbackTimeSeconds
}: BodyLayerProps) {
  return (
    <>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#f8d06a" />
      </mesh>
      {bodies.slice(0, 6).map((body, index) => {
        const radius = kmToWorldUnits(DEFAULT_RADII[body.id] ?? body.radiusKm ?? 3000);
        const position = getBodyPosition(body.id, bodySamples, playbackTimeSeconds, index);
        return (
          <group key={body.id} position={position}>
            <mesh>
              <sphereGeometry args={[Math.max(radius, 0.02), 16, 16]} />
              <meshBasicMaterial
                color={body.colorHex ?? "#7aa2f7"}
                toneMapped={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[haloRadiusForBody(Math.max(radius, 0.02)), 16, 16]} />
              <meshBasicMaterial
                color={body.colorHex ?? "#7aa2f7"}
                transparent
                opacity={0.08}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
