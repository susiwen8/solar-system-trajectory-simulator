# Empty Scene Orbit Preview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `scene-shell--empty` placeholder with a lightweight interactive 3D solar-system orbit preview that fills the main scene area before a mission is calculated.

**Architecture:** Add a dedicated `EmptySolarPreview` component rather than overloading `SolarSystemScene`. Keep the new preview narrowly scoped to Sun/planet/orbit rendering plus ambient camera motion, and wire it into `App` only on the `!activeResult` branch. Extract any new interaction math into a tiny helper module so it can be tested without depending on WebGL.

**Tech Stack:** React 19, TypeScript, Three.js, Vitest, Testing Library

---

Implementation should follow `@superpowers:test-driven-development` and verify every claim with `@superpowers:verification-before-completion`.

## File Map

### Frontend

- Create: `apps/web/src/features/scene/lib/empty-preview-motion.ts`
  Purpose: hold ambient-rotation and bounded orbit-state update helpers specific to the empty-state preview.
- Create: `apps/web/src/features/scene/lib/empty-preview-motion.test.ts`
  Purpose: lock down drag, zoom, and auto-rotation behavior without needing a Three.js runtime.
- Create: `apps/web/src/features/scene/components/EmptySolarPreview.tsx`
  Purpose: render the empty-state bird's-eye 3D overview with ambient motion and light orbit interaction.
- Create: `apps/web/src/features/scene/components/EmptySolarPreview.test.tsx`
  Purpose: verify the preview mounts cleanly, uses the provided body data, and preserves a non-text-heavy empty state surface.
- Modify: `apps/web/src/App.tsx`
  Purpose: replace the current CSS-only `scene-shell--empty` branch with the new preview component.
- Modify: `apps/web/src/App.test.tsx`
  Purpose: assert the app now shows the empty-state preview instead of the old placeholder copy/orbit backdrop.
- Modify: `apps/web/src/styles.css`
  Purpose: remove obsolete empty-state decoration styles and add layout/styling for the preview surface.

## Chunk 1: Interaction Helpers

### Task 1: Add empty-preview camera motion helpers

**Files:**
- Create: `apps/web/src/features/scene/lib/empty-preview-motion.ts`
- Create: `apps/web/src/features/scene/lib/empty-preview-motion.test.ts`
- Reference: `apps/web/src/features/scene/lib/orbit-camera.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
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
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/empty-preview-motion.test.ts`

Expected: FAIL because `empty-preview-motion.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal helper module**

Create `apps/web/src/features/scene/lib/empty-preview-motion.ts` with:

- a dedicated `EmptyPreviewCameraState` type
- `createDefaultEmptyPreviewCameraState()`
- `advanceEmptyPreviewYaw(state, deltaSeconds)`
- `applyEmptyPreviewDrag(state, delta)`
- `applyEmptyPreviewZoom(state, wheelDelta)`

Implementation constraints:

- start from a bird's-eye-biased pitch rather than the probe-scene default
- clamp pitch and radius more tightly than the active mission orbit camera
- keep ambient yaw independent from drag updates so user interaction never disables the ambient motion
- keep the module self-contained and free of React/Three.js imports

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/empty-preview-motion.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/empty-preview-motion.ts \
  apps/web/src/features/scene/lib/empty-preview-motion.test.ts
git commit -m "feat: add empty scene preview motion helpers"
```

## Chunk 2: Empty Preview Component

### Task 2: Build the dedicated empty-state orbit preview

**Files:**
- Create: `apps/web/src/features/scene/components/EmptySolarPreview.tsx`
- Create: `apps/web/src/features/scene/components/EmptySolarPreview.test.tsx`
- Reference: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Reference: `apps/web/src/features/scene/lib/body-physics.ts`
- Reference: `apps/web/src/features/scene/lib/scale.ts`
- Reference: `apps/web/src/features/scene/lib/empty-preview-motion.ts`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EmptySolarPreview from "./EmptySolarPreview";

const bodies = [
  {
    bodyId: "sun",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [0, 0, 0],
    velocityKmPerSec: [0, 0, 0],
    muKm3PerS2: 132712440018,
    sourceName: "keplerian-elements",
  },
  {
    bodyId: "earth",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [-24856124, 144936962, 0],
    velocityKmPerSec: [-29.837, -5.127, 0],
    muKm3PerS2: 398600.435436,
    sourceName: "jpl-horizons-file",
  },
];

