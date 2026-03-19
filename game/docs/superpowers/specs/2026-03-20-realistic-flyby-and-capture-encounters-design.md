# Realistic Flyby And Capture Encounters Design

## Summary

The simulator now has a much stronger mission structure than it did originally:

- multi-planet visits can be selected directly
- mission playback is built around `segments`
- Earth departure, cruise, flyby, and arrival are already visible in the UI
- the 3D scene can present probe-centric flight rather than only a distant map

Even so, the most important local mission events still stop short of feeling physically real enough.

Today:

- flybys are represented mainly as ranked outcomes plus coarse event markers
- arrival capture is partially synthesized for presentation
- encounter phases are not yet modeled as first-class local mission segments with consistent geometry, events, and samples

The agreed direction for the next realism phase is:

- improve both gravity-assist flybys and target capture
- prioritize engineering-grade consistency over a fully strict orbital solver rewrite
- keep the current segment-first mission architecture
- make flyby and capture encounters real mission phases rather than visual or textual approximations

This phase should make the simulator feel much closer to a real exploration mission system without destabilizing the current planning and playback pipeline.

## Goals

- Model both flyby and capture as explicit encounter phases, not only summary metadata.
- Keep the existing mission segment architecture as the primary contract.
- Improve physical consistency around periapsis, SOI entry/exit, turn-angle geometry, and orbital insertion.
- Emit encounter-specific samples and events that the frontend can render directly.
- Preserve backward compatibility for current mission result consumers where practical.
- Create clean interfaces for future upgrades such as continuous low-thrust propagation and 3D plane-change realism.

## Non-Goals

- A full n-body local encounter propagator in this phase.
- Professional-grade B-plane targeting or covariance analysis.
- Atmospheric entry, aerobraking, landing, or moon-system operations.
- A full rewrite of the global heliocentric propagator.
- Collapsing all reference frames into one new universal sample stream.

## Recommended Approach

Use a shared encounter-geometry layer plus dedicated encounter planners.

The existing mission pipeline should continue to produce global mission context and heliocentric cruise states. Near a flyby or arrival, the system should switch into a more explicit local encounter model:

1. derive encounter geometry from the incoming boundary state and target-body state
2. feed that geometry into a dedicated flyby planner or arrival-capture planner
3. return explicit encounter segments, events, and local samples
4. let the frontend consume those segments directly instead of inferring physics on its own

This is better than a scene-only upgrade because the UI should reflect what the solver produced. It is also better than a strict solver rewrite because the current segment-based architecture is already yielding value and should be extended rather than discarded.

## Alternatives Considered

### 1. Scene Realism First

Pros:

- Fastest visible improvement.
- Low risk to backend mission propagation.
- Easy to ship incrementally in the web app.

Cons:

- Leaves physical consistency weak.
- Frontend must keep inventing encounter presentation rules.
- Does not materially strengthen the mission solver.

### 2. Strict Local Solver Rewrite

Pros:

- Highest physics fidelity.
- Strong long-term credibility for encounter modeling.

Cons:

- Too heavy for the current stage of the project.
- Would force broader propagation and API changes than necessary.
- Slows delivery of visible realism improvements.

### 3. Engineering-Approximate Encounter Modeling

Recommended.

Pros:

- Improves both flyby and capture realism now.
- Fits the current segment-first architecture.
- Gives the frontend authoritative encounter data to render.
- Leaves a clean upgrade path toward stricter future solvers.

Cons:

- Some encounter quantities remain engineered approximations rather than full high-fidelity solutions.
- Requires dual handling of heliocentric and planet-centered samples.

## Architecture

This phase should be organized into four responsibility layers.

### 1. Encounter Geometry Layer

Add a shared geometry builder that interprets the local encounter before a specialized planner takes over.

Responsibilities:

- transform the incoming probe state into a body-relative state
- compute incoming `vInfinity`
- estimate periapsis radius / altitude
- estimate encounter timing inside the body's SOI
- provide a lightweight encounter frame for local sample generation

