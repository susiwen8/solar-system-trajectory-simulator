# Probe Orbit Camera Controls Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a probe-locked orbit camera so users can rotate around the spacecraft with desktop drag, wheel zoom, and touch gestures while preserving the current smooth cinematic scene.

**Architecture:** Keep mission playback and probe-centric framing intact, but introduce a small orbit-control model that describes desired `yaw`, `pitch`, and `radius`. Feed that orbit state into the existing `camera-frame` and `camera-motion` pipeline, then wire pointer and touch gestures in `SolarSystemScene` so the camera remains centered on the probe without becoming a free-fly editor.

**Tech Stack:** React, TypeScript, Three.js, Vitest, React Testing Library, CSS

---

## Planned File Structure

- Create: `apps/web/src/features/scene/lib/orbit-camera.ts`
- Create: `apps/web/src/features/scene/lib/orbit-camera.test.ts`
- Create: `apps/web/src/features/scene/components/SolarSystemScene.test.tsx`
- Modify: `apps/web/src/features/scene/lib/camera-frame.ts`
- Modify: `apps/web/src/features/scene/lib/camera-frame.test.ts`
- Modify: `apps/web/src/features/scene/lib/camera-motion.ts`
- Modify: `apps/web/src/features/scene/lib/camera-motion.test.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/styles.css`

## Chunk 1: Orbit Parameter Model

### Task 1: Add failing tests for orbit-state defaults, clamps, and gesture math

**Files:**
- Create: `apps/web/src/features/scene/lib/orbit-camera.test.ts`
- Create: `apps/web/src/features/scene/lib/orbit-camera.ts`
- Test: `apps/web/src/features/scene/lib/orbit-camera.test.ts`

- [ ] **Step 1: Write failing tests for default orbit state and clamp behavior**

```ts
it("creates a readable default orbit state", () => {
  expect(createDefaultOrbitCameraState()).toEqual({
    yawRad: 0,
    pitchRad: expect.closeTo(0.22, 3),
    radiusScale: 1,
  });
});

it("clamps pitch and radius into the supported orbit range", () => {
  const next = clampOrbitCameraState({
    yawRad: 1.2,
    pitchRad: 4,
    radiusScale: 0.05,
  });

  expect(next.pitchRad).toBeLessThan(1.3);
  expect(next.pitchRad).toBeGreaterThan(-1.3);
  expect(next.radiusScale).toBeGreaterThanOrEqual(0.72);
});
```

- [ ] **Step 2: Extend the failing test with drag, wheel, and pinch updates**

```ts
it("applies drag deltas as orbit yaw and pitch adjustments", () => {
  const next = applyOrbitDragDelta(
    createDefaultOrbitCameraState(),
    { deltaX: 120, deltaY: -40 },
  );

  expect(next.yawRad).not.toBe(0);
  expect(next.pitchRad).toBeGreaterThan(0.22);
});

it("applies wheel and pinch input as radius changes", () => {
  const zoomed = applyOrbitWheelDelta(createDefaultOrbitCameraState(), -120);
  const pinched = applyOrbitPinchScale(createDefaultOrbitCameraState(), 1.4);

  expect(zoomed.radiusScale).toBeLessThan(1);
  expect(pinched.radiusScale).toBeLessThan(1);
});
```

- [ ] **Step 3: Run the focused orbit helper tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/orbit-camera.test.ts`
Expected: FAIL because `orbit-camera.ts` does not exist yet.

- [ ] **Step 4: Implement the minimal orbit helper**

Create `apps/web/src/features/scene/lib/orbit-camera.ts` with:

- an `OrbitCameraState` type
- `createDefaultOrbitCameraState()`
- `clampOrbitCameraState(state)`
- `applyOrbitDragDelta(state, delta)`
- `applyOrbitWheelDelta(state, deltaY)`
- `applyOrbitPinchScale(state, pinchRatio)`

The first implementation should:

- keep `yawRad` unbounded
- clamp `pitchRad` and `radiusScale`
- use small, deterministic desktop/touch sensitivity constants
- return new immutable state objects

- [ ] **Step 5: Re-run the focused orbit helper tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/orbit-camera.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/scene/lib/orbit-camera.ts apps/web/src/features/scene/lib/orbit-camera.test.ts
git commit -m "feat: add orbit camera state helpers"
```

## Chunk 2: Probe Frame Integration

### Task 2: Extend camera-frame tests to cover orbit-aware framing

