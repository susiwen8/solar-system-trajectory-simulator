# First Person Scene And Inset Map Design

## Summary

The current 3D scene communicates mission state, but it still behaves like a strategic bird's-eye map:

- the camera is fixed in an overhead orthographic view
- planets are visually tiny in the main stage
- the user has to infer local probe context from HUD text rather than seeing it

The next scene upgrade should make the simulation feel like an active spaceflight display rather than a static orbital diagram.

The agreed direction is:

- replace the current always-bird's-eye main scene with a hybrid first-person probe view
- keep the new main scene centered on the spacecraft and local surroundings
- automatically intensify the first-person effect near target approach and gravity-assist flybys
- add a lightweight 2D trajectory inset in the upper-right corner so the overall route remains visible

This work should improve immersion and readability without introducing a second heavy 3D renderer or a large control-surface redesign.

## Goals

- Make the primary scene feel like a local spacecraft view instead of a fixed system overview.
- Keep the spacecraft visually near the center of attention during playback.
- Show nearby targets and flyby bodies at readable cinematic scale in the main scene.
- Preserve global orientation by adding a persistent 2D inset trajectory map.
- Reuse the existing playback model so camera motion stays synchronized with `selectedSampleIndex` and `currentEpoch`.
- Keep the implementation compatible with both single-target trajectories and multi-planet tour candidates.

## Non-Goals

- Building a physically exact cockpit simulator or a detailed spacecraft interior.
- Adding a second Three.js renderer for the inset map.
- Replacing the current mission panel and candidate workflow.
- Introducing a free-fly camera or fully user-controlled 3D navigation in this phase.
- Reworking backend trajectory data contracts beyond what is already returned to the web app.

## Recommended Approach

Use one cinematic main renderer plus one lightweight 2D inset overlay.

The current scene should evolve into two coordinated presentation modes:

1. a main perspective camera that follows the probe and emphasizes local surroundings
2. a compact 2D inset map that preserves mission-level context

The scene should not attempt to show the full solar system at true scale in the main viewport. Instead, the main viewport should prioritize local readability and motion cues, while the inset map handles strategic context.

This keeps performance stable, matches the current React structure, and avoids duplicating scene-management logic across multiple WebGL views.

## Alternatives Considered

### 1. Main Perspective Scene Plus 2D Inset Map

Recommended.

Pros:

- Delivers the requested first-person feel in the primary viewport.
- Keeps overall route context visible at all times.
- Avoids the complexity of running two Three.js renderers.
- Fits the existing `SolarSystemScene` overlay architecture well.

Cons:

- Requires careful camera tuning so the view feels readable rather than chaotic.
- Requires mild decomposition of the existing scene component.

### 2. Dual 3D Viewports

Pros:

- Maximum visual consistency between the local view and overview.
- Could support more advanced future debug visualizations.

Cons:

- Higher rendering and maintenance cost.
- More difficult to test and keep responsive.
- Unnecessary for the current user goal.

### 3. Keep Bird's-Eye Main Scene And Add Cinematic Overlays

Pros:

- Lowest implementation cost.
- Minimal architectural change.

Cons:

- Does not actually satisfy the first-person request.
- Leaves the core readability issue unresolved.

## Architecture

The work should preserve `SolarSystemScene` as the orchestration component while moving view logic into focused helpers.

### 1. Main Scene Camera System

The scene should switch from a fixed overhead orthographic camera to a perspective camera driven by probe-relative state.

The main camera should:

- anchor itself around the active spacecraft sample
- orient toward the spacecraft velocity direction when velocity is available
- default to a follow-behind angle that still shows the forward field of travel
- automatically move into a tighter, more immersive framing when the mission is near a target approach or a `gravityAssistFlyby` segment

This should be a hybrid mode rather than a hard manual camera toggle. The user chose a mixed experience:

- normal playback: follow view
- target approach / closest approach / flyby: intensified first-person framing

### 2. Probe-Centric Local Framing

The main scene should no longer optimize for the entire route fitting onscreen.

Instead it should emphasize:

- the spacecraft position
- the current target body or flyby body
- a local starfield / motion backdrop
- motion cues such as trajectory streaks, heading emphasis, and target labels

Bodies that matter to the current local scene may be visually amplified relative to their current representation so they remain legible.

This amplification is a presentation choice, not a physics change. The inset map continues to communicate the global path faithfully.

### 3. 2D Trajectory Inset Map

The upper-right overlay should become a compact navigation map rendered in SVG or HTML/CSS rather than Three.js.

It should show:

- the sun as the center reference
- the mission trajectory path
- major visible bodies relevant to the route
- the spacecraft current position
- highlighted flyby or target markers when applicable

The inset should remain top-down and compact. It is a navigation aid, not a second primary canvas.

