import { describe, expect, it } from "vitest";

import {
  RECOVERY_DEMO_DURATION_SECONDS,
  getRecoveryDemoSnapshot,
  getRecoveryPhase,
} from "./recovery-sequence";

describe("getRecoveryPhase", () => {
  it("starts in liftoff and ends in second-stage-orbital-continuation", () => {
    expect(getRecoveryPhase(0).id).toBe("liftoff");
    expect(getRecoveryPhase(1).id).toBe("second-stage-orbital-continuation");
    expect(RECOVERY_DEMO_DURATION_SECONDS).toBeGreaterThan(0);
  });
});

describe("getRecoveryDemoSnapshot", () => {
  it("separates stages at the same progress point for both transforms", () => {
    const beforeSeparation = getRecoveryDemoSnapshot(0.39);
    const afterSeparation = getRecoveryDemoSnapshot(0.44);

    expect(beforeSeparation.firstStage.transform.position[0]).toBeCloseTo(
      beforeSeparation.secondStage.transform.position[0],
      6,
    );
    expect(afterSeparation.firstStage.transform.position[0]).not.toBeCloseTo(
      afterSeparation.secondStage.transform.position[0],
      6,
    );
  });

  it("switches camera emphasis from launch-pad to side-follow to recovery-overview", () => {
    expect(getRecoveryDemoSnapshot(0.08).camera.mode).toBe("launch-pad");
    expect(getRecoveryDemoSnapshot(0.48).camera.mode).toBe("side-follow");
    expect(getRecoveryDemoSnapshot(0.92).camera.mode).toBe("recovery-overview");
  });

  it("keeps the second stage outbound while the booster returns after separation", () => {
    const snapshot = getRecoveryDemoSnapshot(0.72);

    expect(snapshot.activePhase.id).toBe("first-stage-atmospheric-return");
    expect(snapshot.firstStage.transform.position[0]).toBeLessThan(
      snapshot.secondStage.transform.position[0],
    );
    expect(snapshot.trajectory.stageOne.visible).toBe(true);
    expect(snapshot.trajectory.stageTwo.visible).toBe(true);
  });

  it("exposes explainer bullets for the active phase", () => {
    const snapshot = getRecoveryDemoSnapshot(0.72);

    expect(snapshot.phaseHighlights.length).toBeGreaterThan(0);
    expect(snapshot.phaseHighlights[0]).toContain(snapshot.activePhase.label);
  });
});
