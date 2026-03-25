import type { ScenePerspective } from "./scene-perspective";

type ResolveBodyFocusVisualOptions = {
  bodyId: string;
  perspective: ScenePerspective;
  cameraFocusBodyId: string | null;
  cameraFocusScale: number;
  closestApproachBodyId: string;
};

export type BodyFocusVisual = {
  isFocusBody: boolean;
  focusScale: number;
};

export function resolveBodyFocusVisual({
  bodyId,
  perspective,
  cameraFocusBodyId,
  cameraFocusScale,
  closestApproachBodyId,
}: ResolveBodyFocusVisualOptions): BodyFocusVisual {
  const shouldUseCameraFocus = perspective !== "topdown-follow";
  const isCameraFocusBody = shouldUseCameraFocus && bodyId === cameraFocusBodyId;
  const isClosestApproachBody = bodyId === closestApproachBodyId;

  return {
    isFocusBody: isCameraFocusBody || isClosestApproachBody,
    focusScale: isCameraFocusBody ? cameraFocusScale : 1,
  };
}