This layer should not own mission assembly. Its purpose is to make flyby and capture planners speak the same encounter language.

### 2. Dedicated Encounter Planners

Two planners should own the actual encounter-specific outputs:

- `FlybyEncounterPlanner`
- `ArrivalCapturePlanner`

`FlybyEncounterPlanner` should generate:

- a `flybyEncounter` segment
- local planet-centered samples through approach, periapsis, and departure
- encounter events for SOI entry, periapsis, and SOI exit
- outgoing geometry that can seed the next heliocentric boundary state

`ArrivalCapturePlanner` should generate:

- an `arrivalHyperbolicApproach` segment
- an `orbitInsertionBurn` segment
- a post-burn `parkingOrbit` segment
- encounter events for SOI entry, periapsis, insertion burn, and capture establishment

### 3. Mission Assembly Layer

`MissionService` and its segment assembly helpers should remain the orchestrators of the full mission.

Responsibilities:

- determine when a flyby or capture encounter is needed
- pass the correct incoming boundary state into the encounter planners
- splice encounter segments into the global segment sequence
- preserve top-level compatibility fields derived from the segment chain

This keeps planners focused on local physics while mission assembly remains responsible for whole-mission composition.

### 4. Frontend Consumption Layer

The frontend should consume encounter segments as authoritative mission output.

Responsibilities:

- show flyby and capture as explicit scene phases
- render local encounter trajectories from provided segment samples
- surface encounter-specific telemetry in the HUD and timeline
- fall back to current rendering behavior only when new encounter segments are absent

The frontend should not derive encounter physics from top-level approximations once segment data is available.

## Segment Model

This phase should extend the current segment contract rather than replace it.

### New Or Refined Segment Types

Recommended segment sequence for flyby missions:

- `heliocentricCruise`
- `flybyEncounter`
- `heliocentricCruise` or next leg

Recommended segment sequence for arrival missions:

- `heliocentricCruise`
- `arrivalHyperbolicApproach`
- `orbitInsertionBurn`
- `parkingOrbit`

### Segment Shape

Encounter-related segments should continue to use the current mission segment structure:

- `segmentType`
- `startEpoch`
- `endEpoch`
- `initialState`
- `finalState`
- `samples`
- `events`
- `orbitSummary` where appropriate
- `massSummary` where appropriate
- `metadata`

### Reference Frames

The first increment should not force a global sample-frame rewrite.

Instead:

- heliocentric cruise segments keep heliocentric samples
- encounter segments may carry planet-centered inertial samples
- segment boundary states must declare their `referenceFrame` clearly

This lets the system become more realistic locally without destabilizing the broader result model.

## Encounter Metadata

Both flyby and capture encounters should expose structured encounter parameters through `metadata`.

Recommended shared fields:

- `bodyId`
- `encounterType`
- `sphereOfInfluenceRadiusKm`
- `incomingVInfinityKmPerS`
- `periapsisRadiusKm`
- `periapsisAltitudeKm`
- `referenceBodyId`

Recommended flyby-specific fields:

- `outgoingVInfinityKmPerS`
- `turnAngleDeg`
- `bPlaneLike`

Recommended capture-specific fields:

- `insertionDeltaVKmPerS`
- `postCaptureOrbitType`
- `captureAchieved`

`bPlaneLike` should stay intentionally lightweight in this phase. A simple structure such as:

- `btKm`
- `brKm`
- `thetaDeg`

is enough to make the geometry interpretable without committing to a full professional targeting toolchain yet.

## Event Model

The encounter event sequence should become much more explicit.

Recommended flyby events:

- `sphereOfInfluenceEntry`
- `hyperbolicPeriapsis`
- `closestApproach`
- `sphereOfInfluenceExit`

Recommended capture events:

- `sphereOfInfluenceEntry`
- `hyperbolicPeriapsis`
- `orbitInsertionBurnStart`
- `orbitInsertionBurnEnd`
- `captureEstablished`

This event language lets the timeline, HUD, and scene all describe the same mission reality.

## Backend Flow

The backend should adopt a local-encounter enhancement flow rather than a full propagation rewrite.

