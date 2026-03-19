# Mission Phase Timeline Design

## Summary

This spec adds a mission-phase timeline system on top of the existing solar-system trajectory simulator so missions feel more like real deep-space exploration programs and less like raw trajectory playback.

The first version will infer a realistic mission timeline from existing mission outputs, including:

- launch
- Earth escape
- deep-space cruise
- finite-thrust correction maneuvers
- gravity-assist flybys
- target approach
- arrival pass or insertion
- science operations
- downlink windows

The design is intentionally event-driven. Instead of introducing a rigid hand-authored state machine for every mission type, the backend will extract mission events from existing trajectory, maneuver, flyby, closest-approach, and tour data, then assemble those events into contiguous mission phases. The frontend will render those phases as a mission HUD and a segmented timeline synchronized with playback.

## Goals

- Make mission playback feel like a real exploration program with recognizable stages.
- Reuse the current astrodynamics pipeline instead of inventing a parallel mission engine.
- Support both single-target missions and multi-planet tours.
- Keep the model extensible so later resource, comms, and science systems can attach to the same mission timeline.

## Non-Goals

- Full spacecraft operations simulation.
- High-fidelity attitude/GNC state machines.
- Real communications geometry or DSN scheduling in the first version.
- True orbit insertion optimization for every arrival case.

## Recommended Approach

Use an event-driven mission timeline:

1. Extract mission events from existing results.
2. Build mission phases by grouping and filling intervals between events.
3. Return a normalized mission timeline object from the backend.
4. Drive a timeline HUD and playback overlays from that object on the frontend.

This approach fits the current architecture best because the simulator already returns rich event-like data:

- `samples`
- `maneuverEvents`
- `flybyEvents`
- `visitEvents`
- `closestApproach`
- mission launch and arrival epochs

## Alternatives Considered

### 1. Event-Driven Timeline Builder

Recommended.

Pros:

- Fits current data model.
- Easier to extend incrementally.
- Works well for playback and HUD visualization.
- Handles single-target and tour missions with one model.

Cons:

- Some early phases rely on heuristic boundaries.

### 2. Explicit Finite State Machine

Pros:

- Very clear state transitions.

Cons:

- Too rigid for varied mission shapes.
- Harder to adapt to tours and mixed flyby/visit missions.

### 3. Rule Engine Only

Pros:

- Flexible and expressive.

Cons:

- Harder to reason about.
- Less transparent as a first implementation.

## Architecture

The first version should be split into four layers.

### 1. Mission Event Extractor

The backend derives normalized mission events from current mission results.

Candidate event types:

- `launch`
- `earthEscape`
- `maneuver`
- `flyby`
- `targetApproach`
- `arrivalPass`
- `arrivalInsertion`
- `scienceWindowStart`
- `scienceWindowEnd`
- `downlinkWindowStart`
- `downlinkWindowEnd`
- `missionComplete`

Each event should include:

- `type`
- `epoch`
- `title`
- `description`
- `relatedBody`
- optional mission metadata such as maneuver type or flyby altitude

### 2. Mission Phase Builder

The phase builder turns discrete events into continuous mission phases.

Each phase should contain:

- `type`
- `startEpoch`
- `endEpoch`
- `title`
- `description`
- `relatedBody`
- `eventIds`

Primary phase types for the first version:

- `launch`
- `earthEscape`
- `deepSpaceCruise`
- `maneuverExecution`
- `gravityAssistFlyby`
- `targetApproach`
- `arrivalPass`
- `arrivalInsertion`
- `scienceOperations`
- `downlink`

### 3. Mission Timeline Model

Mission responses should expose a normalized timeline object:

```json
{
  "missionTimeline": {
    "events": [],
    "phases": [],
    "currentObjective": "Arrive at Saturn",
    "missionStartEpoch": "2026-01-01T00:00:00Z",
    "missionEndEpoch": "2027-09-03T12:00:00Z"
  }
}
```

This should be added to:

- single mission propagation results
- gravity-assist mission results
- multi-planet tour candidates

### 4. Playback HUD

The frontend consumes the mission timeline to render:

- current mission phase
- next mission event
- segmented phase timeline
- event overlays synchronized with playback

## Phase Set for Version 1

The first version uses this fixed phase vocabulary.

### Launch

From mission start through the initial departure segment.

### Earth Escape

From post-launch departure until the spacecraft exits the Earth-centered departure context and fully transitions into interplanetary flight.

### Deep-Space Cruise

Long coasting periods between major mission events.

### Maneuver Execution

Finite-thrust corrections such as TCM, DSM, and arrival correction.

### Gravity-Assist Flyby

Close approach and assist passage near a non-target body used for trajectory shaping.

### Target Approach

The period leading into target encounter.

### Arrival Pass or Insertion

