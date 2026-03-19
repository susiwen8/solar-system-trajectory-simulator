# Mission Dynamics Realism Upgrade Design

## Summary

This spec upgrades the simulator from a primarily heliocentric trajectory propagator into a staged deep-space mission simulator with more realistic mission dynamics.

The goal is not to turn the project into a full GMAT- or MONTE-class mission-analysis platform in one step. The goal is to make the mission flow feel physically and operationally plausible by modeling the major dynamics segments that real interplanetary missions pass through:

- launch parking orbit
- Earth escape
- deep-space cruise
- gravity-assist geometry
- arrival capture
- science orbit operations

The key design decision is to model missions as an ordered chain of mission segments rather than continuing to add more optional fields and special cases to a single propagation path. Each segment should produce its own boundary state, events, trajectory samples, and constraints, and the simulator should assemble those segment results into one coherent mission timeline and playback experience.

## Goals

- Make mission start conditions more realistic by replacing direct heliocentric departure with parking-orbit and Earth-escape modeling.
- Make cruise maneuvers physically meaningful so they alter trajectory, mass, and timing rather than appearing only as labels.
- Make gravity-assist events easier to interpret by exposing flyby geometry targets rather than only ranked sequence outputs.
- Make arrival feel like a full mission phase with capture, trimming, and science-orbit design.
- Preserve the current API-first architecture while introducing better internal boundaries.
- Keep the design compatible with existing timeline playback, capture-orbit UI, and tour planning features.

## Non-Goals

- Full launch vehicle ascent simulation through atmosphere.
- High-fidelity attitude, control, or thermal modeling.
- Full ephemeris and frame-system parity with professional flight-dynamics software.
- Complete low-thrust global optimization across the whole mission.
- Lunar, moon-tour, or small-body navigation in the first iteration.

## Recommended Approach

Adopt a mission-segment architecture.

Instead of treating the entire mission as one propagation with optional enhancements, define a small set of segment types, each with a clear responsibility and contract:

1. build a segment input from mission intent and prior segment output
2. solve that segment with the appropriate dynamics/planning logic
3. emit a normalized segment result
4. stitch segment results into a full-mission response

This approach fits the existing product better than a monolithic mission solver because the project already has many segment-like concepts:

- transfer planning
- finite-thrust maneuver planning
- flyby feasibility evaluation
- capture orbit planning
- mission timeline generation

The current problem is not lack of core primitives. The problem is that those primitives are attached inconsistently to the top-level mission flow. A segment model fixes that while preserving the existing investment.

## Alternatives Considered

### 1. Segment-Based Mission Model

Recommended.

Pros:

- Matches how real missions are reasoned about.
- Creates stable internal boundaries.
- Makes timeline generation more natural.
- Supports incremental rollout.
- Works for both direct missions and tours.

Cons:

- Requires restructuring the current mission service layer.
- Adds some coordination overhead between segments.

### 2. Keep A Single Propagation Pipeline And Add More Flags

Pros:

- Smallest short-term implementation cost.
- Reuses the current API shape almost entirely.

Cons:

- Continues to couple unrelated mission stages.
- Makes tour, capture, and finite-thrust interactions harder to reason about.
- Increases risk of returning internally inconsistent results.

### 3. Build A General Mission Analysis Platform First

Pros:

- Strong long-term technical foundation.
- Could support many future mission types cleanly.

Cons:

- Too large for the next product step.
- Delays user-visible realism improvements.
- Risks overbuilding before the simulator proves which workflows matter most.

## Architecture

The first version of the realism upgrade should be split into four layers.

### 1. Mission Profile Layer

This layer captures mission intent at a higher level than the current propagation request.

Suggested fields:

- `departureBody`
- `targetBody`
- `launchEpoch`
- `missionMode`
- `launchProfile`
- `cruiseProfile`
- `flybyProfile`
- `arrivalProfile`
- `scienceOrbitProfile`

The important change is that mission inputs should describe what kind of mission the user wants, not only the immediate initial state vector.

### 2. Segment Planners

Each mission segment gets its own planner with one clear purpose.

Recommended first set:

- `ParkingOrbitPlanner`
- `EarthEscapePlanner`
- `CruisePlanner`
- `FlybyPlanner`
- `ArrivalCapturePlanner`
- `ScienceOrbitPlanner`

Each planner should accept a normalized segment input and return a normalized segment result.

### 3. Mission Assembler

This layer is responsible for:

- selecting which segment sequence applies to the requested mission
- feeding boundary states from one segment into the next
- collecting segment samples and events
- producing full-mission metrics and timeline data

This should become the top-level orchestrator that replaces most of the current `MissionService` branching logic.

### 4. Shared Dynamics Core

The lower-level dynamics code remains reusable infrastructure:

- propagator
- Lambert solver
- flyby evaluator
- thrust helpers
- capture-orbit logic
- ephemeris access

These modules should not own mission sequencing. They should remain segment-level tools.

## Mission Segment Model

All segments should return a common structure.

Suggested `MissionSegmentResult` fields:

- `segmentType`
- `referenceFrame`
- `startEpoch`
- `endEpoch`
- `initialState`
- `finalState`
- `samples`
- `events`
- `warnings`
- `massSummary`
- `metadata`

This common model matters because timeline generation, frontend playback, and test coverage should not need special-case logic for each segment type.

## Segment Definitions

### 1. Launch Parking Orbit

This segment models insertion into an initial parking orbit around Earth rather than starting immediately in heliocentric transfer.

Version-1 responsibilities:

- define a simple parking-orbit state
- expose periapsis, apoapsis, inclination, and period
- model a short staging window before escape

Version-1 simplification:

