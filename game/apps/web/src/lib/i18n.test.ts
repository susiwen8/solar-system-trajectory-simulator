import { describe, expect, it } from "vitest";

import { localizeWarning } from "./i18n";

describe("localizeWarning", () => {
  it("translates known auto-transfer warnings to Chinese", () => {
    expect(localizeWarning("zh", "Auto-transfer delta-v estimate: 28.34 km/s")).toBe(
      "自动转移 Δv 估算：28.34 km/s",
    );
    expect(localizeWarning("zh", "Planned arrival miss distance estimate: 1 km")).toBe(
      "规划到达偏差估算：1 km",
    );
  });

  it("preserves English warnings when English is selected", () => {
    expect(localizeWarning("en", "Probe distance exceeds the trusted phase-1 operating range")).toBe(
      "Probe distance exceeds the trusted phase-1 operating range",
    );
  });
});
