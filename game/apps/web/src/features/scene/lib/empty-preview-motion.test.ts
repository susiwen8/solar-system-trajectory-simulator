import { describe, expect, it } from "vitest";

import {
  advanceEmptyPreviewAmbientTarget,
  advanceEmptyPreviewYaw,
  applyEmptyPreviewDrag,
  applyEmptyPreviewZoom,
  createDefaultEmptyPreviewCameraRig,
  createDefaultEmptyPreviewCameraState,
  stepEmptyPreviewCameraRig,
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

  it("advances ambient rotation on the target state without snapping the rendered state", () => {
    const rig = createDefaultEmptyPreviewCameraRig();
    const withAmbient = advanceEmptyPreviewAmbientTarget(rig, 1);

    expect(withAmbient.target.yawRad).toBeGreaterThan(0);
    expect(withAmbient.rendered.yawRad).toBe(0);
  });

  it("eases the rendered camera state toward the target state", () => {
    const rig = createDefaultEmptyPreviewCameraRig();
    const shifted = {
      ...rig,
      target: {
        ...rig.target,
        yawRad: 1.2,
      },
    };

    const next = stepEmptyPreviewCameraRig(shifted, 0.16);

    expect(next.rendered.yawRad).toBeGreaterThan(0);
    expect(next.rendered.yawRad).toBeLessThan(1.2);
  });
});