**Files:**
- Modify: `apps/web/src/features/scene/lib/camera-frame.ts`
- Modify: `apps/web/src/features/scene/lib/camera-frame.test.ts`
- Test: `apps/web/src/features/scene/lib/camera-frame.test.ts`

- [ ] **Step 1: Add failing tests for orbit yaw, pitch, and radius integration**

Add cases such as:

```ts
it("rotates the cruise camera around the probe when yaw changes", () => {
  const frame = buildProbeCameraFrame(
    samplePositionKm,
    view("cruise-follow"),
    1.15,
    { yawRad: Math.PI / 2, pitchRad: 0.22, radiusScale: 1 },
  );

  expect(Math.abs(frame.position[0] - frame.lookAt[0])).toBeGreaterThan(6);
});

it("moves the camera higher when pitch increases", () => {
  const low = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
    yawRad: 0,
    pitchRad: -0.1,
    radiusScale: 1,
  });
  const high = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1.15, {
    yawRad: 0,
    pitchRad: 0.8,
    radiusScale: 1,
  });

  expect(high.position[1]).toBeGreaterThan(low.position[1]);
});
```

- [ ] **Step 2: Run the focused frame tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera-frame.test.ts`
Expected: FAIL because `buildProbeCameraFrame(...)` does not accept orbit state yet.

- [ ] **Step 3: Update `camera-frame.ts` to accept orbit state**

Implement the minimal change so `buildProbeCameraFrame(...)`:

- accepts an optional `OrbitCameraState`
- derives a probe-relative basis from the existing forward/right/up vectors
- rotates the cinematic offset around that basis using `yawRad` and `pitchRad`
- scales follow distance using `radiusScale`
- keeps `lookAt` locked to the probe or a tiny forward look-ahead

- [ ] **Step 4: Re-run the focused frame tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera-frame.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/camera-frame.ts apps/web/src/features/scene/lib/camera-frame.test.ts apps/web/src/features/scene/lib/orbit-camera.ts
git commit -m "feat: add orbit-aware probe camera framing"
```

### Task 3: Extend camera-motion tests to preserve smooth convergence with orbit updates

**Files:**
- Modify: `apps/web/src/features/scene/lib/camera-motion.ts`
- Modify: `apps/web/src/features/scene/lib/camera-motion.test.ts`
- Test: `apps/web/src/features/scene/lib/camera-motion.test.ts`

- [ ] **Step 1: Add a failing motion test for rapid orbit target changes**

```ts
it("smoothly converges when orbit input changes the target view", () => {
  const next = advanceCameraMotion(
    {
      position: [0, 0, 0],
      lookAt: [0, 0, 10],
      fovDeg: 58,
      zoom: 1,
    },
    {
      position: [12, 8, -4],
      lookAt: [1, 1, 1],
      fovDeg: 58,
      zoom: 1,
    },
    0.16,
  );

  expect(next.position[0]).toBeGreaterThan(0);
  expect(next.position[0]).toBeLessThan(12);
});
```

- [ ] **Step 2: Run the focused motion tests and confirm the new case fails for the right reason**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera-motion.test.ts`
Expected: FAIL only if additional normalization or snap logic is still needed after orbit integration.

- [ ] **Step 3: Make the minimal motion adjustments**

Only if the new test proves it is necessary:

- keep the current interpolation factors
- tighten vector snap handling if orbit-driven views stall near the target
- avoid adding new motion state that the tests do not require

- [ ] **Step 4: Re-run the focused motion tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera-motion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/camera-motion.ts apps/web/src/features/scene/lib/camera-motion.test.ts
git commit -m "refactor: keep orbit camera motion smooth"
```

## Chunk 3: Scene Interaction Wiring

### Task 4: Add failing scene interaction tests for desktop and touch controls

**Files:**
- Create: `apps/web/src/features/scene/components/SolarSystemScene.test.tsx`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Test: `apps/web/src/features/scene/components/SolarSystemScene.test.tsx`

- [ ] **Step 1: Write a failing test for desktop drag and wheel input**

Mock `buildProbeCameraFrame` and assert that a later render receives updated orbit state after interaction:

```ts
it("updates orbit framing after desktop drag and wheel zoom", async () => {
  render(<SolarSystemScene {...props} />);

  const surface = screen.getByTestId("scene-surface");
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 180, clientY: 70, buttons: 1 });
  fireEvent.pointerUp(surface, { pointerId: 1 });
  fireEvent.wheel(surface, { deltaY: -120 });

  expect(buildProbeCameraFrame).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    expect.any(Number),
    expect.objectContaining({
      yawRad: expect.any(Number),
      pitchRad: expect.any(Number),
      radiusScale: expect.any(Number),
    }),
  );
});
```

