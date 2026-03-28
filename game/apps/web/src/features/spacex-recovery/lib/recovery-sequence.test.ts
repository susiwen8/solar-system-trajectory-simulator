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

  it("hands off phases at the authored boundary markers", () => {
    expect(getRecoveryPhase(0.1).id).toBe("pitch-and-ascent");
    expect(getRecoveryPhase(0.26).id).toBe("stage-separation");
    expect(getRecoveryPhase(0.4).id).toBe("first-stage-boostback");
    expect(getRecoveryPhase(0.58).id).toBe("first-stage-atmospheric-return");
    expect(getRecoveryPhase(0.78).id).toBe("landing-burn-and-touchdown");
    expect(getRecoveryPhase(0.9).id).toBe("second-stage-orbital-continuation");
  });
});

describe("getRecoveryDemoSnapshot", () => {
  it("starts the split inside stage-separation and keeps the stack aligned before it", () => {
    const beforeSeparation = getRecoveryDemoSnapshot(0.259);
    const duringSeparation = getRecoveryDemoSnapshot(0.35);

    expect(getRecoveryPhase(0.259).id).toBe("pitch-and-ascent");
    expect(getRecoveryPhase(0.35).id).toBe("stage-separation");

    expect(beforeSeparation.firstStage.transform.position).toEqual(
      beforeSeparation.secondStage.transform.position,
    );
    expect(beforeSeparation.firstStage.transform.rotation).toEqual(
      beforeSeparation.secondStage.transform.rotation,
    );

    expect(duringSeparation.firstStage.transform.position).not.toEqual(
      duringSeparation.secondStage.transform.position,
    );
    expect(duringSeparation.firstStage.transform.rotation).not.toEqual(
      duringSeparation.secondStage.transform.rotation,
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

  it("moves the booster back toward recovery during first-stage-boostback", () => {
    const boostbackStart = getRecoveryDemoSnapshot(0.41);
    const boostbackEnd = getRecoveryDemoSnapshot(0.57);

    expect(boostbackStart.activePhase.id).toBe("first-stage-boostback");
    expect(boostbackEnd.activePhase.id).toBe("first-stage-boostback");
    expect(boostbackEnd.firstStage.transform.position[0]).toBeLessThan(
      boostbackStart.firstStage.transform.position[0],
    );
    expect(boostbackEnd.firstStage.transform.rotation).not.toEqual(
      boostbackStart.firstStage.transform.rotation,
    );
  });

  it("lands the booster downrange on an offshore recovery target instead of the launch site", () => {
    const launch = getRecoveryDemoSnapshot(0);
    const touchdown = getRecoveryDemoSnapshot(1);

    expect(touchdown.activePhase.id).toBe("second-stage-orbital-continuation");
    expect(touchdown.firstStage.transform.position[0]).toBeGreaterThan(
      launch.firstStage.transform.position[0] + 20,
    );
    expect(touchdown.firstStage.transform.position).not.toEqual(
      launch.firstStage.transform.position,
    );
  });

  it("exposes explainer bullets for the active phase", () => {
    const snapshot = getRecoveryDemoSnapshot(0.72);

    expect(snapshot.phaseHighlights.length).toBeGreaterThan(0);
    expect(snapshot.phaseHighlights[0]).toContain(snapshot.activePhase.label);
  });
});