`arrivalPass` for flyby missions or when capture is not yet modeled.

`arrivalInsertion` for future captured-orbit mission types.

### Science Operations

A heuristic observation window near the primary target encounter.

### Downlink

A heuristic post-observation data return window.

## Phase Inference Rules

The first version should infer phases from existing mission outputs using deterministic rules.

### Launch

Starts at `launchEpoch`.

Ends before Earth escape begins. Initially this can be a short fixed-duration window unless a better departure event exists.

### Earth Escape

Starts immediately after launch.

Ends at the Earth sphere-of-influence exit estimate.

### Maneuver Execution

Derived directly from `maneuverEvents`.

Each maneuver becomes a bounded phase based on:

- `startEpoch`
- `durationSeconds`

### Gravity-Assist Flyby

Derived directly from `flybyEvents`.

Each flyby phase should occupy a compact window around the flyby epoch.

### Deep-Space Cruise

Auto-filled between:

- Earth escape and first maneuver/flyby/approach
- any two major events not otherwise covered
- final downlink and mission completion if applicable

### Target Approach

Begins when the spacecraft is within a configurable target-distance threshold or a configurable time-before-closest-approach threshold.

Thresholds should be body-aware in later revisions. Version 1 may start with a time-based approximation.

### Arrival Pass / Insertion

Determined around the encounter epoch.

If no explicit capture model exists, default to `arrivalPass`.

### Science Operations

Generated as a configurable window centered on the main target encounter.

For tours, this window can repeat per required visit body.

### Downlink

Generated as a post-science window.

Version 1 can approximate this with a rule-based duration after each science window.

## Data Model

### MissionTimelineEvent

```json
{
  "id": "event-001",
  "type": "maneuver",
  "epoch": "2026-04-03T12:00:00Z",
  "title": "DSM",
  "description": "Deep-space correction burn",
  "relatedBody": "jupiter"
}
```

### MissionPhase

```json
{
  "id": "phase-004",
  "type": "deepSpaceCruise",
  "startEpoch": "2026-02-01T00:00:00Z",
  "endEpoch": "2026-06-15T00:00:00Z",
  "title": "Deep-Space Cruise",
  "description": "Cruising toward Jupiter encounter",
  "relatedBody": "jupiter",
  "eventIds": ["event-001", "event-002"]
}
```

### MissionTimeline

```json
{
  "events": [],
  "phases": [],
  "currentObjective": "Prepare for Jupiter gravity assist",
  "missionStartEpoch": "2026-01-01T00:00:00Z",
  "missionEndEpoch": "2027-09-03T12:00:00Z"
}
```

## Backend Changes

### Single-Target Missions

Extend mission propagation results to include `missionTimeline`.

### Gravity-Assist Missions

Generate mission timelines using:

- baseline mission events
- flyby events
- maneuver events
- target encounter information

### Multi-Planet Tours

Each candidate should include its own `missionTimeline`.

Tour timelines should distinguish:

- required visit bodies
- assist-only flybys

## Frontend Changes

### Current Phase HUD

Add a panel showing:

- current phase name
- phase description
- current objective
- related body

### Next Event HUD

Show the next upcoming mission event and time remaining.

Examples:

- `DSM in 3.2 days`
- `Jupiter flyby in 12.5 days`
- `Science window opens in 1.8 days`

### Segmented Timeline

Add a colored bar aligned with playback where each color block represents one mission phase.

Playback should highlight:

- current phase
- current event position

### Event Markers

Extend scene overlays to distinguish:

- maneuver markers
- flyby markers
- visit markers
- science window markers
- downlink window markers

## Error Handling

If a mission does not contain enough data to infer a phase cleanly:

- omit the unsupported phase
- preserve known events
- never fail the full mission response just because the timeline is partial

If phase boundaries overlap unexpectedly:

- prefer maneuver and flyby phases over cruise filler phases
- normalize the final list so the timeline remains ordered and non-overlapping

## Testing Strategy

### Backend

Add unit tests for:

- event extraction from single-target missions
- event extraction from tour candidates
- phase ordering
- non-overlapping phase normalization
- correct inclusion of maneuver and flyby phases

Add API tests asserting mission responses include `missionTimeline`.

### Frontend

Add tests for:

- current phase HUD rendering
- next event rendering
- segmented timeline rendering
- playback synchronization with mission phases
- tour candidate phase switching

## Rollout Plan

### Stage A

Backend event extractor.

### Stage B

Backend phase builder and response shape.

### Stage C

Frontend phase HUD and next-event panel.

### Stage D

Frontend segmented timeline and tour compatibility.

## Acceptance Criteria

- Single-target missions return mission phases.
- Tour candidates return mission phases.
- Playback shows current phase and next event.
- Timeline segments align with maneuver and flyby events.
- Phase order is deterministic and validated by automated tests.
