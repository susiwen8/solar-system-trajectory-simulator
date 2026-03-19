# Arrival Capture And Orbit Visualization Design

## Summary

The current end-of-mission scene makes successful arrival look like a collision.

Today the frontend draws a single heliocentric trajectory line from `result.samples` and marks the closest-approach point as arrival. That is enough to show transfer geometry, but it is not enough to communicate orbital capture. When the line visually runs into the target body, the scene implies impact instead of "approach, insertion burn, captured orbit."

The agreed direction is to fix this in two stages:

- Phase 1: add a visually plausible captured-orbit path around the arrival body so the scene stops looking like a crash
- Phase 2: extend mission results so arrival missions can return real post-capture samples and events, then render those instead of a synthetic orbit

This sequence improves the scene quickly without losing the long-term goal of data/visual consistency.

## Goals

- Make successful arrival read as orbital capture rather than surface impact.
- Preserve the current first-person scene and HUD structure while improving the final mission phase.
- Reuse existing mission-segment and `orbitSummary` data where possible.
- Support a graceful transition from synthesized visual capture to real post-capture samples.
- Keep the final design compatible with future arrival events, timeline steps, and mission realism upgrades.

## Non-Goals

- Full high-fidelity capture-burn optimization in the first frontend-only phase.
- Atmospheric entry, landing, aerobraking, or powered descent simulation.
- Moon-system operations or multi-body captured-orbit dynamics in this increment.
- Replacing the existing heliocentric transfer visualization for the cruise portion of the mission.

## Recommended Approach

Use a staged upgrade.

Phase 1 should solve the immediate perception problem in the scene layer. If the mission result indicates bound arrival information, the frontend should draw a local orbit around the target body instead of visually terminating the transfer path through the planet.

Phase 2 should then move that behavior into the mission result itself by adding explicit arrival/capture samples and events. Once real capture samples exist, the scene should stop synthesizing a local orbit except as a fallback for older result shapes.

This approach is better than waiting for full backend realism because the current issue is already user-visible and strongly affects trust in the simulator. It is also better than stopping at a visual fix because the simulator should eventually render what the mission solver actually produced.

## Alternatives Considered

### 1. Visual Orbit Only

Pros:

- Fastest way to remove the "collision" look.
- No API or result-shape change required initially.
- Low risk to current playback controls.

Cons:

- The rendered capture path is only inferred, not physically produced by the solver.
- Timeline, events, and local orbit geometry may drift from the actual mission result.

### 2. Real Capture Samples Only

Pros:

- Best long-term physical consistency.
- Scene becomes a direct presentation of mission output.

Cons:

- Slower to deliver user-visible improvement.
- Leaves the current bad arrival visual in place until backend changes land.

### 3. Visual Capture First, Real Capture Second

Recommended.

Pros:

- Fixes the most obvious scene problem quickly.
- Creates a clean migration path toward fully data-driven rendering.
- Lets the frontend adopt the new result shape incrementally.

Cons:

- Temporary dual-path logic is required while both synthetic and real capture paths are supported.

## Architecture

The work should be split into two layers of responsibility.

### 1. Scene Synthesis Layer

This layer lives in the web app and is responsible for converting mission result hints into a local captured-orbit visualization when the result does not yet contain post-capture samples.

It should:

- detect whether the mission appears to end in bound arrival
- derive a local orbit shape from `orbitSummary`, segment type, and closest-approach context
- generate a compact orbit path centered on the arrival body
- splice the scene presentation so the heliocentric path ends at approach and the local orbit begins at capture

### 2. Mission Result Layer

This layer lives in the mission result contract and should eventually provide explicit arrival/capture samples instead of only an orbit summary.

It should:

- emit a segment for orbital insertion / capture / parking orbit
- include real samples in the target-centered frame or a clearly defined equivalent playback frame
- expose arrival events that identify the insertion moment and bound-orbit state

The scene should prefer this layer whenever it is available.

## Phase 1 Design: Visual Capture Orbit

### Trigger Conditions

The frontend should synthesize a local orbit only when the mission appears to represent a successful bound arrival. Candidate signals:

- an arrival-related segment with `orbitSummary.isBound === true`
- a `parkingOrbit` segment
- a terminal arrival/capture segment that includes periapsis/apoapsis information

If none of these signals exist, the scene should keep the current transfer-only behavior.

### Orbit Geometry

The synthetic orbit should be derived from mission data, not hard-coded per planet.

Preferred inputs:

- `orbitSummary.periapsisKm`
- `orbitSummary.apoapsisKm`
- `orbitSummary.inclinationDeg`

Fallback behavior:

- if only periapsis is known, build a near-circular orbit at that radius
- if only closest approach is known, derive a conservative circularized display orbit slightly above the body visual radius

The orbit does not need to be dynamically propagated in Phase 1. It only needs to read clearly as a captured orbit around the target body.

### Scene Rendering Rules

The scene should render two distinct path types near mission end:

- heliocentric transfer path up to arrival
- local captured-orbit path around the target body

The transfer path should no longer visually continue through the target body center in bound-arrival cases.

Recommended rendering details:

- keep the transfer path in the existing cyan language
- render the captured orbit with a distinct but related accent, such as a warmer or brighter ring
- align the orbit to the target body rather than the global solar-system plane when enough geometry is known

### Camera And Playback Behavior

When the active sample is in the arrival window:

- the first-person camera should favor the target body and the synthesized orbit path
- the probe should appear to skim past the body and settle into a local orbital track
- if playback moves beyond the final heliocentric sample, the scene may pin the craft to the synthetic orbit position that best matches the local arrival state

The key goal is to stop showing a straight-through intercept.

### Fallback Rules

The synthesized orbit should not appear for:

- gravity-assist flybys
- miss-distance trajectories
- missions that only report closest approach without any bound-arrival hint

This prevents flybys from incorrectly looking like capture.

## Phase 2 Design: Real Arrival And Capture Samples

### Result Shape Upgrade

Arrival missions should return an explicit post-capture mission segment rather than only a summary field.

Recommended segment sequence near mission end:

- `heliocentricCruise`
- `arrivalCapture`
- `parkingOrbit` or `scienceOrbit`

Each of these segments should carry:

- `segmentType`
- `startEpoch`
- `endEpoch`
- `samples`
- `events`
- `initialState`
- `finalState`
- `orbitSummary` where relevant

### Event Model

The result should include explicit arrival-state events so UI and playback can speak the same language.

Recommended event types:

- `targetApproach`
- `orbitInsertionBurn`
- `captureEstablished`
- `scienceOrbitEstablished`

This lets the HUD and timeline move from "next event: approach" to real capture milestones.

### Frontend Consumption Rules

Once post-capture samples exist:

- the scene should render those samples as the authoritative local-orbit path
- the synthetic Phase 1 orbit should become a fallback only
- timeline and HUD logic should prefer the explicit capture events

This keeps the transition clean and avoids maintaining two equally important representations forever.

## Data Flow

### Phase 1

- read `result.segments`
- locate the terminal arrival or parking-orbit segment
- inspect `orbitSummary`
- build a synthetic local orbit model
- render that model around `result.closestApproach.bodyId`

### Phase 2

- mission service emits explicit capture segment samples
- frontend scene consumes those samples directly
- HUD and timeline consume explicit insertion/capture events

## Testing Strategy

### Phase 1 Tests

- scene helper tests for bound-arrival detection from mission segments
- scene helper tests for captured-orbit geometry generation from `orbitSummary`
- component tests that verify a captured-orbit path is rendered when bound arrival data exists
- component tests that verify no captured-orbit path is rendered for flybys or miss-distance cases

### Phase 2 Tests

- mission-result tests that verify arrival missions emit explicit `arrivalCapture` / `parkingOrbit` segments with samples
- tests that verify capture events are added to the mission timeline
- scene tests that verify real capture samples are preferred over synthetic orbit generation when both are present

## Rollout Plan

### Stage 1

- add a frontend helper that detects bound arrival and builds a synthetic local orbit
- render the capture orbit around the target body in the 3D scene
- clamp or split the transfer-line presentation so it no longer reads as planetary impact

### Stage 2

- extend the mission result model with explicit arrival/capture segments and events
- update the mission pipeline to emit post-capture samples
- switch the scene to real capture-sample rendering with synthetic-orbit fallback

### Stage 3

- update HUD and timeline text to surface orbit insertion and capture milestones
- optionally expose arrival orbit parameters in a compact mission summary panel

## Risks

- A synthetic orbit that is too decorative may look fake if it does not align with the approach direction.
- If bound-arrival detection is too loose, flybys may be misclassified as captures.
- If real capture samples later use a different frame convention than the synthetic fallback, the handoff may feel discontinuous.

These risks are why Phase 1 should be visibly conservative and Phase 2 should replace guesswork with explicit mission data as soon as practical.

## Acceptance Criteria

- Successful arrival no longer looks like the trajectory crashes directly into the target body.
- Bound-arrival missions show a clear local orbit around the destination.
- Flyby missions do not incorrectly render captured orbits.
- The scene can prefer real post-capture samples once they are available.
- The design leaves a clear migration path from synthesized visualization to true arrival dynamics.
