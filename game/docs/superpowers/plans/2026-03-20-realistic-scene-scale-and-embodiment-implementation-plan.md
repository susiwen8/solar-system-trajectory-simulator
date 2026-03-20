# Realistic Scene Scale And Embodiment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the 3D probe scene so planets use real radius data, the probe becomes physically tiny by comparison, the main view feels embodied rather than top-down, and long-range space stays readable through compressed distance mapping instead of fake body enlargement.

**Architecture:** Keep the existing mission result contract and current scene component structure, but split scene scaling into three responsibilities: physical body/probe constants, focus-relative distance compression, and camera/visibility behavior. The scene should consume existing mission samples and segment metadata, while replacing hand-tuned radii and the single linear scale with real-radius rendering plus non-linear distance mapping.

**Tech Stack:** React, TypeScript, Three.js, Vitest, React Testing Library

---

Implementation should follow `@superpowers:test-driven-development` and verify every claimed result with `@superpowers:verification-before-completion`.

## File Map

### Frontend

- Create: `apps/web/src/features/scene/lib/body-physics.ts`
  Purpose: define real planetary radii and a single medium-class probe physical baseline.
- Create: `apps/web/src/features/scene/lib/body-physics.test.ts`
  Purpose: lock real-radius ordering, Saturn-only rings assumptions, and probe/body proportion guards.
- Modify: `apps/web/src/features/scene/lib/scale.ts`
  Purpose: replace the current one-line linear mapping with focus-relative near/transition/far distance compression helpers.
- Create: `apps/web/src/features/scene/lib/scale.test.ts`
  Purpose: verify near-field linearity, smooth transition behavior, and far-field compression.
- Modify: `apps/web/src/features/scene/lib/probe-model.ts`
  Purpose: derive probe visual scale from the physical baseline instead of a hand-tuned oversized constant.
- Modify: `apps/web/src/features/scene/lib/probe-model.test.ts`
  Purpose: verify the probe remains dramatically smaller than real-radius planets while keeping thrust effects readable.
- Modify: `apps/web/src/features/scene/lib/camera-frame.ts`
  Purpose: keep the camera close to the probe by default and only retreat modestly when near-field bodies would otherwise overwhelm the frame.
- Modify: `apps/web/src/features/scene/lib/camera-frame.test.ts`
  Purpose: verify embodied framing remains close in cruise and retreats only as needed near large bodies.
- Modify: `apps/web/src/features/scene/lib/focus-visuals.ts`
  Purpose: tune focus-body halos and atmosphere cues so distant targets are perceptible without being visually enlarged.
- Modify: `apps/web/src/features/scene/lib/focus-visuals.test.ts`
  Purpose: keep guidance subtle and ensure only Saturn has rings.
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
  Purpose: remove inline display radii, render bodies with real-radius-derived scene sizes, use compressed distance mapping, and apply updated camera/probe behavior.
- Modify: `apps/web/src/features/scene/lib/trajectory.ts`
  Purpose: route sample positions through the new scale helpers where required by the main scene path rendering.
- Modify: `apps/web/src/features/scene/lib/view.ts`
  Purpose: keep overview/inset transformations aligned with the new scaling responsibilities.
- Modify: `apps/web/src/features/scene/lib/arrival-capture.ts`
  Purpose: preserve believable parking-orbit geometry against the new real-radius body sizes.
- Modify: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
  Purpose: ensure capture paths still render outside the body silhouette after radius realism changes.
- Modify: `apps/web/src/features/scene/lib/camera.test.ts`
  Purpose: keep probe camera mode selection aligned with the updated embodied rendering.

## Chunk 1: Real Body And Probe Scale Foundations

### Task 1: Add physical body/probe constants behind tests

**Files:**
- Create: `apps/web/src/features/scene/lib/body-physics.ts`
- Create: `apps/web/src/features/scene/lib/body-physics.test.ts`
- Modify: `apps/web/src/features/scene/lib/probe-model.ts`
- Modify: `apps/web/src/features/scene/lib/probe-model.test.ts`

- [ ] **Step 1: Write failing tests for real body radii and probe proportion**

