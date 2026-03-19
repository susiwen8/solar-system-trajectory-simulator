import { describe, expect, it } from "vitest";

import {
  applyOrbitDragDelta,
  applyOrbitPinchScale,
  applyOrbitWheelDelta,
  clampOrbitCameraState,
  createDefaultOrbitCameraState,
} from "./orbit-camera";

describe("createDefaultOrbitCameraState", () => {
  it("creates a readable default orbit state", () => {
    const state = createDefaultOrbitCameraState();

    expect(state.yawRad).toBe(0);
    expect(state.pitchRad).toBeCloseTo(0.22, 6);
    expect(state.radiusScale).toBe(1);
  });
});

describe("clampOrbitCameraState", () => {
  it("clamps pitch and radius into the supported range", () => {
    const next = clampOrbitCameraState({
      yawRad: 1.2,
      pitchRad: 4,
      radiusScale: 0.05,
    });

    expect(next.yawRad).toBe(1.2);
    expect(next.pitchRad).toBeLessThan(1.3);
    expect(next.pitchRad).toBeGreaterThan(-1.3);
    expect(next.radiusScale).toBeGreaterThanOrEqual(0.72);
  });
});

describe("orbit gesture updates", () => {
  it("applies drag deltas as yaw and pitch adjustments", () => {
    const next = applyOrbitDragDelta(createDefaultOrbitCameraState(), {
      deltaX: 120,
      deltaY: -40,
    });

    expect(next.yawRad).not.toBe(0);
    expect(next.pitchRad).toBeGreaterThan(0.22);
    expect(next.radiusScale).toBe(1);
  });

  it("applies wheel input as a radius change", () => {
    const next = applyOrbitWheelDelta(createDefaultOrbitCameraState(), -120);

    expect(next.radiusScale).toBeLessThan(1);
    expect(next.pitchRad).toBeCloseTo(0.22, 6);
  });

  it("applies pinch input as a radius change", () => {
    const next = applyOrbitPinchScale(createDefaultOrbitCameraState(), 1.4);

    expect(next.radiusScale).toBeLessThan(1);
    expect(next.yawRad).toBe(0);
  });
});
