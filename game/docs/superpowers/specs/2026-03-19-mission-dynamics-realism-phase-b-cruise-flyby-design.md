# Mission Dynamics Realism Phase B Cruise And Flyby Design

## Summary

Phase A established `segments` as the backbone of mission playback by modeling Earth departure as:

- `launchParkingOrbit`
- `earthEscape`
- `heliocentricCruise`

Phase B extends that same segment-first architecture into the midcourse mission flow.

The goal is to make cruise corrections and gravity assists affect the actual simulated mission state rather than appearing only as annotations or ranking metadata. This phase should keep the current API-first structure, preserve compatibility with the Phase A UI, and improve realism without forcing a large rewrite of the existing solver stack.

The agreed scope for Phase B is:

- implement both cruise-realism and flyby-realism work in the same phase
- keep UI changes textual and incremental
- continue to use `segments` as the primary contract for new mission-stage data

## Goals

- Turn `heliocentricCruise` into a planner-owned segment rather than a synthetic wrapper around top-level samples.
- Make cruise maneuvers physically effective so they change trajectory, mass, and mission timing consistently.
- Add shared mass-budget continuity across Earth escape, cruise, and flyby transitions.
- Represent gravity assists as standardized mission segments with interpretable geometry outputs.
- Preserve current top-level response fields where needed for backward compatibility.
- Reuse existing summary and timeline UI rather than introducing a new visualization system in this phase.

## Non-Goals

- Full continuous-thrust optimization across the entire mission.
- Full professional B-plane targeting or covariance-level flyby analysis.
- A brand-new flyby visualization mode in the 3D scene.
- Replacing the current mission/tour APIs with a new top-level request format.
- Arrival-capture or science-orbit work; that remains Phase C.

## Recommended Approach

Use the Phase A segment architecture as the organizing principle for all midcourse upgrades.

Instead of adding more top-level fields or separate sidecar outputs for cruise and flyby realism, Phase B should:

1. add dedicated planners for cruise and flyby segments
2. keep `MissionService` focused on assembling a segment sequence
3. derive mission timeline and summary data from those segment results
4. preserve existing top-level fields only as compatibility mirrors

This keeps the system moving toward the long-term segment model while keeping the implementation incremental.

## Alternatives Considered

### 1. Segment-First Midcourse Upgrade

Recommended.

Pros:

- Extends the architecture introduced in Phase A.
- Keeps cruise and flyby logic structurally consistent.
- Makes later Phase C work easier because arrival segments can follow the same pattern.
- Reduces the risk of accumulating more top-level compatibility-only fields.

Cons:

- Requires moderate refactoring in `MissionService`.
- Introduces a little more orchestration work before the first behavior change is visible.

### 2. Cruise Physics First, Segments Later

Pros:

- Fastest path to making maneuvers physically meaningful.
- Could show numerical realism gains quickly.

Cons:

- Would likely require a second refactor to fit the final segment model.
- Keeps flyby outputs and cruise outputs structurally inconsistent for longer.

### 3. Flyby Geometry First, Cruise Later

Pros:

- Quickly improves the interpretability of gravity-assist results.
- Attractive for tour-focused demos.

Cons:

- Leaves single-target cruise behavior lagging behind.
- Delays shared mass-budget continuity and keeps the midcourse architecture split.

## Architecture

Phase B should introduce two new planning units and extend the existing mission assembly flow.

### 1. CruisePlanner

Responsibilities:

- accept a heliocentric boundary state from the previous segment
- generate a real `heliocentricCruise` segment
- incorporate maneuver windows and physically effective corrections
- emit updated samples, maneuver events, warnings, and mass continuity data

This planner replaces the current synthetic cruise-segment assembly inside `MissionService`.

### 2. FlybyPlanner

Responsibilities:

- convert flyby feasibility/ranking outputs into standardized `gravityAssistFlyby` mission segments
- expose interpretable geometry values
- provide clear segment events for approach, periapsis, and departure
- prepare the output shape for future B-plane expansion without requiring full B-plane implementation now

### 3. MissionService Assembler Extension

`MissionService` should continue to orchestrate the full mission, but its role should narrow to:

- determine which segment sequence applies
- pass boundary states from one segment to the next
- accumulate mission-level samples, metrics, and compatibility fields
- forward merged segment events into timeline generation

### 4. Timeline And Summary Reuse

The existing timeline and summary UI should remain the consumer surface for this phase.

Instead of building new views, Phase B should feed:

- current cruise/flyby segment names
- maneuver counts and delta-v totals
- propellant usage summaries
- flyby geometry text

into existing textual HUD and summary components.

## Data Model

Phase B should continue to use `MissionSegment` as the main extensible contract.

### MissionSegment Additions

Every segment should support:

- `segmentType`
- `startEpoch`
- `endEpoch`
- `initialState`
- `finalState`
- `samples`
- `events`
- `warnings`
- `metadata`

Phase B should add optional `massSummary` for segments where mass changes matter:

- `massBeforeKg`
- `massAfterKg`
- `propellantUsedKg`

### Cruise Segment Metadata

For `heliocentricCruise`, `metadata` should include:

- `targetBody`
- `deltaVTotalKmPerS`
- `maneuverCount`
- `maneuverStrategy`
- `closestApproachEstimateKm`

