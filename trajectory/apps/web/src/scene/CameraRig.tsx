import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";

import type { CameraMode } from "../state/missionStore";
import { kmToWorldUnits } from "./sceneScale";

type CameraRigProps = {
  cameraMode: CameraMode;
  positionKm: number[] | null;
};

export function CameraRig({ cameraMode, positionKm }: CameraRigProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!positionKm) {
      return;
    }
    const spacecraft = new Vector3(
      kmToWorldUnits(positionKm[0]),
      kmToWorldUnits(positionKm[1]),
      kmToWorldUnits(positionKm[2] ?? 0)
    );
    if (cameraMode === "first_person") {
      camera.position.copy(spacecraft.clone().add(new Vector3(0.2, 0.1, 0.2)));
      camera.lookAt(spacecraft);
      return;
    }
    camera.position.set(spacecraft.x + 2.5, spacecraft.y + 2.5, spacecraft.z + 2.5);
    camera.lookAt(spacecraft);
  }, [camera, cameraMode, positionKm]);

  useFrame(() => {
    if (!positionKm) {
      return;
    }
    const spacecraft = new Vector3(
      kmToWorldUnits(positionKm[0]),
      kmToWorldUnits(positionKm[1]),
      kmToWorldUnits(positionKm[2] ?? 0)
    );
    if (cameraMode === "overview") {
      camera.lookAt(spacecraft);
    }
  });

  return cameraMode === "overview" ? <OrbitControls enablePan={false} /> : null;
}

