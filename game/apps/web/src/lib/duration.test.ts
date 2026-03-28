import { describe, expect, it } from "vitest";

import { formatFlightDuration, formatRelativeDurationSeconds } from "./duration";

describe("duration formatting", () => {
  it("keeps shorter flight durations in days", () => {
    expect(formatFlightDuration(3 * 86_400, "zh")).toBe("3 天");
    expect(formatFlightDuration(3 * 86_400, "en")).toBe("3 days");
  });

  it("formats long flight durations as years, months, and days", () => {
    expect(formatFlightDuration(900 * 86_400, "zh")).toBe("2 年 5 月 20 天");
    expect(formatFlightDuration(900 * 86_400, "en")).toBe("2 years 5 months 20 days");
  });

  it("keeps shorter relative durations in days and hours", () => {
    expect(formatRelativeDurationSeconds(1.5 * 86_400, "zh")).toBe("1.5 天后");
    expect(formatRelativeDurationSeconds(6 * 3_600, "en")).toBe("in 6 hours");
  });

  it("formats long relative durations as years, months, and days", () => {
    expect(formatRelativeDurationSeconds(400 * 86_400, "zh")).toBe("1 年 1 月 5 天后");
    expect(formatRelativeDurationSeconds(400 * 86_400, "en")).toBe("in 1 year 1 month 5 days");
  });
});
