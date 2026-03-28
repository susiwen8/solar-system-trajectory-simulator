import { kmToWorldUnits } from "./sceneScale";

type SpacecraftMarkerProps = {
  positionKm: number[] | null;
  onToggleCamera: () => void;
};

export function SpacecraftMarker({
  positionKm,
  onToggleCamera
}: SpacecraftMarkerProps) {
  if (!positionKm) {
    return null;
  }

  return (
    <mesh
      onClick={onToggleCamera}
      position={[
        kmToWorldUnits(positionKm[0]),
        kmToWorldUnits(positionKm[1]),
        kmToWorldUnits(positionKm[2] ?? 0)
      ]}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

