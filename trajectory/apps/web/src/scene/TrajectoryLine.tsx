import { Line } from "@react-three/drei";

import type { SpacecraftSample } from "../api/client";
import { kmToWorldUnits } from "./sceneScale";

type TrajectoryLineProps = {
  samples: SpacecraftSample[];
};

export function TrajectoryLine({ samples }: TrajectoryLineProps) {
  if (samples.length < 2) {
    return null;
  }

  const points = samples.map((sample) => [
    kmToWorldUnits(sample.positionKm[0]),
    kmToWorldUnits(sample.positionKm[1]),
    kmToWorldUnits(sample.positionKm[2] ?? 0)
  ] as [number, number, number]);

  return <Line color="#f5f5f5" lineWidth={1.5} points={points} />;
}

