import { MeshBasicMaterial } from "three";

import type { BodyOption } from "../api/client";
import { haloRadiusForBody, kmToWorldUnits } from "./sceneScale";

type BodyLayerProps = {
  bodies: BodyOption[];
};

const DEFAULT_RADII: Record<string, number> = {
  earth: 6378.1,
  mars: 3389.5,
  jupiter: 69911
};

export function BodyLayer({ bodies }: BodyLayerProps) {
  return (
    <>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#f8d06a" />
      </mesh>
      {bodies.slice(0, 6).map((body, index) => {
        const radius = kmToWorldUnits(DEFAULT_RADII[body.id] ?? body.radiusKm ?? 3000);
        const x = (index + 1) * 1.4;
        return (
          <group key={body.id} position={[x, 0, 0]}>
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