```ts
import { describe, expect, it } from "vitest";

import {
  BODY_PHYSICAL_RADII_KM,
  PROBE_PHYSICAL_BASELINE_METERS,
  sceneBodyRadiusFromPhysicalKm,
} from "./body-physics";

describe("BODY_PHYSICAL_RADII_KM", () => {
  it("keeps gas giants larger than terrestrial planets", () => {
    expect(BODY_PHYSICAL_RADII_KM.jupiter).toBeGreaterThan(BODY_PHYSICAL_RADII_KM.earth);
    expect(BODY_PHYSICAL_RADII_KM.saturn).toBeGreaterThan(BODY_PHYSICAL_RADII_KM.mars);
  });

  it("keeps the sun larger than every planet", () => {
    expect(BODY_PHYSICAL_RADII_KM.sun).toBeGreaterThan(BODY_PHYSICAL_RADII_KM.jupiter);
  });
});

describe("sceneBodyRadiusFromPhysicalKm", () => {
  it("maps real radii into stable scene radii without reordering bodies", () => {
    expect(sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.jupiter))
      .toBeGreaterThan(sceneBodyRadiusFromPhysicalKm(BODY_PHYSICAL_RADII_KM.earth));
  });
});

describe("PROBE_PHYSICAL_BASELINE_METERS", () => {
  it("keeps the probe tiny next to planets", () => {
    expect(PROBE_PHYSICAL_BASELINE_METERS.busDiameter).toBeLessThan(5);
    expect(PROBE_PHYSICAL_BASELINE_METERS.spanWidth).toBeLessThan(25);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/body-physics.test.ts src/features/scene/lib/probe-model.test.ts`

Expected: FAIL because `body-physics.ts` does not exist yet and probe scale still uses the old display constants.

- [ ] **Step 3: Implement minimal physical constants and probe scale wiring**

Create `apps/web/src/features/scene/lib/body-physics.ts` with:

```ts
export const BODY_PHYSICAL_RADII_KM = {
  sun: 695_700,
  mercury: 2_439.7,
  venus: 6_051.8,
  earth: 6_371,
  mars: 3_389.5,
  jupiter: 69_911,
  saturn: 58_232,
  uranus: 25_362,
  neptune: 24_622,
} as const;

export const PROBE_PHYSICAL_BASELINE_METERS = {
  busDiameter: 2.8,
  spanWidth: 13.5,
} as const;

export function sceneBodyRadiusFromPhysicalKm(radiusKm: number): number {
  return Math.max(0.9, Math.pow(radiusKm, 0.38) / 3.2);
}

export function sceneProbeScaleFromMeters(spanMeters: number): number {
  return Math.max(0.03, spanMeters / 320);
}
```

Then update `probe-model.ts` so `PROBE_VISUAL_SCALE` is derived from `sceneProbeScaleFromMeters(PROBE_PHYSICAL_BASELINE_METERS.spanWidth)` rather than a hard-coded oversized value.

- [ ] **Step 4: Re-run the focused tests and verify they pass**

Run: `cd apps/web && npm test -- src/features/scene/lib/body-physics.test.ts src/features/scene/lib/probe-model.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/body-physics.ts \
  apps/web/src/features/scene/lib/body-physics.test.ts \
  apps/web/src/features/scene/lib/probe-model.ts \
  apps/web/src/features/scene/lib/probe-model.test.ts
git commit -m "feat: add real body and probe scale baselines"
```

## Chunk 2: Focus-Relative Distance Compression

### Task 2: Replace the single linear distance scale with near/transition/far mapping

**Files:**
- Modify: `apps/web/src/features/scene/lib/scale.ts`
- Create: `apps/web/src/features/scene/lib/scale.test.ts`
- Modify: `apps/web/src/features/scene/lib/trajectory.ts`
- Modify: `apps/web/src/features/scene/lib/view.ts`

- [ ] **Step 1: Write failing tests for near-field linearity and far-field compression**

```ts
import { describe, expect, it } from "vitest";

import {
  compressSceneDistanceKm,
  scaleDistanceKm,
} from "./scale";

describe("compressSceneDistanceKm", () => {
  it("stays close to linear in the near field", () => {
    expect(compressSceneDistanceKm(4_000)).toBeCloseTo(scaleDistanceKm(4_000), 5);
  });

  it("compresses far-field distances below the old linear mapping", () => {
    expect(compressSceneDistanceKm(150_000_000)).toBeLessThan(scaleDistanceKm(150_000_000));
  });

  it("remains monotonic across transition ranges", () => {
    const near = compressSceneDistanceKm(2_000_000);
    const mid = compressSceneDistanceKm(20_000_000);
    const far = compressSceneDistanceKm(200_000_000);
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/scale.test.ts`

Expected: FAIL because `compressSceneDistanceKm(...)` does not exist yet.