### Flyby Segment Metadata

For `gravityAssistFlyby`, `metadata` should include:

- `bodyId`
- `periapsisAltitudeKm`
- `turnAngleDeg`
- `inboundVInfinityKmPerS`
- `outboundVInfinityKmPerS`
- `bPlaneLike`

`bPlaneLike` is intentionally lightweight in this phase. It should be a simple extensible object such as:

- `btKm`
- `brKm`
- `thetaDeg`

This gives the simulator interpretable geometry now without committing to a full professional targeting workflow yet.

## API Shape

The public API should remain backward-compatible.

### Keep Existing Top-Level Fields

Continue to return:

- `maneuverEvents`
- `flybyEvents`
- `finalMassKg`
- `totalPropellantUsedKg`

These should become compatibility mirrors derived from the segment chain where possible.

### Extend Segment Coverage

Mission responses should now be able to include:

- `launchParkingOrbit`
- `earthEscape`
- `heliocentricCruise`
- `gravityAssistFlyby`

Tour-candidate outputs do not need a complete segment chain in the first Phase B increment, but the active mission result should support it cleanly.

## Segment Definitions

### 1. Heliocentric Cruise

Phase B cruise behavior should:

- own the cruise samples directly
- apply maneuver effects to velocity and mass
- preserve continuity from Earth escape to later midcourse states
- emit explicit maneuver-related events and diagnostics

Acceptance threshold:

- cruise maneuvers must affect real state, not only labels
- `samples[].massKg`, `finalMassKg`, and `totalPropellantUsedKg` must agree

### 2. Gravity-Assist Flyby

Phase B flyby behavior should:

- standardize flyby outputs as a mission segment
- expose periapsis altitude and turn-angle style geometry
- produce approach/periapsis/departure events for timeline use
- remain compatible with current tour ranking outputs

Acceptance threshold:

- flyby segments should explain why the assist is useful, not only that it exists

## UI Scope

The user requested a textual, low-risk UI integration for this phase.

Phase B frontend work should therefore be limited to:

- showing cruise and flyby segment labels in summary and HUD
- showing maneuver count, delta-v total, and propellant usage in textual cards
- showing flyby body and key geometry values in textual summary output

Out of scope for this phase:

- new 3D flyby overlays
- new camera modes
- new dedicated mission-analysis panels

## Implementation Strategy

Phase B should be delivered in four batches.

### Batch 1: Planner-Owned Cruise Segment

- extract synthetic cruise assembly into `CruisePlanner`
- keep behavior as close as possible to current outputs at first
- establish planner boundaries before changing physics

### Batch 2: Physically Effective Cruise Maneuvers

- make maneuver events affect propagated state and mass
- verify mass continuity and mission-level mass summaries
- extend timeline support for cruise maneuver phases

### Batch 3: Standardized Flyby Segments

- add `FlybyPlanner`
- normalize flyby geometry outputs into mission segments
- preserve current `flybyEvents` compatibility outputs

### Batch 4: Minimal Frontend Integration

- update summary and scene text to show new cruise/flyby details
- avoid any new heavy visualization layer

## Testing Strategy

Phase B should add or extend tests at five levels.

### 1. Planner Unit Tests

- `CruisePlanner`
- `FlybyPlanner`
- mass continuity helpers
- segment serialization helpers

### 2. MissionService Integration Tests

- direct mission produces planner-owned cruise segment
- assist mission produces flyby segment
- segment ordering stays deterministic

### 3. API Tests

- `POST /missions/propagate` returns cruise mass/segment data
- `POST /missions/plan-tour` returns flyby geometry fields where applicable
- timeline includes cruise/flyby boundary events

### 4. Frontend Tests

- app-level tests for segment labels and textual flyby/cruise data
- summary-component tests for maneuver/flyby text rendering

### 5. Regression Tests

Must preserve:

- Phase A Earth departure behavior
- deterministic candidate ranking
- existing direct mission flows
- existing capture-orbit behavior

## Acceptance Criteria

Phase B is successful when:

1. cruise maneuvers change mission state and mass consistently
2. `heliocentricCruise` is produced by a dedicated planner rather than a synthetic wrapper
3. gravity assists can be returned as standardized mission segments
4. flyby geometry outputs are readable and useful to users
5. mission timeline and summary UI show cruise/flyby text without needing new view modes
6. Phase A departure realism and existing direct/tour flows still pass regression tests

## Risks And Mitigations

### Risk: Cruise physics and flyby geometry together make the phase too large

Mitigation:

- enforce the four-batch rollout
- keep frontend scope textual
- preserve compatibility fields until the segment chain is stable

### Risk: MissionService orchestration becomes harder to reason about

Mitigation:

- move segment ownership into planners
- keep `MissionService` focused on sequencing and aggregation

### Risk: Tour outputs drift from direct-mission outputs

Mitigation:

- standardize segment shapes across both paths
- keep regression checks for deterministic ranking and compatibility fields

## Deliverable Summary

At the end of Phase B, the simulator should still feel like the same project, but the midcourse mission flow should be meaningfully more physical and more interpretable:

- cruise is a real segment with real maneuver effects
- flybys are readable mission segments with geometry
- mission mass is continuous through the middle of the mission
- the existing textual UI can explain what happened without new heavy views
