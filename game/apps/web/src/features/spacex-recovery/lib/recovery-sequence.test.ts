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
  it("keeps the stack aligned through 0.4 and splits immediately after", () => {
    const beforeBoundary = getRecoveryDemoSnapshot(0.399);
    const atBoundary = getRecoveryDemoSnapshot(0.4);
    const afterBoundary = getRecoveryDemoSnapshot(0.401);

    expect(getRecoveryPhase(0.399).id).toBe("stage-separation");
    expect(getRecoveryPhase(0.4).id).toBe("first-stage-boostback");

    expect(beforeBoundary.firstStage.transform.position).toEqual(
      beforeBoundary.secondStage.transform.position,
    );
    expect(beforeBoundary.firstStage.transform.rotation).toEqual(
      beforeBoundary.secondStage.transform.rotation,
    );

    expect(atBoundary.firstStage.transform.position).toEqual(atBoundary.secondStage.transform.position);
    expect(atBoundary.firstStage.transform.rotation).toEqual(atBoundary.secondStage.transform.rotation);

    expect(afterBoundary.firstStage.transform.position).not.toEqual(
      afterBoundary.secondStage.transform.position,
    );
    expect(afterBoundary.firstStage.transform.rotation).not.toEqual(
      afterBoundary.secondStage.transform.rotation,
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
