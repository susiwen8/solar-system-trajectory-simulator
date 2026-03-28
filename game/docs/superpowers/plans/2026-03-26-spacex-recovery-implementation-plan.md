# SpaceX Recovery Demo Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/spacex-recovery` route that presents a SpaceX-style reusable rocket explainer page with synchronized 3D animation, guided playback, and narrative phase copy while preserving the current simulator at `/`.

**Architecture:** Keep routing lightweight by introducing a tiny pathname/history helper instead of a full router library. Split the new work into a route shell, a pure recovery-sequence model, a page-level playback container, and a dedicated Three.js scene so timeline math stays testable outside WebGL and the current simulator flow remains isolated.

**Tech Stack:** React 19, TypeScript, Three.js, Vitest, React Testing Library, existing project CSS

---

Implementation should follow `@superpowers:test-driven-development` and verify every claim with `@superpowers:verification-before-completion`.

## File Map

### Routing And App Shell

- Create: `apps/web/src/lib/app-route.ts`
  Purpose: normalize pathnames, resolve the active app route, and generate browser-history-safe route transitions.
- Create: `apps/web/src/lib/app-route.test.ts`
  Purpose: lock down route parsing and history-friendly path generation without involving React.
- Create: `apps/web/src/features/simulator/components/SolarSystemSimulatorPage.tsx`
  Purpose: hold the existing simulator page logic now living in `App.tsx` so `App.tsx` can become a small route shell.
- Modify: `apps/web/src/App.tsx`
  Purpose: render shared top navigation, subscribe to browser navigation changes, and switch between the simulator page and the new recovery page.
- Modify: `apps/web/src/App.test.tsx`
  Purpose: verify route selection, navigation behavior, and preservation of the simulator home page.

### Recovery Demo

- Create: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts`
  Purpose: define phase timing, stage transforms, trajectory points, camera beats, and snapshot helpers from normalized playback progress.
- Create: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.test.ts`
  Purpose: verify phase lookup, separation timing, camera selection, and trajectory visibility rules without WebGL.
- Create: `apps/web/src/features/spacex-recovery/components/RecoveryPhaseCard.tsx`
  Purpose: render current phase title, short explanation, and technical highlights from the active snapshot.
- Create: `apps/web/src/features/spacex-recovery/components/RecoveryPlaybackControls.tsx`
  Purpose: render play, pause, reset, and timeline scrubbing controls in a focused component.
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx`
  Purpose: own recovery playback state, reduced-motion handling, layout, and wiring between copy, controls, and scene.
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx`
  Purpose: verify autoplay, reset, scrubbing, and phase-card updates without depending on a real WebGL scene.
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx`
  Purpose: render the 3D launch/recovery environment plus a safe fallback when WebGL is unavailable.
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`
  Purpose: smoke-test the recovery scene container and fallback rendering in jsdom.

### Shared Copy And Styling

- Modify: `apps/web/src/lib/i18n.ts`
  Purpose: add navigation labels and bilingual copy for the new recovery demo page.
- Modify: `apps/web/src/styles.css`
  Purpose: add top-level navigation styles plus a dedicated visual treatment for the recovery explainer layout and scene stage.

## Chunk 1: Routing Shell And Navigation

### Task 1: Add a pure route helper for simulator vs recovery paths

**Files:**
- Create: `apps/web/src/lib/app-route.ts`
- Create: `apps/web/src/lib/app-route.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";

import { appRoutePath, resolveAppRoute } from "./app-route";

describe("app-route", () => {
  it("treats the root pathname as the simulator route", () => {
    expect(resolveAppRoute("/")).toBe("simulator");
  });

  it("treats /spacex-recovery as the recovery route", () => {
    expect(resolveAppRoute("/spacex-recovery")).toBe("spacex-recovery");
    expect(resolveAppRoute("/spacex-recovery/")).toBe("spacex-recovery");
  });

  it("falls back unknown paths to the simulator route", () => {
    expect(resolveAppRoute("/unknown")).toBe("simulator");
  });

  it("returns stable browser pathnames for known routes", () => {
    expect(appRoutePath("simulator")).toBe("/");
    expect(appRoutePath("spacex-recovery")).toBe("/spacex-recovery");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- src/lib/app-route.test.ts`