- [ ] **Step 2: Add a failing test for touch drag and pinch zoom**

```ts
it("updates orbit framing after touch rotate and pinch gestures", async () => {
  render(<SolarSystemScene {...props} />);

  const surface = screen.getByTestId("scene-surface");
  fireEvent.touchStart(surface, {
    touches: [
      { identifier: 1, clientX: 100, clientY: 100 },
      { identifier: 2, clientX: 180, clientY: 100 },
    ],
  });
  fireEvent.touchMove(surface, {
    touches: [
      { identifier: 1, clientX: 90, clientY: 90 },
      { identifier: 2, clientX: 210, clientY: 90 },
    ],
  });

  expect(buildProbeCameraFrame).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the focused scene interaction tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/components/SolarSystemScene.test.tsx`
Expected: FAIL because the scene does not expose the surface test hook or orbit gesture handling yet.

- [ ] **Step 4: Implement the minimal scene interaction layer**

Update `SolarSystemScene.tsx` so that it:

- stores orbit state with `useState`
- resets orbit state only when the mission result changes in a way that invalidates the current framing
- routes wheel, pointer drag, one-finger touch, and two-finger pinch into the orbit helper
- passes orbit state into `buildProbeCameraFrame(...)`
- exposes `data-testid="scene-surface"` on the interactive surface

Keep this implementation lean:

- no large new panel
- no detached camera mode
- no playback changes

- [ ] **Step 5: Re-run the focused scene interaction tests**

Run: `cd apps/web && npm test -- src/features/scene/components/SolarSystemScene.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/features/scene/components/SolarSystemScene.test.tsx apps/web/src/features/scene/lib/orbit-camera.ts apps/web/src/features/scene/lib/camera-frame.ts
git commit -m "feat: add probe orbit camera interactions"
```

### Task 5: Apply the surface-level CSS needed for touch handling and optional reset affordance

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Test: `apps/web/src/features/scene/components/SolarSystemScene.test.tsx`

- [ ] **Step 1: Add a failing assertion for the interaction surface attributes or reset affordance**

Example:

```ts
expect(screen.getByTestId("scene-surface")).toHaveStyle({ touchAction: "none" });
```

If a reset button is added:

```ts
expect(screen.getByRole("button", { name: "重置视角" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused scene interaction tests to confirm the UI polish case fails**

Run: `cd apps/web && npm test -- src/features/scene/components/SolarSystemScene.test.tsx`
Expected: FAIL because the surface is still missing the interaction-specific polish.

- [ ] **Step 3: Add the minimal CSS and optional reset styling**

Update `styles.css` so `.scene-shell__surface`:

- disables browser touch panning and pinch conflicts with `touch-action: none`
- uses an intentional interaction cursor on desktop where appropriate
- keeps overlays readable without shrinking the 3D canvas

If the reset control is kept, style it as a small in-scene affordance instead of a new toolbar.

- [ ] **Step 4: Re-run the focused scene interaction tests**

Run: `cd apps/web && npm test -- src/features/scene/components/SolarSystemScene.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles.css apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/features/scene/components/SolarSystemScene.test.tsx
git commit -m "style: polish orbit camera interaction surface"
```

## Chunk 4: Verification

### Task 6: Run focused and broad frontend verification

**Files:**
- Verify only

- [ ] **Step 1: Run the new focused test files**

Run: `cd apps/web && npm test -- src/features/scene/lib/orbit-camera.test.ts src/features/scene/lib/camera-frame.test.ts src/features/scene/lib/camera-motion.test.ts src/features/scene/components/SolarSystemScene.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run the broader frontend suite**

Run: `cd apps/web && npm test`
Expected: PASS with any existing jsdom/WebGL fallback warnings remaining non-blocking.

- [ ] **Step 3: Sanity-check the diff**

Run: `git diff --stat`
Expected: only the planned scene orbit-camera files, tests, and any tightly related style updates.

- [ ] **Step 4: Commit final verification polish if needed**

```bash
git add apps/web
git commit -m "test: verify probe orbit camera controls"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-19-probe-orbit-camera-controls-implementation-plan.md`. Because you already asked me to execute, the next step is to start Chunk 1 with a failing orbit helper test.
