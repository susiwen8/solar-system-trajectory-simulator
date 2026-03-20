# Empty Scene Preview Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the empty-scene orbit preview so its orbit guides, camera motion, and body rendering feel smoother and more believable without changing the active mission scene.

**Architecture:** Keep the work isolated to the empty-preview path by adding small helper modules for orbit-guide modeling and smoothed camera state. Refine `EmptySolarPreview` to consume those helpers while preserving the current `App` integration and no-copy empty-state surface.

**Tech Stack:** React 19, TypeScript, Three.js, Vitest, Testing Library

---

Implementation should follow `@superpowers:test-driven-development` and verify every claim with `@superpowers:verification-before-completion`.

## File Map

### Frontend

- Create: `apps/web/src/features/scene/lib/empty-preview-orbits.ts`
  Purpose: generate stable, body-specific orbit-guide models for the empty preview.
- Create: `apps/web/src/features/scene/lib/empty-preview-orbits.test.ts`
  Purpose: verify inner/outer body orbit-guide profiles differ in scale and styling as intended.
- Modify: `apps/web/src/features/scene/lib/empty-preview-motion.ts`
  Purpose: evolve the camera model from immediate updates to smoothed target/rendered state behavior.
- Modify: `apps/web/src/features/scene/lib/empty-preview-motion.test.ts`
  Purpose: verify smoothing, additive drag, ambient motion, and bounded zoom behavior.
- Modify: `apps/web/src/features/scene/components/EmptySolarPreview.tsx`
  Purpose: apply the refined orbit guides, smoothed camera motion, and richer body/sun visual hierarchy.
- Modify: `apps/web/src/features/scene/components/EmptySolarPreview.test.tsx`
  Purpose: keep component stability coverage while adding one regression check for the refined preview surface.
- Modify: `apps/web/src/styles.css`
  Purpose: add any minimal style support needed for the refined preview shell while keeping the page visually clean.
- Modify: `apps/web/src/App.test.tsx`
  Purpose: retain the current empty-state integration assertion after the preview refinement.

## Chunk 1: Orbit Guide Modeling

### Task 1: Add body-specific orbit-guide helper logic

**Files:**
- Create: `apps/web/src/features/scene/lib/empty-preview-orbits.ts`
- Create: `apps/web/src/features/scene/lib/empty-preview-orbits.test.ts`
- Reference: `apps/web/src/features/scene/lib/scale.ts`
- Reference: `apps/web/src/features/scene/components/EmptySolarPreview.tsx`

- [ ] **Step 1: Write the failing orbit-guide tests**

```ts
import { describe, expect, it } from "vitest";

import { buildEmptyPreviewOrbitGuide } from "./empty-preview-orbits";

describe("empty preview orbit guides", () => {
  it("builds a more compact brighter guide for an inner planet", () => {
    const guide = buildEmptyPreviewOrbitGuide("earth", 48);

    expect(guide.radiusX).toBeGreaterThan(0);
    expect(guide.radiusY).toBeGreaterThan(0);
    expect(guide.opacity).toBeGreaterThan(0.2);
    expect(guide.eccentricity).toBeGreaterThan(0);
  });

  it("builds a softer wider guide for an outer planet", () => {
    const inner = buildEmptyPreviewOrbitGuide("earth", 48);
    const outer = buildEmptyPreviewOrbitGuide("neptune", 180);

    expect(outer.radiusX).toBeGreaterThan(inner.radiusX);
    expect(outer.opacity).toBeLessThan(inner.opacity);
    expect(outer.lineWidthScale).toBeGreaterThan(inner.lineWidthScale);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/empty-preview-orbits.test.ts`

Expected: FAIL because `empty-preview-orbits.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal orbit-guide helper**

Create `apps/web/src/features/scene/lib/empty-preview-orbits.ts` with:

- a compact guide model type
- `buildEmptyPreviewOrbitGuide(bodyId, orbitalRadius)`
- low-cost body-class profiles for:
  - inner planets
  - gas giants / outer planets
- ellipse-like axis generation and styling values:
  - `radiusX`
  - `radiusY`
  - `eccentricity`
  - `opacity`
  - `lineWidthScale`

Implementation constraints:

- keep the model approximate and readable, not physically exact
- keep the helper free of Three.js so it is cheap to test
- return stable values for the same body/radius pair

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/empty-preview-orbits.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/empty-preview-orbits.ts \
  apps/web/src/features/scene/lib/empty-preview-orbits.test.ts
git commit -m "feat: add empty preview orbit guide helpers"
```

## Chunk 2: Camera Smoothing

### Task 2: Refine empty-preview camera motion into target/rendered smoothing

**Files:**
- Modify: `apps/web/src/features/scene/lib/empty-preview-motion.ts`
- Modify: `apps/web/src/features/scene/lib/empty-preview-motion.test.ts`

- [ ] **Step 1: Extend the failing camera-motion tests**

Add tests like:

```ts
import {
  advanceEmptyPreviewAmbientTarget,
  createDefaultEmptyPreviewCameraRig,
  stepEmptyPreviewCameraRig,
} from "./empty-preview-motion";

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

it("advances ambient rotation on the target state without snapping the rendered state", () => {
  const rig = createDefaultEmptyPreviewCameraRig();
  const withAmbient = advanceEmptyPreviewAmbientTarget(rig, 1);

  expect(withAmbient.target.yawRad).toBeGreaterThan(0);
  expect(withAmbient.rendered.yawRad).toBe(0);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/empty-preview-motion.test.ts`

Expected: FAIL because the new smoothing helpers do not exist yet.

- [ ] **Step 3: Implement the minimal smoothing model**

Refactor `apps/web/src/features/scene/lib/empty-preview-motion.ts` to add:

- `EmptyPreviewCameraRig`
- `createDefaultEmptyPreviewCameraRig()`
- `advanceEmptyPreviewAmbientTarget(rig, deltaSeconds)`
- `applyEmptyPreviewDrag(rig, delta)`
- `applyEmptyPreviewZoom(rig, wheelDelta)`
- `stepEmptyPreviewCameraRig(rig, deltaSeconds)`

Implementation constraints:

- preserve the current top-down-biased limits
- keep drag additive to the target state
- keep ambient rotation always advancing the target state
- smooth only the rendered state, not the target/input state
- avoid over-engineering; linear interpolation or exponential easing is enough

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/empty-preview-motion.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/empty-preview-motion.ts \
  apps/web/src/features/scene/lib/empty-preview-motion.test.ts
git commit -m "feat: smooth empty preview camera motion"
```

## Chunk 3: Preview Visual Refinement

### Task 3: Apply refined orbit guides, camera smoothing, and body hierarchy to the component

**Files:**
- Modify: `apps/web/src/features/scene/components/EmptySolarPreview.tsx`
- Modify: `apps/web/src/features/scene/components/EmptySolarPreview.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.test.tsx`
- Reference: `apps/web/src/features/scene/lib/empty-preview-orbits.ts`
- Reference: `apps/web/src/features/scene/lib/empty-preview-motion.ts`

- [ ] **Step 1: Extend the failing component tests**

Add one regression test to `EmptySolarPreview.test.tsx` like:

```tsx
it("keeps the refined preview surface stable for populated body datasets", () => {
  render(<EmptySolarPreview bodies={bodies} language="zh" />);

  expect(screen.getByTestId("empty-orbit-preview")).toHaveClass("scene-shell__surface--empty-preview");
});
```

Retain the existing `App` empty-state test so the app-level integration keeps protecting the preview path.

- [ ] **Step 2: Run the focused tests to verify they fail when the refined behavior is incomplete**

Run: `cd apps/web && npm test -- src/features/scene/components/EmptySolarPreview.test.tsx src/App.test.tsx`

Expected: PASS or partial PASS at first if the assertion only covers the existing class. If the new assertion already passes, add one tighter regression around the refined class/surface contract before implementation proceeds.

- [ ] **Step 3: Implement the component refinements**

Update `apps/web/src/features/scene/components/EmptySolarPreview.tsx` so it:

- uses `EmptyPreviewCameraRig` instead of a single immediate camera state
- steps the rendered camera each animation frame
- builds orbit guides from `buildEmptyPreviewOrbitGuide(...)`
- strengthens the Sun's emissive/glow treatment
- differentiates inner and outer planet materials more clearly
- tunes fog and per-body visual presence to improve depth

Implementation constraints:

- keep the component mission-agnostic
- do not add UI text or overlay cards
- preserve the current fallback behavior when bodies are empty or WebGL is unavailable
- do not spill this refinement into `SolarSystemScene`

Update `apps/web/src/styles.css` only if the preview shell needs small visual support tweaks.

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- src/features/scene/components/EmptySolarPreview.test.tsx src/features/scene/lib/empty-preview-orbits.test.ts src/features/scene/lib/empty-preview-motion.test.ts src/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Run the full frontend suite**

Run: `cd apps/web && npm test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/scene/components/EmptySolarPreview.tsx \
  apps/web/src/features/scene/components/EmptySolarPreview.test.tsx \
  apps/web/src/features/scene/lib/empty-preview-orbits.ts \
  apps/web/src/features/scene/lib/empty-preview-orbits.test.ts \
  apps/web/src/features/scene/lib/empty-preview-motion.ts \
  apps/web/src/features/scene/lib/empty-preview-motion.test.ts \
  apps/web/src/styles.css \
  apps/web/src/App.test.tsx
git commit -m "feat: refine empty scene orbit preview visuals"
```

## Final Verification

- [ ] **Step 1: Run the complete frontend suite**

Run: `cd apps/web && npm test`

Expected: PASS

- [ ] **Step 2: Run the app locally for manual verification**

Run: `cd apps/web && npm run dev`

Check:

- the empty preview still appears before any mission is run
- orbit guides no longer read as uniform circular placeholder rings
- ambient rotation feels smoother
- drag still affects the view without stopping ambient motion
- zoom feels less jumpy
- the Sun and planets have clearer visual hierarchy and depth
- the active mission scene still appears unchanged once a mission is computed

- [ ] **Step 3: Inspect final git state**

Run:

```bash
git status
git log --oneline -5
```

Expected: only the planned empty-scene preview visual refinement commits remain for this work.