### 4. HUD Rebalancing

To make room for the inset map, the HUD should be redistributed:

- upper-left: mission phase and active segment details
- upper-right: trajectory inset map
- lower-right: speed and navigation telemetry
- lower-left: active maneuver or flyby situational panel

This keeps the center of the viewport visually clearer and allows the new first-person scene to dominate the experience.

### 5. Component And Helper Boundaries

Recommended file decomposition:

- keep `apps/web/src/features/scene/components/SolarSystemScene.tsx` as the high-level scene coordinator
- add `apps/web/src/features/scene/components/TrajectoryInsetMap.tsx` for the 2D inset
- add `apps/web/src/features/scene/lib/camera.ts` for follow-camera and intensified first-person framing
- add `apps/web/src/features/scene/lib/proximity.ts` for target/flyby/closest-approach state detection
- add `apps/web/src/features/scene/lib/inset-map.ts` for projecting trajectory and body positions into inset coordinates

This should prevent `SolarSystemScene.tsx` from accumulating all rendering, layout, and mission-state logic in one place.

## Data Flow

No new backend API is required for the first increment.

The scene should derive all new behavior from existing frontend data:

- `result.samples` provides probe position and velocity for camera framing
- `result.closestApproach` helps determine target emphasis windows
- `result.flybyEvents` and `result.segments` identify flyby-focused framing
- `bodies` provides current ephemeris positions for local target rendering and inset plotting
- `selectedSampleIndex` and `currentEpoch` drive synchronized playback state

The main requirement is better interpretation of existing data, not a new transport shape.

## Camera Behavior

The camera system should define three presentation states.

### 1. Cruise Follow

Default state during ordinary flight:

- camera sits slightly behind and above the spacecraft
- camera looks forward along the velocity vector
- field of view and target scale prioritize situational readability

### 2. Approach Emphasis

Active when the craft is near the mission target or a major visit body:

- camera moves closer to the forward axis
- target body receives stronger prominence
- the scene framing should make the destination feel imminent

### 3. Flyby Emphasis

Active when inside or near a `gravityAssistFlyby` segment:

- camera becomes tighter and more directional
- flyby body becomes the dominant environmental object
- HUD should reinforce the active flyby geometry and event state

The state machine should be deterministic and derived from mission data so playback is repeatable and testable.

## Inset Map Behavior

The inset map should be deliberately minimal.

It should:

- render the trajectory as a compact path
- show current probe progress along that path
- emphasize current target or flyby nodes
- remain readable for both short transfers and longer tour routes

It should not try to render every body in the solar system when that would create clutter. Relevance filtering is acceptable as long as the target path remains understandable.

## Visual Direction

The main scene should feel more like a flight theatre than a mission spreadsheet.

Recommended presentation cues:

- deeper starfield background with more contrast than the current flat bird's-eye composition
- visible forward motion cues around the craft
- larger nearby planets with atmospheric glow or limb lighting when useful
- restrained HUD glass panels that do not dominate the viewport center

The look should still fit the existing project aesthetic and avoid a full UI redesign.

## Error Handling And Fallbacks

If the scene cannot establish the enhanced WebGL view, the current fallback behavior should remain functional.

If data is too sparse for intensified framing:

- fall back to cruise-follow mode
- keep the inset map visible when possible
- avoid throwing or hiding the full scene

The absence of `flybyEvents`, `missionTimeline`, or rich segments must not block the scene from rendering.

## Testing Strategy

This work should follow TDD and add coverage at three levels.

### 1. Camera Logic Unit Tests

Add tests for the new camera helper logic to confirm:

- cruise-follow framing is produced for ordinary trajectory playback
- approach emphasis is activated near target proximity
- flyby emphasis is activated for `gravityAssistFlyby` segments or flyby-event windows

### 2. Inset Projection Unit Tests

Add tests for inset-map projection logic to confirm:

- trajectory points project into stable inset coordinates
- current probe position is highlighted correctly
- target and flyby markers remain in bounds and readable

### 3. UI Integration Tests

Extend web tests to confirm:

- the main scene renders a trajectory inset map overlay
- speed telemetry is still visible after HUD redistribution
- switching mission candidates updates both active segment details and inset-map state

## Implementation Notes

This work should be staged incrementally:

1. add camera logic and failing tests
2. wire the new perspective scene
3. add inset-map projection and rendering
4. rebalance HUD layout
5. polish proximity-driven transitions and candidate synchronization

Frequent small commits are preferred so the scene can be reviewed in visible milestones.

## Open Questions Resolved

- Main viewpoint mode: hybrid follow view with automatic stronger first-person behavior near targets and flybys
- Overview presentation: 2D inset map in the upper-right corner
- Scope posture: visual and interaction upgrade only, no backend contract expansion required for the first implementation phase
