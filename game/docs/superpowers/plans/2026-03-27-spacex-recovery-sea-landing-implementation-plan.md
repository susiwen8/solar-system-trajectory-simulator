# SpaceX Recovery Sea-Landing Update Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the existing SpaceX recovery exhibit so the first stage lands on an offshore drone ship instead of returning to the launch site.

**Architecture:** Keep the existing route and playback structure, but revise the pure recovery keyframes so the first stage ends at an offshore destination. Then update the scene and bilingual copy so the 3D exhibit clearly reads as coastal launch plus sea recovery.

**Tech Stack:** React 19, TypeScript, Three.js, Vitest, React Testing Library, existing CSS

---

## Chunk 1: Recovery Model And Scene Expectations

### Task 1: Add failing tests for offshore recovery behavior

**Files:**
- Modify: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.test.ts`
- Modify: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`

- [ ] **Step 1: Write the failing recovery-model test**

Add a test asserting the first stage no longer lands near the launch origin:

```ts
it("lands the booster downrange on an offshore recovery target", () => {
  const launch = getRecoveryDemoSnapshot(0);
  const touchdown = getRecoveryDemoSnapshot(1);

  expect(touchdown.firstStage.transform.position[0]).toBeGreaterThan(
    launch.firstStage.transform.position[0] + 20,
  );
});
```

- [ ] **Step 2: Write the failing scene-copy test**

Add a test asserting the recovery scene mentions a drone ship when WebGL is unavailable.

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/lib/recovery-sequence.test.ts src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`

Expected: FAIL because the current implementation still lands near the launch site and does not mention offshore drone-ship recovery.

## Chunk 2: Model, Scene, And Copy Update

### Task 2: Implement offshore recovery

**Files:**
- Modify: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts`
- Modify: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx`
- Modify: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx`
- Modify: `apps/web/src/lib/i18n.ts`

- [ ] **Step 1: Update the first-stage keyframes**

Change the authored first-stage path so touchdown happens at an offshore destination distinct from launch.

- [ ] **Step 2: Update scene rendering**

Render a water surface and drone-ship-style recovery platform instead of a same-site land pad.

- [ ] **Step 3: Update recovery copy**

Adjust bilingual copy so touchdown is described as landing on an offshore drone ship.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/lib/recovery-sequence.test.ts src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx`

Expected: PASS

## Chunk 3: Regression Verification

### Task 3: Re-run the recovery regression suite

**Files:**
- Verify only

- [ ] **Step 1: Run regression coverage**

Run: `cd apps/web && npm test -- src/App.test.tsx src/features/spacex-recovery/lib/recovery-sequence.test.ts src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`

Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/App.test.tsx \
  apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts \
  apps/web/src/features/spacex-recovery/lib/recovery-sequence.test.ts \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx \
  apps/web/src/lib/i18n.ts \
  docs/superpowers/specs/2026-03-27-spacex-recovery-sea-landing-design.md \
  docs/superpowers/plans/2026-03-27-spacex-recovery-sea-landing-implementation-plan.md
git commit -m "feat: move recovery exhibit to offshore landing"
```
