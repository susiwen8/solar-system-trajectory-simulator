import { describe, expect, it } from "vitest";

import { resolveNextScenePerspective } from "./scene-perspective";

describe("resolveNextScenePerspective", () => {
  it("enters first-person mode when the probe is clicked in top-down view", () => {
    expect(resolveNextScenePerspective("topdown-follow", true)).toBe("first-person");
  });

  it("keeps top-down mode when a non-probe target is clicked", () => {
    expect(resolveNextScenePerspective("topdown-follow", false)).toBe("topdown-follow");
  });

  it("returns to top-down mode from first-person only when the probe is clicked again", () => {
    expect(resolveNextScenePerspective("first-person", true)).toBe("topdown-follow");
    expect(resolveNextScenePerspective("first-person", false)).toBe("first-person");
  });
});
