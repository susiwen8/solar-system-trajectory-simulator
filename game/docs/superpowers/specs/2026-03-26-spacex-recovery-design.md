# SpaceX Recovery Demo Page Design

Date: 2026-03-26
Status: Draft approved in conversation, pending written review

## Summary

Add a dedicated frontend route that explains SpaceX-style reusable rocket recovery with a guided 3D demonstration.

The new page should coexist with the current solar-system simulator and focus on a stylized, technically legible launch sequence:

- first-stage liftoff with ascent trajectory
- stage separation between first and second stage
- first-stage boostback, descent, and landing
- second-stage continuation toward orbit

The experience should feel like a polished interactive exhibit rather than a form-driven simulator. It should autoplay by default, keep simple playback controls, and synchronize the 3D scene, timeline, and explanatory copy from one shared mission sequence model.

## Goals

- Add a new route for a standalone SpaceX recovery explainer page without disturbing the current simulator home page.
- Present a clearly readable 3D sequence showing liftoff, first-stage separation, first-stage recovery, and second-stage orbital continuation.
- Use SpaceX-inspired two-stage reusable rocket behavior instead of a fictional three-stage launch vehicle.
- Provide a mixed experience: guided autoplay plus manual play, pause, reset, and timeline scrubbing.
- Keep the visual language aligned with the existing dark, cinematic space theme while shifting the page layout toward a story-led explainer.
- Structure the scene logic so timing, camera changes, phase descriptions, and trajectory rendering all derive from the same shared data model.

## Non-Goals

- Building a physically accurate Falcon 9 flight simulator or orbital mechanics solver.
- Pulling live SpaceX mission data or matching a specific historical mission frame by frame.
- Modeling every subsystem such as fairing halves, grid fins, or full launch pad plumbing in this increment.
- Reworking the existing solar-system mission UI beyond adding navigation to the new page.
- Introducing a heavyweight routing dependency if a lightweight native route switch is sufficient.

## Product Behavior

### Route Structure

- Keep the current simulator available at `/`.
- Add a new route at `/spacex-recovery`.
- Provide lightweight top-level navigation so users can move between the simulator and the recovery demo.
- The recovery page should be directly addressable by URL refresh and initial load.
- Route changes should work with browser back and forward navigation instead of behaving like an in-memory tab switch only.

### Page Layout

The page should use a two-column explainer layout on desktop:

- left column: title, intro copy, current phase card, technical highlights, and playback controls
- right column: the 3D scene and timeline scrubber

On smaller screens, the layout should collapse into a single column with the explainer content above the scene controls and the 3D viewport sized to stay usable without horizontal scrolling.

### Playback Model

The demo should open in autoplay mode unless motion-reduction preferences suggest otherwise.

Controls:

- play
- pause
- reset
- timeline scrubber

Behavior:

- dragging the scrubber immediately updates scene state, camera, trail highlights, and phase copy
- reset returns the demo to the opening launch state
- autoplay pauses when the timeline reaches the final phase
- users can resume autoplay from any scrubbed position

### Story Phases

The experience should be broken into named phases that are visible in the UI and drive the scene:

1. Liftoff
2. Pitch and Ascent
3. Stage Separation
4. First-Stage Boostback
5. First-Stage Atmospheric Return
6. Landing Burn and Touchdown
7. Second-Stage Orbital Continuation

The page copy should explicitly frame the vehicle as a SpaceX-style two-stage reusable system, not a literal three-stage rocket.

These phases are guided emphasis beats for the explainer UI, not mutually exclusive physical states. After separation, the second stage continues outbound while the first stage enters its return sequence. The final phase should shift narrative emphasis to the upper stage after the booster landing is established.

## Recommended Architecture

## 1. Lightweight Route Shell

The existing app entry should add a small route-selection layer that reads `window.location.pathname` and renders either:

- the existing simulator page
- the new SpaceX recovery page

This should preserve the current app structure and avoid introducing routing complexity that the codebase does not yet need.

The route shell should also render shared navigation and keep the current simulator behavior unchanged when users stay on `/`.
Navigation actions should update browser history cleanly so deep links and back navigation stay reliable.

## 2. Dedicated Recovery Page Container

Add a page-level component responsible for:

- explainer layout
- phase copy
- playback state
- timeline UI
- scene props wiring

This component should not own low-level Three.js object mutation directly. It should consume a shared timeline model and pass derived values into presentational subcomponents.

## 3. Shared Recovery Sequence Model

Create a pure data module that defines:

- total demo duration
- phase boundaries
- phase metadata and explanatory labels
- rocket transform keyframes
- first-stage and second-stage trajectory points
- camera mode transitions
- engine plume intensity windows

This module is the source of truth for both the UI and the scene.

From a normalized progress value, the app should be able to derive:

- active phase
- first-stage transform
- second-stage transform
- current camera framing
- visible trail segments
- landing platform visibility and emphasis
- UI labels for the current step

That boundary keeps the most important behavior testable without depending on WebGL rendering.

## 4. Recovery Scene Component

Add a dedicated 3D scene component for the new route.

The scene should render a stylized launch environment composed of:

- curved Earth horizon or coastal ground plane
- atmospheric gradient and sky glow
- launch mount area
- landing platform or landing zone near the waterline
- reusable first stage
- attached second stage and payload section before separation
- emissive trajectory lines for stage one and stage two

The rocket models can remain low-poly and diagrammatic as long as separation, orientation, and relative paths are visually obvious.

### Scene Motion Principles

- motion should be driven by deterministic timeline sampling, not physics integration
- transforms should interpolate between authored keyframes
- stage one and stage two should separate cleanly at the same normalized moment used by the copy and timeline
- trajectory lines should remain visible to help users understand divergence after separation
- active trajectory segments should glow more strongly than future or already completed segments

## 5. Camera Choreography

The page should use a guided mixed-camera sequence rather than a user-controlled free camera.

Recommended camera beats:

- launch: low-angle ground view emphasizing thrust and scale
- ascent and separation: side-follow framing that makes the split readable
- recovery: pulled-back elevated framing that shows first-stage return while second stage continues outward

Camera changes should feel intentional and smooth, with eased interpolation between viewpoints instead of abrupt cuts unless a hard cut proves clearer at separation.

## Scene Semantics

### Vehicle Structure

The demo vehicle represents:

- first-stage booster
- second-stage vehicle
- payload/fairing section

The copy should avoid claiming that the second stage fully reaches a final mission orbit in a physically rigorous sense. It is sufficient to show that it continues on an orbital insertion path while the booster returns.

### Trajectories

The first-stage path should read as:

- upward climb
- outward arc
- separation
- flip and return
- descent toward landing target

The second-stage path should read as:

- shared ascent before separation
- continued climb to a higher, flatter arc
- visual continuation toward orbital insertion

These are explanatory curves, not solved astrodynamics.

### Environmental Readability

The page should prioritize legibility over realism:

- keep the rocket large enough to read on laptop screens
- exaggerate vertical separation distances if needed
- keep the landing platform visible during the recovery phase
- use color-coded trails or materials to distinguish stages

## UI Content

### Hero and Intro Copy

The page header should briefly explain the core idea:

- the first stage does most of the early ascent work
- the stages separate in flight
- the booster returns for landing and reuse
- the upper stage continues toward orbit

### Phase Card

The active phase card should show:

- phase title
- short explanation
- one or two technical highlights tied to the current animation moment

Examples include:

- main engine cutoff and separation timing
- boostback burn purpose
- atmospheric reentry and landing burn purpose
- why the upper stage continues after booster separation

### Timeline

The timeline should expose all named phases and show current progress.

Users should be able to:

- scrub to any phase
- understand which phase is active at a glance
- resume autoplay from the selected position

## Error Handling and Fallbacks

- If WebGL setup fails, render a non-3D fallback panel with the same phase list and explanatory copy instead of a blank region.
- If `prefers-reduced-motion` is detected, start paused and avoid aggressive automatic camera movement until the user presses play.
- If the viewport is too small for the side-by-side layout, stack the content so controls remain reachable without overlapping the scene.

## Testing Strategy

### Route and UI Tests

Add tests for:

- rendering the new navigation entry
- loading the recovery page when the pathname is `/spacex-recovery`
- keeping the existing simulator page visible at `/`
- playback controls updating the visible phase copy
- reset returning the demo to the first phase

### Sequence Model Tests

Add pure-function tests for:

- phase lookup from normalized progress
- stage separation timing
- first-stage and second-stage transform sampling
- camera mode selection across timeline boundaries
- trajectory segment visibility rules

### Scene Smoke Tests

Add lightweight component tests that verify:

- the recovery page renders a 3D scene container
- the phase card and timeline render expected labels
- the page can mount without mission API data

The tests do not need to validate live WebGL pixels. They should protect the data flow, route wiring, and core user interactions.

## Constraints

- Reuse the existing React and Three.js stack already present in the project.
- Keep the new page self-contained and avoid coupling it to mission-propagation APIs.
- Preserve the current home page behavior and existing tests as much as possible.
- Prefer small focused modules so playback logic, view copy, and scene transforms remain independently understandable.

## Implementation Notes

The smallest safe path is:

1. add a lightweight route shell and navigation
2. add the recovery page layout and shared sequence model
3. connect playback controls and phase copy to that model
4. render the dedicated Three.js scene using the same normalized progress source
5. add regression and interaction tests around routing and phase state

This keeps the new work additive, isolates the 3D demo from mission-planning code, and creates room for later visual enhancements such as fairing events or a more detailed landing zone without forcing an architecture rewrite.