- [ ] **Step 3: Implement a smooth focus-relative compression model**

Update `apps/web/src/features/scene/lib/scale.ts` so it keeps `scaleDistanceKm(...)` as the near-field linear primitive and adds:

```ts
const NEAR_FIELD_LIMIT_KM = 2_000_000;
const TRANSITION_LIMIT_KM = 25_000_000;

export function compressSceneDistanceKm(distanceKm: number): number {
  const absolute = Math.abs(distanceKm);
  if (absolute <= NEAR_FIELD_LIMIT_KM) {
    return scaleDistanceKm(distanceKm);
  }

  if (absolute <= TRANSITION_LIMIT_KM) {
    const t = (absolute - NEAR_FIELD_LIMIT_KM) / (TRANSITION_LIMIT_KM - NEAR_FIELD_LIMIT_KM);
    const linear = scaleDistanceKm(absolute);
    const compressed = scaleDistanceKm(NEAR_FIELD_LIMIT_KM) + Math.log1p(absolute - NEAR_FIELD_LIMIT_KM) / 6;
    return Math.sign(distanceKm) * (linear * (1 - t) + compressed * t);
  }

  const compressed = scaleDistanceKm(NEAR_FIELD_LIMIT_KM) + Math.log1p(absolute - NEAR_FIELD_LIMIT_KM) / 5.5;
  return Math.sign(distanceKm) * compressed;
}
```

Then route scene-facing position transforms in `trajectory.ts` and `view.ts` through `compressSceneDistanceKm(...)` rather than the old always-linear path where appropriate for the main rendered scene.

- [ ] **Step 4: Re-run the focused tests and impacted scene-lib tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/scale.test.ts src/features/scene/lib/trajectory.test.ts src/features/scene/lib/view.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/scale.ts \
  apps/web/src/features/scene/lib/scale.test.ts \
  apps/web/src/features/scene/lib/trajectory.ts \
  apps/web/src/features/scene/lib/view.ts
git commit -m "feat: add focus-relative scene distance compression"
```

## Chunk 3: Embodied Camera And Real-Radius Scene Integration

### Task 3: Tighten the probe-adjacent camera and body rendering around real radii

**Files:**
- Modify: `apps/web/src/features/scene/lib/camera-frame.ts`
- Modify: `apps/web/src/features/scene/lib/camera-frame.test.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/features/scene/lib/camera.test.ts`

- [ ] **Step 1: Add failing camera tests for close cruise framing and bounded retreat**

```ts
it("keeps cruise framing close to the probe after realism retuning", () => {
  const frame = buildProbeCameraFrame(samplePositionKm, view("cruise-follow"), 1);
  const distance = Math.hypot(
    frame.position[0] - frame.lookAt[0],
    frame.position[1] - frame.lookAt[1],
    frame.position[2] - frame.lookAt[2],
  );

  expect(distance).toBeLessThan(18);
});

it("allows only bounded retreat for flyby emphasis", () => {
  const frame = buildProbeCameraFrame(samplePositionKm, view("flyby-emphasis"), 1.4);
  const distance = Math.hypot(
    frame.position[0] - frame.lookAt[0],
    frame.position[1] - frame.lookAt[1],
    frame.position[2] - frame.lookAt[2],
  );

  expect(distance).toBeLessThan(22);
});
```

- [ ] **Step 2: Run the focused camera tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera-frame.test.ts src/features/scene/lib/camera.test.ts`

Expected: FAIL because current offsets are still tuned for a more overview-style framing.

- [ ] **Step 3: Implement embodied camera offsets and real-radius mesh wiring**

Update `camera-frame.ts` to:

- reduce default cruise behind/height offsets
- keep orbit-camera rotation attached to the probe-adjacent frame
- clamp encounter retreat so the camera backs off only modestly around large bodies

Update `SolarSystemScene.tsx` to:

- replace the inline `bodyRadii` table with `BODY_PHYSICAL_RADII_KM` + `sceneBodyRadiusFromPhysicalKm(...)`
- render body meshes from that derived radius
- stop inflating focus bodies through broad group scaling when simple halo cues are enough
- keep Saturn-only rings via `getPlanetaryRingProfile(...)`
- use the new compressed scene positions for the main rendered bodies and trajectory geometry

- [ ] **Step 4: Re-run focused camera tests and main scene regression tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/camera-frame.test.ts src/features/scene/lib/camera.test.ts src/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/camera-frame.ts \
  apps/web/src/features/scene/lib/camera-frame.test.ts \
  apps/web/src/features/scene/lib/camera.test.ts \
  apps/web/src/features/scene/components/SolarSystemScene.tsx \
  apps/web/src/App.test.tsx
