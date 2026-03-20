# Empty Scene Preview Visual Refinement Design

> Status: proposed
> Date: 2026-03-20
> Branch: `codex/mission-dynamics-realism`

## Goal

Refine the newly added empty-scene orbit preview so it feels more like a believable solar-system observation view rather than a first-pass technical preview.

This refinement targets three visible qualities together:

- orbit guides should read as more realistic orbital references
- camera motion should feel smoother and more cinematic
- planets and the Sun should have clearer visual hierarchy and depth

## User Decisions

- Improve all three areas together: orbit guides, camera feel, and planet visuals.
- Keep the preview clean with no added text, labels, or overlay panels.
- Preserve the always-on ambient rotation behavior.
- Keep user drag additive; it must not pause the ambient motion.
- Limit the scope to the empty-state preview rather than expanding into the active mission scene.

## Problem Summary

The current empty preview successfully replaces the old placeholder, but it still has several “first implementation” qualities:

- orbit guides are generated from simple circular distances and still feel schematic
- camera updates are mathematically correct but not yet especially smooth or cinematic
- planets share a fairly similar material treatment, so the Sun and major bodies do not separate visually enough
- spatial depth is present, but not yet strong enough to make the overview feel observational

The result is functional, but not yet as polished or believable as the rest of the scene direction.

## Non-Goals

This design does not include:

- any changes to the active `SolarSystemScene` mission rendering flow
- probe rendering in the empty scene
- text labels, hover labels, or informational callouts
- new backend data or new frontend API contracts
- photoreal planetary textures
- physically exact orbital element reconstruction for every body

## Design Principles

1. `Believability over ornament.` Improvements should make the preview feel more like a solar-system view, not more like UI decoration.
2. `Smoothness is part of realism.` Camera behavior should feel inertial and continuous rather than mechanically reactive.
3. `Hierarchy matters.` The Sun, inner planets, and outer planets should not all compete at the same visual weight.
4. `Stay quiet.` Even when richer, the empty scene should still feel restrained and uncluttered.
5. `Protect active-scene stability.` Changes should remain isolated to empty-preview code paths and reusable helpers.

## Existing Architecture Fit

The current implementation already has the right seams:

- [EmptySolarPreview.tsx](/Users/susiwen8/Documents/projects/game/apps/web/src/features/scene/components/EmptySolarPreview.tsx) owns the empty-scene WebGL runtime
- [empty-preview-motion.ts](/Users/susiwen8/Documents/projects/game/apps/web/src/features/scene/lib/empty-preview-motion.ts) owns the empty-scene camera state math
- [body-physics.ts](/Users/susiwen8/Documents/projects/game/apps/web/src/features/scene/lib/body-physics.ts) already provides size baselines
- [scale.ts](/Users/susiwen8/Documents/projects/game/apps/web/src/features/scene/lib/scale.ts) already provides scene-distance compression helpers

This means the refinement can be kept local:

- extend helper math where needed
- add one or two small visual-model helpers if useful
- keep `App.tsx` unchanged

## Proposed Refinements

## 1. Orbit Guide Refinement

### Current Limitation

The current preview uses a circular orbit guide generated from the body's instantaneous radial distance.

That keeps the view readable, but the result still looks like a generic ring around the Sun rather than a more credible planetary path.

### Proposed Direction

Replace the single-radius circle guide with a more stable orbital reference model:

- generate a low-cost ellipse-like guide from the current body position and a per-body shape profile
- keep the guide centered on the Sun
- allow subtle per-body eccentricity and axis differences so the guides no longer read as interchangeable rings

### Visual Rules

- inner planets: finer, slightly brighter guides
- outer planets: softer, wider, more distant-feeling guides
- all guides: low contrast, subordinate to the planetary bodies

The goal is not astrophysical precision in the empty state. The goal is to stop the guides from feeling like placeholder rings.

## 2. Camera Motion Refinement

### Current Limitation

The current camera state applies:

- direct ambient yaw increments
- direct drag deltas
- direct zoom deltas

This works, but it reads as a little rigid because the camera state changes immediately.

### Proposed Direction

Introduce a two-layer camera motion model:

- `input state`
  the state updated by drag and wheel input
- `rendered state`
  the state the camera actually uses each frame after smoothing toward the input state

Ambient rotation should continue to advance on the input state, while the rendered state eases toward it.

### Expected Feel

- auto-rotation feels calmer and more fluid
- user drag blends into the ongoing motion rather than fighting it
- zoom feels less jumpy and more observational

The scene should feel like a slowly drifting observation platform rather than a directly manipulated editor camera.

## 3. Planet And Sun Visual Hierarchy

### Current Limitation

The current preview uses one broad mesh/material strategy for every body, with the Sun only lightly separated by emissive intensity.

That makes the overall view coherent, but it underplays:

- the Sun as the visual anchor
- giant planets as major scene masses
- distant planets as lower-presence bodies

### Proposed Direction

Refine body appearance through three layers:

### Sun

- stronger emissive presence
- slightly richer glow falloff
- clearer role as the scene's light anchor

### Inner planets

- more compact, slightly crisper appearance
- enough brightness to remain legible near the Sun

### Outer planets

- softer shading and slightly more atmospheric falloff
- less visual competition with the Sun and inner-system cluster

### Depth cues

Add subtle depth support through:

- light fog tuning
- per-body brightness balancing
- distance-sensitive visual softness where appropriate

The result should improve spatial depth without introducing labels or overlays.

## UI Impact

The page structure remains unchanged:

- `App.tsx` still renders the empty preview when there is no active mission
- no new controls are added
- no new informational text appears

The improvement is entirely experiential and visual.

## Error Handling

Retain the current failure posture:

- if WebGL is unavailable, fail quietly into the existing safe fallback behavior
- if body data is sparse, still render a stable minimal preview

The refinement should not make the empty state more fragile.

## Testing Strategy

Add or extend targeted coverage for:

1. Orbit-guide helper behavior
   Verify that generated guide geometry/profile values differ by body class and remain stable.

2. Camera smoothing behavior
   Verify:
   - ambient rotation still advances over time
   - drag input changes the target state
   - rendered state eases toward the target rather than snapping directly
   - zoom smoothing remains bounded

3. Component stability
   Verify that `EmptySolarPreview` still mounts for both populated and sparse body datasets.

4. App regression safety
   Keep the existing empty-state `App` integration test passing so the preview remains the main empty-scene surface.

## Open Implementation Notes

- Prefer one small visual helper module over embedding all refinement math inside `EmptySolarPreview.tsx`.
- Keep orbit-guide generation intentionally approximate and readable rather than chasing full orbital mechanics inside the browser.
- Avoid changing shared scene helpers unless the refinement genuinely benefits both paths.
