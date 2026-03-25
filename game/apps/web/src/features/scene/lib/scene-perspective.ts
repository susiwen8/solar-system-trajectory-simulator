export type ScenePerspective = "cinematic-follow" | "topdown-follow" | "first-person";

export function resolveNextScenePerspective(
  current: ScenePerspective,
  clickedProbe: boolean,
): ScenePerspective {
  if (current === "first-person") {
    return clickedProbe ? "topdown-follow" : current;
  }

  return clickedProbe ? "first-person" : current;
}
