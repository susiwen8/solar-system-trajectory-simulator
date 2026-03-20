# Empty Scene Orbit Preview Design

> Status: proposed
> Date: 2026-03-20
> Branch: `codex/mission-dynamics-realism`

## Goal

Replace the current `scene-shell--empty` placeholder with a living solar-system overview so the main scene remains valuable before a mission is computed.

The empty state should feel like a quiet observatory view of the current planetary layout:

- a bird's-eye 3D solar-system preview fills the main scene area
- the view auto-rotates gently at all times
- users can drag to rotate and use the wheel to zoom
- user interaction does not pause the automatic rotation
- no instructional copy or decorative fake orbit placeholders remain

## User Decisions

- Use a `light interactive` empty-state preview, not a static illustration.
- Keep the preview in the main `scene-shell--empty` area.
- Do not show onboarding or interaction hint text.
- Do not pause automatic rotation while the user drags.
- Keep the experience visually clean rather than adding extra panels or labels.

## Problem Summary

The current empty state in [App.tsx](/Users/susiwen8/Documents/projects/game/apps/web/src/App.tsx) is only a CSS backdrop:

- three fake orbit rings
- one decorative sun disc
- one short placeholder headline

That works as a loading-era placeholder, but it no longer matches the rest of the product:

- the main scene area looks inactive when no mission is selected
- it does not reflect current planetary positions
- it feels visually disconnected from the actual Three.js scene language
- it wastes the largest area of the interface on non-informative decoration

## Non-Goals

This design does not include:

- probe rendering in the empty state
- mission trajectory playback in the empty state
- the right-top trajectory inset map while no mission exists
- explanatory overlays, empty-state cards, or tutorial text
- new backend APIs dedicated to the empty-state scene
- turning the empty state into a full duplicate of `SolarSystemScene`

## Design Principles

1. `Use real scene data when possible.` The empty state should reflect current body positions, not fake orbital art.
2. `Keep the empty state quiet.` It should feel alive, but not busier than the active mission scene.
3. `Reuse scene language, not scene complexity.` Share rendering conventions and camera behavior where helpful, but avoid importing mission-specific mechanics.
4. `Interaction should be additive.` User drag and zoom refine the view while the scene continues its ambient motion.
5. `The main canvas is enough.` The preview should stand on its own without helper copy.

## Existing Architecture Fit

The current frontend already has most of the building blocks needed for this change:

- [App.tsx](/Users/susiwen8/Documents/projects/game/apps/web/src/App.tsx) owns the `activeResult ? ... : scene-shell--empty` switch
- [SolarSystemScene.tsx](/Users/susiwen8/Documents/projects/game/apps/web/src/features/scene/components/SolarSystemScene.tsx) already proves the project can render a Three.js solar-system scene with orbit-style camera control
- [TrajectoryInsetMap.tsx](/Users/susiwen8/Documents/projects/game/apps/web/src/features/scene/components/TrajectoryInsetMap.tsx) already expresses the intended “global overview” concept, even though it is 2D and mission-specific
- the page already loads planetary body states for the current epoch

This means the best fit is a small dedicated empty-state scene component rather than another static CSS illustration.

## Proposed Architecture

Introduce a dedicated empty-state preview component:

- `EmptySolarPreview`

Responsibilities:

- render a simplified Three.js bird's-eye solar-system view
- show the Sun, major planets, and orbit guides
- consume the existing `bodies` dataset already available to `App`
- manage its own light camera interaction and ambient motion

It should not know anything about:

- trajectory samples
- mission segments
- playback controls
- probe attitude
- thrust or maneuver effects

## Rendering Model

### 1. Real Planet Positions

Use the current `bodies` state already fetched by the application as the source of truth for planet positions.

That keeps the empty state aligned with the rest of the app:

- same epoch
- same ephemeris source chain
- no second data-fetch pathway

If bodies are temporarily unavailable, the component may render a minimal safe fallback scene, but the intended steady state is to show actual planet positions.

### 2. Bird's-Eye Camera

The empty preview uses a top-down dominant framing:

- camera starts above the ecliptic plane
- the Sun remains the central anchor
- the system is framed as an overall orbit overview, not a probe-follow shot

The scene should still feel spatially 3D through:

- perspective camera depth
- slight tilt away from a perfectly flat orthographic read
- lighting and body shading consistent with the active Three.js scene style

### 3. Ambient Motion

The camera keeps a slow automatic yaw motion at all times.

Rules:

- the motion should be subtle enough to preserve readability
- the motion should continue even while the user is dragging
- user drag offsets are applied on top of the ambient rotation rather than replacing it

This creates a continuously living scene without abrupt “stop/start” behavior.

### 4. Orbit Guides

The preview may draw orbit guides for readability, but they should behave like scene elements rather than placeholder decoration.

Guidelines:

- use subdued lines
- derive orbit extents from rendered body positions and stable scene-scale rules
- avoid the current fake three-ring CSS treatment

## Interaction Design

### Drag

Pointer drag rotates the viewing angle around the solar-system overview.

Behavior:

- keep the user anchored to a top-down-biased inspection mode
- prevent flips into disorienting below-plane views
- do not pause or disable automatic rotation while dragging

### Wheel

Wheel input changes zoom distance.

Behavior:

- support a practical range from broad system overview to a closer inner-system look
- clamp zoom to preserve stability and prevent clipping

### Idle Behavior

No explicit idle reset is required in the first version.

Because automatic rotation always continues, the preview naturally remains active without having to snap back to a “default” state.

## UI Surface Changes

When there is no `activeResult`:

- the `scene-shell--empty` container remains
- the decorative CSS backdrop is removed
- the empty headline is removed
- the main surface is occupied by the new `EmptySolarPreview`

No empty-state text should remain in the scene region.

The right-top mission inset should remain absent in this state because the main surface is already the overview.

## Styling Direction

The empty preview should inherit the current scene shell language:

- same scene card container
- same dark atmospheric background family
- no extra copy blocks
- no floating explainer pill

The result should feel like the mission scene's quiet pre-launch mode, not a separate product surface.

## Error Handling

If WebGL setup fails:

- preserve the current frontend fallback behavior pattern
- render a simple non-blocking fallback surface instead of crashing the page

If body data is temporarily missing:

- prefer a sparse visual fallback over text-heavy messaging
- do not reintroduce the removed instructional copy

## Testing Strategy

Add targeted coverage for:

1. `App` empty-state rendering
   Verify that the old empty headline and decorative placeholder content no longer drive the empty scene.

2. `EmptySolarPreview` rendering
   Verify that the empty scene mounts a preview surface when no mission is active.

3. Interaction helpers
   If camera or ambient-rotation math is extracted into helpers, verify:
   - drag updates camera offsets
   - wheel updates zoom
   - ambient rotation remains active during user interaction

4. Regression safety for the active mission scene
   Ensure the change does not alter the existing `SolarSystemScene` contract when `activeResult` is present.

## Open Implementation Notes

- Prefer extracting only the minimal reusable scene helpers needed from `SolarSystemScene.tsx`.
- Do not turn this change into a broad scene-architecture rewrite.
- Keep the write scope centered on the empty-state branch and its dedicated preview component.
