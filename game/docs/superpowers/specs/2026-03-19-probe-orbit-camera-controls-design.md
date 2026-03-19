# Probe Orbit Camera Controls Design

## Summary

The first-person scene already improved immersion, but the camera is still effectively locked into a guided presentation. That makes it hard to inspect the local environment around the spacecraft, especially during flybys, arrival capture, and close passes where users naturally want to look around.

The agreed direction is to add a user-controlled orbit camera that always stays centered on the probe:

- desktop users can drag to rotate and use the wheel to zoom
- touch users can drag with one finger to rotate and pinch with two fingers to zoom
- the camera remains probe-focused instead of turning into a free-fly scene camera
- pitch and distance stay clamped so the view remains readable and never flips

This should make the scene feel interactive and inspectable without giving up the clean mission-display experience we already established.

## Goals

- Let the user freely inspect the probe's local surroundings while playback continues.
- Keep the probe as the permanent focal point of the main 3D scene.
- Support both desktop pointer input and touch input.
- Preserve smooth camera motion so interaction does not make the scene jittery.
- Fit into the current minimal HUD without adding large new controls.

## Non-Goals

- Building a detached free camera that can leave the probe.
- Adding a large control panel for camera modes or complex debug toggles.
- Replacing the existing probe-following framing logic with raw manual transforms.
- Supporting keyboard piloting or cinematic preset switching in this increment.

## Recommended Approach

Keep the current probe-centric camera pipeline, but layer orbit controls on top of it.

The scene should continue to derive a stable local reference frame from the probe position and motion. User input should then adjust orbit parameters around that moving frame:

- `yaw` controls horizontal rotation around the probe
- `pitch` controls vertical tilt with upper and lower clamps
- `radius` controls follow distance with min and max clamps

The rendered camera should still pass through the existing smoothing/interpolation path so orbit changes and probe motion blend together cleanly.

This approach gives the user the feeling of fully rotating around the craft while preserving the scene discipline of a mission display rather than a sandbox editor.

## Alternatives Considered

### 1. Probe-Locked Orbit Camera

Recommended.

Pros:

- Matches the user request closely.
- Reuses the current camera framing and smoothing architecture.
- Keeps the probe visible and central at all times.
- Easy to support consistently across mouse and touch.

Cons:

- Requires careful gesture handling to avoid accidental jitter.
- Needs good clamp tuning so zoom and pitch feel natural.

### 2. Temporary Drag-To-Look First-Person Camera

Pros:

- Stronger cockpit-like immersion.
- Minimal zoom logic.

Cons:

- Loses visibility of the spacecraft body.
- Harder to keep orientation readable during fast maneuvers.
- Less useful for inspecting flyby geometry.

### 3. Full Free-Fly Scene Camera

Pros:

- Maximum freedom.
- Useful for debugging and cinematic screenshots.

Cons:

- Breaks the probe-centric experience.
- Easier to get lost or clip into geometry.
- Adds more state, more UI, and more failure cases than the current need justifies.

## Interaction Model

### Desktop

- primary drag rotates the camera around the probe
- mouse wheel zooms in and out
- releasing input keeps the latest orbit state instead of snapping back

### Touch

- one-finger drag rotates the camera around the probe
- two-finger pinch adjusts zoom radius
- two-finger motion should avoid interpreting pinch as independent orbit drags

### Reset

A lightweight `重置视角` control may be shown only if needed. If present, it should restore the default orbit state for the current probe-follow framing without resetting playback.

## Architecture

### 1. Orbit State

`SolarSystemScene` should own a compact orbit-control state:

- `yaw`
- `pitch`
- `radius`
- active gesture metadata needed to interpret pointer and touch deltas

This state should be local to the scene and should not alter mission playback data.

### 2. Probe-Relative Camera Frame

The current camera helpers already build a probe-relative frame from position and velocity. That should remain the foundation.

The new behavior should:

- compute the probe anchor and local basis exactly once per frame
- apply orbit parameters to that basis to derive the desired camera offset
- keep the look target on the probe or a very small forward-offset aim point

This preserves the strong sense that the spacecraft is the center of the scene even when the user rotates widely around it.

### 3. Smoothing

The desired orbit view should not be applied as an immediate jump unless the user explicitly resets the camera.

Instead:

- user input updates desired orbit parameters
- camera position and orientation continue to flow through the existing smoothing path
- smoothing should stay responsive enough that drag feels direct, not delayed

This means we keep cinematic smoothness without returning to the current locked bird's-eye feeling.

### 4. Input Handling

Pointer and touch handling should live near the scene shell that already owns the main canvas surface.

The interaction layer should:

- capture drag origin and latest deltas
- normalize desktop and touch movement into orbit updates
- clamp pitch and radius immediately after each update
- avoid interacting with other HUD elements when the gesture starts on controls

Recommended separation:

- `SolarSystemScene.tsx` coordinates events and passes desired orbit state
- `camera-motion.ts` or a nearby focused helper owns orbit math and clamp rules

## Camera Rules

### Orbit Constraints

- clamp pitch so the camera never flips over the poles of the probe frame
- clamp radius so users cannot zoom infinitely far away or clip into the craft/body visuals
- preserve a readable default orbit angle when the scene initializes or resets

### Focus Rules

- the camera always tracks the probe
- zoom changes distance, not target identity
- orbit rotation changes viewpoint, not mission state

### Scene Safety

- interaction should not stop playback
- camera updates should remain stable if probe velocity is tiny or briefly ambiguous
- fallback orientation should use the existing safe frame logic when motion vectors are degenerate

## Testing Strategy

- Add unit tests for orbit-angle and zoom clamping.
- Add tests for converting orbit parameters into probe-relative camera offsets.
- Extend current camera-motion tests to verify smoothing still converges correctly after orbit updates.
- Add focused interaction tests where feasible for pointer drag, wheel zoom, and touch pinch normalization.

## Open Questions Deferred

- Whether to expose a visible reset control or rely on route / scene switches to restore defaults.
- Whether future phases should add optional auto-rotate or cinematic snap-to-event behaviors.

Those can wait until the core orbit interaction is in place and evaluated in the running scene.