describe("EmptySolarPreview", () => {
  it("renders an empty-scene surface without instructional copy", () => {
    render(<EmptySolarPreview bodies={bodies} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Three.js 飞行画布")).toBeInTheDocument();
  });

  it("renders a minimal fallback surface when body data is missing", () => {
    render(<EmptySolarPreview bodies={[]} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/components/EmptySolarPreview.test.tsx`

Expected: FAIL because `EmptySolarPreview.tsx` does not exist yet.

- [ ] **Step 3: Implement the minimal preview component**

Create `apps/web/src/features/scene/components/EmptySolarPreview.tsx` with:

- a canvas-backed Three.js scene dedicated to the empty state
- Sun + planet mesh rendering using the incoming `bodies` prop
- subdued orbit-guide rendering derived from body distances
- ambient yaw updates driven by `requestAnimationFrame`
- drag + wheel interaction wired through `empty-preview-motion.ts`
- a safe fallback path when WebGL or body data is unavailable

Implementation constraints:

- keep the component independent from mission trajectory data
- reuse physical radius and distance-scaling helpers instead of hard-coded visual sizes
- do not render any hint copy, title, or status line inside the component
- add a stable `data-testid="empty-orbit-preview"` on the root surface for tests

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- src/features/scene/components/EmptySolarPreview.test.tsx src/features/scene/lib/empty-preview-motion.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/components/EmptySolarPreview.tsx \
  apps/web/src/features/scene/components/EmptySolarPreview.test.tsx \
  apps/web/src/features/scene/lib/empty-preview-motion.ts \
  apps/web/src/features/scene/lib/empty-preview-motion.test.ts
git commit -m "feat: add empty scene orbit preview component"
```

## Chunk 3: App Integration And Style Cleanup

### Task 3: Replace the old empty placeholder in the app shell

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`
- Reference: `apps/web/src/features/scene/components/EmptySolarPreview.tsx`

- [ ] **Step 1: Write the failing integration test updates**

Extend `apps/web/src/App.test.tsx` with a dedicated empty-state assertion like:

```tsx
it("shows the orbit preview in the empty scene instead of the old placeholder copy", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        referenceFrame: "heliocentric-inertial",
        epoch: "2026-01-01T00:00:00.000Z",
        ephemerisSource: "mixed",
        bodies: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  render(<App />);

  expect(await screen.findByTestId("empty-orbit-preview")).toBeInTheDocument();
  expect(screen.queryByText("运行任务后即可描绘轨迹")).not.toBeInTheDocument();
});
```

Also update any existing empty-state expectations that still assume:

- `.scene-shell__backdrop`
- `.scene-orbit`
- `.scene-sun`
- `.scene-empty-copy`

- [ ] **Step 2: Run the focused app tests to verify they fail**

Run: `cd apps/web && npm test -- src/App.test.tsx`

Expected: FAIL because `App.tsx` still renders the old placeholder branch.

- [ ] **Step 3: Implement the integration and styling changes**

Update `apps/web/src/App.tsx` so the empty branch:

- imports and renders `EmptySolarPreview`
- passes the already-loaded `bodies` data and current `language`
- removes the decorative backdrop and empty-copy markup

Update `apps/web/src/styles.css` so:

- obsolete `scene-shell__backdrop`, `scene-orbit`, `scene-sun`, and `scene-empty-copy` styles are removed or no longer used
- `scene-shell--empty` supports the new canvas-driven surface cleanly
- the empty preview fills the main scene region without adding extra copy blocks

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- src/App.test.tsx src/features/scene/components/EmptySolarPreview.test.tsx src/features/scene/lib/empty-preview-motion.test.ts`

Expected: PASS

- [ ] **Step 5: Run the full frontend suite**

Run: `cd apps/web && npm test`

Expected: PASS with no regression to the active mission scene tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx \
  apps/web/src/App.test.tsx \
  apps/web/src/styles.css \
  apps/web/src/features/scene/components/EmptySolarPreview.tsx \
  apps/web/src/features/scene/components/EmptySolarPreview.test.tsx \
  apps/web/src/features/scene/lib/empty-preview-motion.ts \
  apps/web/src/features/scene/lib/empty-preview-motion.test.ts
git commit -m "feat: replace empty scene placeholder with orbit preview"
```

## Final Verification

- [ ] **Step 1: Run the complete frontend suite**

Run: `cd apps/web && npm test`

Expected: PASS

- [ ] **Step 2: Run the app locally for manual verification**

Run: `cd apps/web && npm run dev`

Check:

- before computing a mission, the main scene shows the new orbit preview
- the preview rotates gently on its own
- drag changes the viewpoint without stopping the ambient motion
- wheel input changes zoom
- no empty-state instructional copy is visible
- once a mission is active, the normal `SolarSystemScene` still appears

- [ ] **Step 3: Inspect final git state**

Run:

```bash
git status
git log --oneline -5
```

Expected: only the planned empty-scene preview commits remain for this work.
