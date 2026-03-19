import { describe, expect, it } from "vitest";

import { buildSpeedTelemetry, formatDeltaSpeed, formatSpeedValue } from "./speed-telemetry";

describe("speed telemetry helpers", () => {
  it("builds total-speed telemetry and delta from trajectory samples", () => {
    const telemetry = buildSpeedTelemetry(
      [
        {
          epochSeconds: 0,
          positionKm: [0, 0, 0],
          velocityKmPerSec: [3, 4, 0],
        },
        {
          epochSeconds: 10,
          positionKm: [1, 0, 0],
          velocityKmPerSec: [6, 8, 0],
        },
      ],
      1,
      "speed",
    );

    expect(telemetry.currentValue).toBe(10);
    expect(telemetry.previousValue).toBe(5);
    expect(telemetry.deltaValue).toBe(5);
    expect(telemetry.points).toEqual([5, 10]);
  });

  it("builds velocity-component telemetry", () => {
    const telemetry = buildSpeedTelemetry(
      [
        {
          epochSeconds: 0,
          positionKm: [0, 0, 0],
          velocityKmPerSec: [3, 4, 5],
        },
        {
          epochSeconds: 10,
          positionKm: [1, 0, 0],
          velocityKmPerSec: [6, 2, 1],
        },
      ],
      1,
      "vz",
    );

    expect(telemetry.currentValue).toBe(1);
    expect(telemetry.previousValue).toBe(5);
    expect(telemetry.deltaValue).toBe(-4);
    expect(telemetry.points).toEqual([5, 1]);
  });

  it("formats speed and delta labels for HUD display", () => {
    expect(formatSpeedValue(12.3456)).toBe("12.35 km/s");
    expect(formatDeltaSpeed(0.456)).toBe("+0.46 km/s");
    expect(formatDeltaSpeed(-0.456)).toBe("-0.46 km/s");
  });
});
