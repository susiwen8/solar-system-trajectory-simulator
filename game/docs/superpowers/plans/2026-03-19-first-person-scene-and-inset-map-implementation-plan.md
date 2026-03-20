# First Person Scene And Inset Map Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the web flight scene so the main viewport becomes a hybrid first-person spacecraft view while a compact 2D inset map preserves whole-trajectory awareness.

**Architecture:** Keep `SolarSystemScene` as the top-level scene orchestrator, but move camera-state, proximity-state, and inset-map projection logic into focused helpers. Replace the fixed bird's-eye orthographic framing with a probe-following perspective camera, rebalance HUD overlays around that new main view, and render a lightweight SVG-based trajectory inset in the upper-right corner.

**Tech Stack:** React, TypeScript, Three.js, Vitest, React Testing Library, CSS

---

## Planned File Structure

- Create: `apps/web/src/features/scene/lib/camera.ts`
- Create: `apps/web/src/features/scene/lib/proximity.ts`
- Create: `apps/web/src/features/scene/lib/inset-map.ts`
- Create: `apps/web/src/features/scene/components/TrajectoryInsetMap.tsx`
- Create: `apps/web/src/features/scene/lib/camera.test.ts`
- Create: `apps/web/src/features/scene/lib/inset-map.test.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/styles.css`

## Chunk 1: Camera State And Proximity Model

### Task 1: Add failing tests for probe camera state selection

**Files:**
- Create: `apps/web/src/features/scene/lib/camera.test.ts`
- Create: `apps/web/src/features/scene/lib/proximity.ts`
- Create: `apps/web/src/features/scene/lib/camera.ts`
- Test: `apps/web/src/features/scene/lib/camera.test.ts`

- [ ] **Step 1: Write failing tests for cruise, approach, and flyby camera states**

```ts
it("returns cruise-follow framing for ordinary samples", () => {
  const view = computeProbeCameraView({
    sample: baseSample,
    segment: null,
    closestApproach: { bodyId: "mars", distanceKm: 8_450_000, epochSeconds: 86_400 },
    bodies: [marsBody],
  });

  expect(view.mode).toBe("cruise-follow");
  expect(view.fovDeg).toBeGreaterThan(40);
});

it("switches to approach framing near the target body", () => {
  const view = computeProbeCameraView({
    sample: nearTargetSample,
    segment: null,
    closestApproach: { bodyId: "mars", distanceKm: 120_000, epochSeconds: 0 },
    bodies: [marsBody],
  });

  expect(view.mode).toBe("approach-emphasis");
});

it("switches to flyby framing for gravity-assist segments", () => {
  const view = computeProbeCameraView({
    sample: flybySample,
    segment: { segmentType: "gravityAssistFlyby", metadata: { bodyId: "jupiter" } } as MissionSegment,
    closestApproach: { bodyId: "saturn", distanceKm: 1000, epochSeconds: 0 },
    bodies: [jupiterBody],
  });

  expect(view.mode).toBe("flyby-emphasis");
  expect(view.focusBodyId).toBe("jupiter");
});
```

- [ ] **Step 2: Run the focused camera tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera.test.ts`
Expected: FAIL because the camera helper does not exist yet.

- [ ] **Step 3: Implement the minimal camera and proximity helpers**

Create `camera.ts` and `proximity.ts` with:

- a small `ProbeCameraMode` union
- `computeProbeCameraView(...)`
- helper logic that detects cruise, approach, and flyby emphasis from existing `samples`, `closestApproach`, `segments`, and `bodies`

The first implementation should only calculate deterministic camera parameters and should not touch Three.js directly.

- [ ] **Step 4: Re-run the focused camera tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/camera.ts apps/web/src/features/scene/lib/proximity.ts apps/web/src/features/scene/lib/camera.test.ts
git commit -m "feat: add probe camera state helpers"
```

## Chunk 2: Inset Map Projection And Overlay Component

### Task 2: Add failing tests for inset-map projection