Expected: FAIL because `app-route.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal route helper**

Create `apps/web/src/lib/app-route.ts` with:

- an `AppRoute` union type: `"simulator" | "spacex-recovery"`
- `resolveAppRoute(pathname: string): AppRoute`
- `appRoutePath(route: AppRoute): string`

Implementation constraints:

- normalize trailing slashes
- avoid any React imports
- keep the helper generic enough for direct use by `App.tsx` and tests

- [ ] **Step 4: Re-run the focused test**

Run: `cd apps/web && npm test -- src/lib/app-route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/app-route.ts \
  apps/web/src/lib/app-route.test.ts
git commit -m "test: add app route helper"
```

### Task 2: Convert `App.tsx` into a route shell with shared navigation

**Files:**
- Create: `apps/web/src/features/simulator/components/SolarSystemSimulatorPage.tsx`
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Reference: `apps/web/src/lib/app-route.ts`

- [ ] **Step 1: Write the failing app-level route tests**

Extend `apps/web/src/App.test.tsx` with focused route checks like:

```tsx
it("renders the simulator page at /", () => {
  window.history.replaceState({}, "", "/");

  render(<App />);

  expect(screen.getByText("太阳系轨迹模拟器")).toBeInTheDocument();
  expect(screen.queryByText("SpaceX 火箭回收演示")).not.toBeInTheDocument();
});

it("renders the recovery page at /spacex-recovery", () => {
  window.history.replaceState({}, "", "/spacex-recovery");

  render(<App />);

  expect(screen.getByText("SpaceX 火箭回收演示")).toBeInTheDocument();
  expect(screen.queryByLabelText("任务控制面板")).not.toBeInTheDocument();
});

