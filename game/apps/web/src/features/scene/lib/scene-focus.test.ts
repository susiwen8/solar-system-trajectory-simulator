import { describe, expect, it } from "vitest";

import { resolveBodyFocusVisual } from "./scene-focus";

describe("resolveBodyFocusVisual", () => {
  it("does not apply flyby focus scaling in top-down follow mode", () => {
    const visual = resolveBodyFocusVisual({
      bodyId: "venus",
      perspective: "topdown-follow",
      cameraFocusBodyId: "venus",
      cameraFocusScale: 2.1,
      closestApproachBodyId: "jupiter",
    });

    expect(visual.isFocusBody).toBe(false);
    expect(visual.focusScale).toBe(1);
  });

  it("keeps cinematic and first-person flyby focus scaling", () => {
    const cinematic = resolveBodyFocusVisual({
      bodyId: "venus",
      perspective: "cinematic-follow",
      cameraFocusBodyId: "venus",
      cameraFocusScale: 2.1,
      closestApproachBodyId: "jupiter",
    });
    const firstPerson = resolveBodyFocusVisual({
      bodyId: "venus",
      perspective: "first-person",
      cameraFocusBodyId: "venus",
      cameraFocusScale: 2.1,
      closestApproachBodyId: "jupiter",
    });

    expect(cinematic.isFocusBody).toBe(true);
    expect(cinematic.focusScale).toBe(2.1);
    expect(firstPerson.isFocusBody).toBe(true);
    expect(firstPerson.focusScale).toBe(2.1);
  });

  it("preserves closest-approach highlighting in top-down follow mode", () => {
    const visual = resolveBodyFocusVisual({
      bodyId: "jupiter",
      perspective: "topdown-follow",
      cameraFocusBodyId: "venus",
      cameraFocusScale: 2.1,
      closestApproachBodyId: "jupiter",
    });

    expect(visual.isFocusBody).toBe(true);
    expect(visual.focusScale).toBe(1);
  });
});