**Files:**
- Create: `apps/web/src/features/scene/lib/inset-map.ts`
- Create: `apps/web/src/features/scene/lib/inset-map.test.ts`
- Create: `apps/web/src/features/scene/components/TrajectoryInsetMap.tsx`
- Test: `apps/web/src/features/scene/lib/inset-map.test.ts`

- [ ] **Step 1: Write failing projection tests for route, probe marker, and target marker**

```ts
it("projects trajectory samples into inset-map coordinates", () => {
  const projection = buildInsetMapModel({
    samples: [sampleA, sampleB, sampleC],
    bodies: [earthBody, marsBody],
    closestApproach: { bodyId: "mars", distanceKm: 5000, epochSeconds: 0 },
    selectedSampleIndex: 1,
  });

  expect(projection.pathPoints.length).toBe(3);
  expect(projection.currentProbePoint).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  expect(projection.targetBody?.bodyId).toBe("mars");
});
```

- [ ] **Step 2: Run the focused inset-map tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/inset-map.test.ts`
Expected: FAIL because the inset projection helper does not exist yet.

- [ ] **Step 3: Implement the minimal inset-map model and component**

Create:

- `buildInsetMapModel(...)` in `inset-map.ts`
- `TrajectoryInsetMap.tsx` that renders an SVG path plus probe and target markers

The first implementation should:

- project samples and relevant bodies into a fixed view box
- highlight the current probe position
- show the current target or flyby body
- avoid any Three.js dependency

- [ ] **Step 4: Re-run the focused inset-map tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/inset-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/inset-map.ts apps/web/src/features/scene/lib/inset-map.test.ts apps/web/src/features/scene/components/TrajectoryInsetMap.tsx
git commit -m "feat: add trajectory inset map overlay"
```

## Chunk 3: Main Scene Integration And HUD Rebalance

### Task 3: Add failing app tests for first-person scene layout

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add failing UI assertions for the inset map and hybrid scene copy**

Add assertions such as:

```ts
expect(await screen.findByTestId("trajectory-inset-map")).toBeInTheDocument();
expect(screen.getByText("探测器视角")).toBeInTheDocument();
expect(screen.getByText("轨迹概览")).toBeInTheDocument();
```

For the gravity-assist candidate test, also assert:

```ts
expect(await screen.findByTestId("trajectory-inset-map")).toHaveTextContent("木星");
```

- [ ] **Step 2: Run the focused UI test file to verify it fails**

Run: `cd apps/web && npm test -- src/App.test.tsx`
Expected: FAIL because the new overlay and copy do not exist yet.

- [ ] **Step 3: Integrate the perspective scene and HUD layout**

Update `SolarSystemScene.tsx` so that:

- the renderer uses a perspective camera for the main scene
- camera placement is derived from `computeProbeCameraView(...)`
- the old fixed bird's-eye copy is replaced with hybrid first-person wording
- `TrajectoryInsetMap` renders in the upper-right
- speed telemetry moves to the lower-right
- mission and maneuver panels remain readable in the new layout

Update `i18n.ts` with the minimum new labels needed for:

- hybrid probe view
- trajectory inset / route overview
- local target wording if required

Update `styles.css` so the new overlay layout is intentional on both desktop and mobile.

- [ ] **Step 4: Re-run the focused UI tests**

Run: `cd apps/web && npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/features/scene/components/TrajectoryInsetMap.tsx apps/web/src/App.test.tsx apps/web/src/lib/i18n.ts apps/web/src/styles.css
git commit -m "feat: add first-person scene and inset map"
```

## Chunk 4: Full Verification And Polish

### Task 4: Run the complete frontend verification suite

**Files:**
- Verify only

- [ ] **Step 1: Run all frontend tests**

Run: `cd apps/web && npm test`
Expected: PASS with the existing jsdom canvas warnings still non-blocking.

- [ ] **Step 2: Sanity-check the git diff**

Run: `git diff --stat`
Expected: only the planned scene, test, and docs changes.

- [ ] **Step 3: Commit any final polish**

```bash
git add apps/web
git commit -m "refactor: polish first-person scene integration"
```

- [ ] **Step 4: Push the branch**

```bash
git push origin codex/mission-dynamics-realism
```