git commit -m "feat: render an embodied probe scene with real body radii"
```

## Chunk 4: Subtle Target Guidance And Capture/Encounter Regressions

### Task 4: Retune focus visuals and preserve flyby/capture readability under real scale

**Files:**
- Modify: `apps/web/src/features/scene/lib/focus-visuals.ts`
- Modify: `apps/web/src/features/scene/lib/focus-visuals.test.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Modify: `apps/web/src/features/scene/lib/proximity.ts`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx` *(only if the scene retuning surfaces copy regressions; otherwise leave untouched)*

- [ ] **Step 1: Add failing tests for subtle guidance and capture-path clearance**

```ts
import { describe, expect, it } from "vitest";

import { computeFocusBodyVisualProfile, getPlanetaryRingProfile } from "./focus-visuals";

describe("computeFocusBodyVisualProfile", () => {
  it("keeps cruise guidance subtle for non-encounter bodies", () => {
    const profile = computeFocusBodyVisualProfile("mars", "cruise-follow");
    expect(profile.haloOpacity).toBeLessThan(0.18);
    expect(profile.haloScale).toBeLessThan(1.16);
  });
});

describe("getPlanetaryRingProfile", () => {
  it("keeps Saturn ringed and leaves the other planets ringless", () => {
    expect(getPlanetaryRingProfile("saturn")).toBeTruthy();
    expect(getPlanetaryRingProfile("jupiter")).toBeNull();
    expect(getPlanetaryRingProfile("earth")).toBeNull();
  });
});
```

Also strengthen `arrival-capture.test.ts` so the rendered orbit path still clears the body silhouette after real-radius retuning.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/focus-visuals.test.ts src/features/scene/lib/arrival-capture.test.ts src/features/scene/lib/proximity.test.ts`

Expected: FAIL because current emphasis values and capture-path assumptions were tuned for the previous display radii.

- [ ] **Step 3: Implement subtle focus guidance and capture-path compatibility**

Update `focus-visuals.ts` to:

- reduce cruise-mode halo size/opacities
- keep stronger emphasis for `approach-emphasis` and `flyby-emphasis`
- preserve Saturn-only rings

Update `arrival-capture.ts` and `proximity.ts` so:

- capture paths still expand only when necessary to remain outside the new body silhouette
- flyby/approach proximity continues to choose the right focus body under compressed distance mapping

- [ ] **Step 4: Re-run the focused tests and then the full scene-related suite**

Run: `cd apps/web && npm test -- src/features/scene/lib/focus-visuals.test.ts src/features/scene/lib/arrival-capture.test.ts src/features/scene/lib/proximity.test.ts src/features/scene/lib/probe-model.test.ts src/features/scene/lib/camera-frame.test.ts src/features/scene/lib/camera.test.ts src/features/mission/components/MissionSummary.test.tsx src/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/focus-visuals.ts \
  apps/web/src/features/scene/lib/focus-visuals.test.ts \
  apps/web/src/features/scene/lib/arrival-capture.ts \
  apps/web/src/features/scene/lib/arrival-capture.test.ts \
  apps/web/src/features/scene/lib/proximity.ts \
  apps/web/src/features/scene/lib/probe-model.test.ts \
  apps/web/src/features/scene/lib/camera-frame.test.ts \
  apps/web/src/features/scene/lib/camera.test.ts \
  apps/web/src/features/mission/components/MissionSummary.test.tsx \
  apps/web/src/App.test.tsx
git commit -m "feat: preserve realistic target guidance and encounter readability"
```

## Final Verification

- [ ] **Step 1: Run the complete impacted frontend suite**

Run: `cd apps/web && npm test`

Expected: PASS with the existing repository baseline only; no new scene regressions.

- [ ] **Step 2: Perform manual browser verification**

Run: `cd apps/web && npm run dev`

Check:

- cruise scenes feel visibly emptier than before
- the probe is tiny relative to Mars, Jupiter, and Saturn
- flyby/capture scenes show bodies becoming physically imposing near encounter
- Saturn keeps rings while other planets do not
- the right-top inset still communicates the overall route

- [ ] **Step 3: Create the final implementation commit or squash if the user explicitly asks**

```bash
git status
git log --oneline -5
```

Expected: only the planned scene-realism commits from this feature branch remain to integrate.