### 1. Global Mission Propagation

Keep the current heliocentric mission propagation and leg search behavior as the source of global mission context.

Outputs still include:

- launch and escape segments
- cruise segments
- candidate flyby or arrival opportunities
- incoming boundary states for encounters

### 2. Encounter Geometry Build

When the mission reaches a flyby or arrival boundary:

- look up the target body state at encounter time
- convert probe state into the target-centered frame
- compute or estimate encounter geometry
- decide which encounter planner to invoke

### 3. Encounter Segment Generation

The encounter planner should generate local segments and events directly.

For flyby:

- SOI entry to SOI exit should form one coherent encounter segment
- outgoing state should be translated into the next heliocentric continuation state

For capture:

- the hyperbolic arrival should remain distinct from the insertion burn
- the insertion burn should explicitly transition the mission into a bound parking orbit

### 4. Mission Assembly And Compatibility

The mission assembler should then:

- merge encounter segments into the mission sequence
- mirror key encounter outputs into compatibility fields like `flybyEvents`
- expose final mass / propellant continuity where burns are involved
- feed the richer segment chain into timeline generation

## Frontend Behavior

The frontend should become a faithful consumer of encounter mission data.

### 1. Scene Behavior

`SolarSystemScene` should detect encounter segment types and shift its local framing accordingly.

For `flybyEncounter`:

- emphasize inbound path, periapsis, and outbound departure
- make the target body dominate the local scene
- show that the trajectory bends through the encounter rather than simply crossing a marker

For capture:

- show the hyperbolic approach tightening toward periapsis
- highlight the insertion-burn phase explicitly
- transition from approach to a bound orbit without needing synthetic fallback when real local samples are present

### 2. Trajectory Rendering

The scene should distinguish:

- global heliocentric mission trajectory
- local encounter trajectory around the active body

This will make flybys read as deflections and captures read as approach-plus-insertion rather than impact.

### 3. HUD And Timeline

Encounter phases should surface concise but more physical information:

- active encounter body
- active encounter stage
- relevant geometry values such as `vInfinity`, periapsis altitude, turn angle, or insertion delta-v

The timeline should move from coarse arrival/flyby markers to explicit encounter sequences.

## API Compatibility

The current API should remain incrementally adoptable.

Keep existing compatibility fields where they still help current consumers:

- `flybyEvents`
- `closestApproach`
- `finalMassKg`
- `totalPropellantUsedKg`

But once encounter segments are present, new frontend logic should prefer the segment chain over these summary mirrors.

## Testing Strategy

### Backend

- unit tests for shared encounter-geometry calculations
- unit tests for `FlybyEncounterPlanner` outputs
- unit tests for `ArrivalCapturePlanner` outputs
- integration tests ensuring `MissionService` inserts encounter segments in the correct sequence
- timeline tests ensuring encounter events are surfaced in the proper order

### Frontend

- scene helper tests for encounter-segment recognition
- rendering tests that prefer real encounter samples over synthetic fallbacks
- timeline tests for SOI / periapsis / insertion event display
- HUD tests for flyby and capture telemetry presentation

## Phased Delivery

This work is still large enough that implementation should be staged inside the phase.

Recommended internal order:

1. shared encounter geometry helper
2. `FlybyEncounterPlanner` and `flybyEncounter` segment integration
3. upgraded `ArrivalCapturePlanner` with hyperbolic-approach and insertion-burn separation
4. frontend encounter-segment rendering and timeline adoption

This order gives visible realism gains early while keeping the architecture aligned with future low-thrust and plane-change work.

## Future Fit

This phase should deliberately prepare for later physics upgrades.

In particular, the encounter interfaces should remain compatible with future work on:

- continuous low-thrust propagation through approach windows
- more rigorous local event solving
- non-coplanar encounter geometry and plane changes
- moon-system and science-orbit mission expansion

The key success criterion is that after this phase, flyby and capture are no longer treated as decorative mission annotations. They become structured, physically interpretable mission phases inside the simulator's core result model.