it("updates browser history when the user switches pages", async () => {
  render(<App />);

  await userEvent.click(screen.getByRole("link", { name: "SpaceX 火箭回收演示" }));

  expect(window.location.pathname).toBe("/spacex-recovery");
  expect(screen.getByText("SpaceX 火箭回收演示")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- src/App.test.tsx`

Expected: FAIL because `App.tsx` has no route shell, no shared navigation, and no recovery page branch.

- [ ] **Step 3: Implement the minimal route shell**

Update/create:

- move the current simulator-heavy `App.tsx` body into `apps/web/src/features/simulator/components/SolarSystemSimulatorPage.tsx`
- make `App.tsx` track the current route from `window.location.pathname`
- subscribe to `popstate` so browser back/forward changes rerender the correct page
- render a shared nav with localized labels for the simulator and recovery routes
- create a temporary `SpaceXRecoveryPage.tsx` stub that renders the recovery page heading/landmarks needed by the tests

Copy additions to `apps/web/src/lib/i18n.ts`:

- simulator nav label
- recovery nav label
- recovery page title/subtitle placeholders needed by the initial shell tests

- [ ] **Step 4: Re-run the focused test**

Run: `cd apps/web && npm test -- src/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx \
  apps/web/src/App.test.tsx \
  apps/web/src/features/simulator/components/SolarSystemSimulatorPage.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx \
  apps/web/src/lib/i18n.ts
git commit -m "feat: add route shell for simulator and recovery pages"
```

## Chunk 2: Shared Recovery Timeline Model And Page Playback

### Task 3: Add a pure recovery-sequence model

**Files:**
- Create: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts`
- Create: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.test.ts`

- [ ] **Step 1: Write the failing sequence-model tests**

Create `apps/web/src/features/spacex-recovery/lib/recovery-sequence.test.ts` with cases like:

```ts
import { describe, expect, it } from "vitest";

import {
  getRecoveryDemoSnapshot,
  getRecoveryPhase,
} from "./recovery-sequence";

describe("recovery-sequence", () => {
  it("starts in liftoff and ends in second-stage orbital continuation", () => {
    expect(getRecoveryPhase(0).id).toBe("liftoff");
    expect(getRecoveryPhase(1).id).toBe("second-stage-orbital-continuation");
  });

  it("separates the stages at the same progress point for both transforms", () => {
    const before = getRecoveryDemoSnapshot(0.32);
    const after = getRecoveryDemoSnapshot(0.36);

    expect(before.firstStage.position[0]).toBe(before.secondStage.position[0]);
    expect(after.firstStage.position[0]).not.toBe(after.secondStage.position[0]);
  });

  it("switches camera emphasis from launch to side-follow to recovery overview", () => {
    expect(getRecoveryDemoSnapshot(0.1).camera.mode).toBe("launch-pad");
    expect(getRecoveryDemoSnapshot(0.42).camera.mode).toBe("side-follow");
    expect(getRecoveryDemoSnapshot(0.78).camera.mode).toBe("recovery-overview");
  });

  it("keeps the second stage outbound while the booster returns after separation", () => {
    const snapshot = getRecoveryDemoSnapshot(0.72);

    expect(snapshot.firstStage.position[0]).toBeLessThan(snapshot.secondStage.position[0]);
    expect(snapshot.activePhase.id).toBe("first-stage-atmospheric-return");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/lib/recovery-sequence.test.ts`

Expected: FAIL because the recovery-sequence module does not exist yet.

- [ ] **Step 3: Implement the minimal timeline model**

Create `apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts` with:

- `RECOVERY_DEMO_DURATION_SECONDS`
- a `RecoveryPhase` definition array with start/end progress windows
- `getRecoveryPhase(progress)`
- `getRecoveryDemoSnapshot(progress)`

Snapshot output should include:

- `activePhase`
- `firstStage` transform
- `secondStage` transform
- `camera` mode and target vectors
- `trajectory` visibility/progress for stage one and stage two
- phase-highlight bullets for the left-hand explainer card

Implementation constraints:

- keep all positions/rotations as plain numeric tuples so the module stays testable without Three.js
- clamp input progress to `[0, 1]`
- model stage one and stage two motion as authored keyframe interpolation, not physics integration

- [ ] **Step 4: Re-run the focused test**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/lib/recovery-sequence.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts \
  apps/web/src/features/spacex-recovery/lib/recovery-sequence.test.ts
git commit -m "feat: add recovery demo sequence model"
```

### Task 4: Build playback state, phase copy, and timeline controls for the recovery page

**Files:**
- Create: `apps/web/src/features/spacex-recovery/components/RecoveryPhaseCard.tsx`
- Create: `apps/web/src/features/spacex-recovery/components/RecoveryPlaybackControls.tsx`
- Modify: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx`
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Reference: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts`

- [ ] **Step 1: Write the failing page-behavior tests**

Create `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx` and mock the scene component so the tests stay focused on page state:

```tsx
vi.mock("./SpaceXRecoveryScene", () => ({
  default: ({ snapshot }: { snapshot: { activePhase: { id: string } } }) => (
    <div data-testid="recovery-scene-stub">{snapshot.activePhase.id}</div>
  ),
}));

it("starts autoplaying when reduced motion is not requested", () => {
  render(<SpaceXRecoveryPage language="zh" />);

  expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
  expect(screen.getByText("一级起飞")).toBeInTheDocument();
});

it("resets the timeline back to liftoff after scrubbing", async () => {
  render(<SpaceXRecoveryPage language="zh" />);

  const slider = screen.getByLabelText("演示进度");
  fireEvent.change(slider, { target: { value: "65" } });
  await userEvent.click(screen.getByRole("button", { name: "重置" }));

  expect(screen.getByText("一级起飞")).toBeInTheDocument();
});

it("starts paused when prefers-reduced-motion is enabled", () => {
  mockReducedMotion(true);

  render(<SpaceXRecoveryPage language="zh" />);

  expect(screen.getByRole("button", { name: "开始" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx`

Expected: FAIL because the page still contains only a stub and no playback state or controls.

- [ ] **Step 3: Implement the minimal page and control components**

Update/create:

- `RecoveryPhaseCard.tsx` to render the active phase title, description, and highlight bullets
- `RecoveryPlaybackControls.tsx` to render play/pause, reset, and a range input scrubber
- `SpaceXRecoveryPage.tsx` to:
  - keep `progress` and `isPlaying` state
  - derive the active snapshot from `getRecoveryDemoSnapshot(progress)`
  - advance autoplay with a timer while `isPlaying` is true
  - honor `prefers-reduced-motion` by starting paused
  - pass the snapshot into the phase card and the scene

Add bilingual copy in `apps/web/src/lib/i18n.ts` for:

- recovery page eyebrow/title/body
- playback control labels
- timeline label
- phase titles/descriptions if you choose to localize them through the message catalog rather than inside the model

- [ ] **Step 4: Re-run the focused test**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx src/features/spacex-recovery/lib/recovery-sequence.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/spacex-recovery/components/RecoveryPhaseCard.tsx \
  apps/web/src/features/spacex-recovery/components/RecoveryPlaybackControls.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx \
  apps/web/src/lib/i18n.ts
git commit -m "feat: add recovery page playback and explainer content"
```

## Chunk 3: 3D Scene, Fallbacks, And Visual Integration

### Task 5: Add the dedicated Three.js recovery scene with a safe fallback

**Files:**
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx`
- Create: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`
- Reference: `apps/web/src/features/spacex-recovery/lib/recovery-sequence.ts`
- Reference: `apps/web/src/features/scene/components/SolarSystemScene.tsx`

- [ ] **Step 1: Write the failing recovery-scene smoke tests**

Create `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx` with cases like:

```tsx
import { render, screen } from "@testing-library/react";

import SpaceXRecoveryScene from "./SpaceXRecoveryScene";
import { getRecoveryDemoSnapshot } from "../lib/recovery-sequence";

it("renders a named recovery-scene region", () => {
  render(<SpaceXRecoveryScene snapshot={getRecoveryDemoSnapshot(0.2)} language="zh" />);

  expect(screen.getByTestId("spacex-recovery-scene")).toBeInTheDocument();
});

it("renders a fallback explainer when WebGL is unavailable", () => {
  render(<SpaceXRecoveryScene snapshot={getRecoveryDemoSnapshot(0.75)} language="zh" />);

  expect(screen.getByText("当前环境无法显示 3D 画面")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`

Expected: FAIL because the recovery scene component does not exist yet.

- [ ] **Step 3: Implement the minimal recovery scene**

Create `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx` with:

- a root region marked with `data-testid="spacex-recovery-scene"`
- a canvas-backed Three.js scene that draws:
  - a curved horizon or low coastal ground plane
  - a launch mount silhouette
  - a landing zone or drone-ship-style platform
  - first-stage and second-stage meshes
  - emissive trajectory lines using the snapshot trajectory data
- a guarded WebGL initialization path that falls back to a copy-only panel when `canvas.getContext("webgl")` or renderer setup fails
- per-snapshot updates for rocket transforms, camera position, and trail emphasis

Implementation constraints:

- do not fetch any mission API data
- derive every visual update from the provided snapshot
- keep cleanup strict: cancel animation frames, dispose materials/geometries, and remove resize listeners on unmount
- keep the component narrowly focused on scene rendering; do not move playback state into it

- [ ] **Step 4: Re-run the focused test**

Run: `cd apps/web && npm test -- src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx
git commit -m "feat: add SpaceX recovery scene"
```

### Task 6: Integrate the finished recovery page visuals and run regression coverage

**Files:**
- Modify: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`
- Reference: `apps/web/src/features/spacex-recovery/components/SpaceXRecoveryScene.tsx`

- [ ] **Step 1: Extend the failing integration tests for final page structure**

Add/update tests so they assert:

```tsx
it("renders the recovery explainer layout with controls and scene on the recovery route", () => {
  window.history.replaceState({}, "", "/spacex-recovery");

  render(<App />);

  expect(screen.getByRole("heading", { name: "SpaceX 火箭回收演示" })).toBeInTheDocument();
  expect(screen.getByLabelText("演示进度")).toBeInTheDocument();
  expect(screen.getByTestId("spacex-recovery-scene")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused integration tests to verify they fail**

Run: `cd apps/web && npm test -- src/App.test.tsx src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx`

Expected: FAIL because the page still lacks its final layout/styling integration or the real scene hookup.

- [ ] **Step 3: Finish page integration and styling**

Update:

- `SpaceXRecoveryPage.tsx` to mount the real `SpaceXRecoveryScene`
- `apps/web/src/styles.css` to add:
  - shared top-nav styling
  - recovery-page desktop and mobile layout rules
  - scene viewport styling
  - phase-card and control-panel styling
  - fallback-panel styling

Style constraints:

- keep the existing deep-space/dark cinematic base instead of introducing a disconnected visual language
- make the recovery page read more like a guided exhibit than the simulator form
- ensure the recovery page remains usable on narrow screens

- [ ] **Step 4: Run the relevant regression suite**

Run: `cd apps/web && npm test -- src/lib/app-route.test.ts src/App.test.tsx src/features/spacex-recovery/lib/recovery-sequence.test.ts src/features/spacex-recovery/components/SpaceXRecoveryPage.test.tsx src/features/spacex-recovery/components/SpaceXRecoveryScene.test.tsx`

Expected: PASS

Also run: `cd apps/web && npm test -- src/features/scene/components/SolarSystemScene.test.ts src/features/scene/components/EmptySolarPreview.test.tsx`

Expected: PASS to confirm the route-shell refactor did not break existing scene coverage.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.test.tsx \
  apps/web/src/features/spacex-recovery/components/SpaceXRecoveryPage.tsx \
  apps/web/src/styles.css
git commit -m "feat: integrate SpaceX recovery demo page"
```
