import { describe, expect, it } from "vitest";

import {
  advanceEmptyPreviewYaw,
  applyEmptyPreviewDrag,
  applyEmptyPreviewZoom,
  createDefaultEmptyPreviewCameraState,
} from "./empty-preview-motion";

describe("empty preview motion", () => {
  it("starts from a top-down-biased orbit state", () => {
    const state = createDefaultEmptyPreviewCameraState();

    expect(state.pitchRad).toBeLessThan(0);
    expect(state.radiusScale).toBeGreaterThan(1);
  });

  it("keeps ambient yaw motion active between frames", () => {
    const next = advanceEmptyPreviewYaw(createDefaultEmptyPreviewCameraState(), 1.5);

    expect(next.yawRad).not.toBe(0);
  });

  it("applies drag without flattening the top-down bias", () => {
    const next = applyEmptyPreviewDrag(createDefaultEmptyPreviewCameraState(), {
      deltaX: 120,
      deltaY: 80,
    });

    expect(next.yawRad).not.toBe(0);
    expect(next.pitchRad).toBeLessThan(0.2);
  });

  it("applies wheel zoom inside a bounded overview range", () => {
    const next = applyEmptyPreviewZoom(createDefaultEmptyPreviewCameraState(), -200);

    expect(next.radiusScale).toBeLessThan(createDefaultEmptyPreviewCameraState().radiusScale);
  });
});
