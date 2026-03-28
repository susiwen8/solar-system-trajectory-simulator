import { describe, expect, it } from "vitest";

import { appRoutePath, resolveAppRoute } from "./app-route";

describe("resolveAppRoute", () => {
  it("resolves root pathname to simulator", () => {
    expect(resolveAppRoute("/")).toBe("simulator");
  });

  it("resolves /spacex-recovery with optional trailing slash", () => {
    expect(resolveAppRoute("/spacex-recovery")).toBe("spacex-recovery");
    expect(resolveAppRoute("/spacex-recovery/")).toBe("spacex-recovery");
  });

  it("falls back to simulator for unknown paths", () => {
    expect(resolveAppRoute("/unknown")).toBe("simulator");
    expect(resolveAppRoute("/mission-planning")).toBe("simulator");
  });
});

describe("appRoutePath", () => {
  it("returns stable browser pathnames for known routes", () => {
    expect(appRoutePath("simulator")).toBe("/");
    expect(appRoutePath("spacex-recovery")).toBe("/spacex-recovery");
  });
});