- do not model full atmospheric ascent or staging physics
- begin at a post-insertion Earth-centered orbit state

### 2. Earth Escape

This segment models the transition from Earth-centered parking orbit to heliocentric transfer.

Responsibilities:

- apply escape burn or equivalent departure impulse
- propagate through Earth-centered escape conditions
- detect Earth sphere-of-influence exit
- convert to heliocentric state for downstream segments

This segment is the most important realism upgrade because it replaces the current direct heliocentric departure assumption.

### 3. Deep-Space Cruise

This segment covers interplanetary propagation between major mission events.

Responsibilities:

- propagate in heliocentric frame
- plan and execute TCM/DSM events
- update mass consistently with the propagator
- emit cruise diagnostics and encounter approach data

The first version should make cruise maneuvers physically effective, not only descriptive.

### 4. Gravity-Assist Geometry

This segment formalizes flyby modeling around a body used for trajectory shaping.

Responsibilities:

- represent flyby geometry with explicit targeting metadata
- expose approach and departure asymptotes
- prepare for later B-plane support
- produce event-level outputs that explain why a flyby candidate is attractive or infeasible

The first implementation does not need a full professional B-plane workflow, but it should introduce data structures that make such a workflow possible.

### 5. Arrival Capture

This segment models arrival into the target-body environment.

Responsibilities:

- represent target-relative arrival state
- estimate capture burn
- generate an initial captured orbit
- support follow-up trim maneuvers

This segment should absorb and generalize the current capture-orbit behavior.

### 6. Science Orbit

This segment represents the stable orbit or observation geometry used for mission operations after arrival.

Responsibilities:

- define the target science orbit
- emit orbit period and geometry metrics
- identify the start of science operations
- support later attachment of observation-window and downlink logic

## Data Flow

The end-to-end flow should look like this:

1. User submits a mission profile.
2. The mission assembler selects the required segment sequence.
3. `ParkingOrbitPlanner` creates an Earth-centered initial orbit.
4. `EarthEscapePlanner` converts that orbit into a heliocentric departure state.
5. `CruisePlanner` propagates and applies cruise maneuvers.
6. Optional `FlybyPlanner` segments refine geometry for each assist.
7. `ArrivalCapturePlanner` produces target capture state and burns.
8. `ScienceOrbitPlanner` generates the post-arrival mission state.
9. The assembler concatenates segment outputs into mission-level `samples`, `events`, `warnings`, and `missionTimeline`.

## API Shape

The simulator should keep `POST /missions/propagate` as the primary entry point in the first implementation.

Recommended response additions:

- `segments`
- `missionProfile`
- `boundaryStates`

Recommended request additions:

- `launchProfile`
- `cruiseProfile`
- `arrivalProfile`
- `scienceOrbitProfile`

Backward compatibility guidance:

- keep the current request shape working
- map old requests into a default mission profile internally
- gradually expose more realistic mission options without breaking the current demo flow

## Frontend Changes

The frontend should remain familiar, but it should become more segment-aware.

### Mission Setup

Add controls for:

- parking orbit mode
- Earth escape strategy
- cruise maneuver strategy
- arrival mode
- science orbit goal

The first version should keep these controls intentionally compact. The objective is realism, not overwhelming the user with flight-dynamics jargon.

### Playback UI

Use the new segment model to render:

- current mission segment
- current reference frame
- active maneuver or encounter
- boundary transitions such as Earth escape or target capture

### Visualization

The scene should support switching between:

- Earth-centered parking-orbit/escape view
- heliocentric cruise view
- target-centered arrival/science-orbit view

This is more valuable than adding many new controls because it makes the realism visible.

## Validation Strategy

The realism upgrade should be judged by consistency as much as by added features.

At minimum, add automated validation for:

- parking-orbit state generation
- Earth SOI exit event detection
- continuity of state between segments
- consistency between planned maneuvers and mass depletion
- consistency between capture outputs and science-orbit inputs
- timeline correctness when multiple segment types are present

Regression checks should verify that:

- old direct Earth-to-target flows still work
- tour candidates still rank deterministically
- capture missions still render correctly

## Rollout Plan

### Phase A: Earth Departure Realism

Deliver:

- parking-orbit segment
- Earth-escape segment
- Earth-centered to heliocentric boundary handoff
- timeline updates for launch and escape

Primary outcome:

- the mission no longer begins as an already-formed heliocentric transfer.

### Phase B: Cruise And Flyby Realism

Deliver:

- physically effective cruise maneuvers
- shared mass-budget enforcement
- improved flyby geometry outputs
- segment-aware cruise and flyby timelines

Primary outcome:

- midcourse operations and assists affect the actual mission state rather than only annotations.

### Phase C: Arrival And Science-Orbit Realism

Deliver:

- generalized arrival-capture segment
- science-orbit segment
- trim-burn integration
- target-centered operations playback

Primary outcome:

- arrival becomes a full mission phase instead of a single derived add-on.

## Acceptance Criteria

This effort should be considered successful when:

1. Direct missions can begin from a parking orbit and transition through Earth escape.
2. Cruise maneuvers change both trajectory and mass consistently.
3. Gravity-assist outputs expose interpretable geometry data.
4. Capture missions return segment-aware arrival and science-orbit data.
5. Full-mission playback can show segment transitions across departure, cruise, flyby, and arrival phases.
6. Existing mission timeline and summary UI continue to function on top of the upgraded model.

## Future Extensions

Once the segment model is in place, the following become much more natural:

- moon and moon-tour support
- small-body rendezvous
- better B-plane targeting
- solar-radiation-pressure perturbations
- higher-fidelity frame and time-system handling
- resource and communications overlays on top of the same mission segments
