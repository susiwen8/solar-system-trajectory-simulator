# Launch Window Optimization Design

## Summary

The simulator currently treats `launchEpoch` as a direct user input for both single-target missions and multi-planet tours. That is convenient, but it does not match how real mission design works.

Real missions first search for a viable launch window:

- planetary geometry determines when departure is efficient
- nearby dates often form a usable window, not a single best instant
- multi-planet tours must optimize the first departure date against the whole downstream sequence

The agreed direction is:

- support launch-window search for both single-target and tour missions
- default the product to a recommended-window workflow
- keep manual date entry available
- rank candidate dates with `Delta-v` first, flight time second, and mission complexity as an added penalty
- use an adaptive search horizon: inner planets 2 years, outer planets and tours 5 years

## Goals

- Add realistic launch-window search ahead of mission execution.
- Return both a recommended date and a recommended window.
- Support three UI modes:
  - recommended window
  - choose within the window
  - full manual override
- Reuse existing transfer and tour planners instead of replacing them.
- Keep the existing propagation endpoints working with a final concrete `launchEpoch`.

## Non-Goals

- A full porkchop plot UI.
- Launch-vehicle, pad, range, or weather constraints.
- Re-optimizing every later flyby epoch directly in the UI.
- Replacing the current mission propagation contract.

## Recommended Approach

Add a dedicated backend launch-window search layer that runs before the existing planners.

This layer should:

1. choose a search horizon from the mission profile
2. sample candidate departure dates in that horizon
3. evaluate each date by calling the current planner
4. refine the best local minima
5. build a viable window around the best date

This is better than silently overriding `launchEpoch` because the UI needs visible, explainable launch-window data.

## Alternatives Considered

### 1. Silent Backend Override

The backend would ignore the submitted date and choose one internally.

Pros:

- minimal UI work

Cons:

- not transparent
- incompatible with window-mode UX
- hard to debug and trust

### 2. Dedicated Launch-Window Search Layer

Recommended.

Pros:

- clean separation of responsibilities
- reusable for single-target and tour missions
- easy to expose in the UI

Cons:

- adds a new service and response model

### 3. Frontend-Only Recommendation

Pros:

- quick to mock up

Cons:

- not physically trustworthy
- duplicates mission logic outside the backend

## Architecture

### LaunchWindowSearchService

Add a backend service responsible for:

- selecting search horizon and cadence
- evaluating candidate dates
- refining the best minima
- constructing the recommended launch window
- returning structured candidate data

Recommended name:

- `LaunchWindowSearchService`

### Mission Evaluators

The service should use two evaluator paths.

Single-target evaluation:

- call `TransferPlanner.plan_auto_transfer(...)`
- score using `delta_v_km_per_s`, `duration_seconds`, and miss distance

Tour evaluation:

- call `MissionTourPlanner.plan_tour(...)`
- score using total `Delta-v`, total flight time, flyby count, repeated visits, and the current tour score philosophy

### Existing Execution Layer

Existing endpoints still execute missions using a final concrete date:

- `POST /missions/propagate`
- `POST /missions/plan-tour`

The launch-window feature should produce the final `launchEpoch` first, then reuse these endpoints.

### Frontend Setup Layer

The mission form should shift from direct date entry to launch planning with three modes:

- `recommendedWindow`
- `windowSelect`
- `manual`

## Search Model

### Search Horizon

Recommended defaults:

- inner-planet single-target missions: next 2 years
- outer-planet single-target missions: next 5 years
- multi-planet tours: next 5 years

### Search Anchor

Add an `earliestLaunchEpoch` request field.

Behavior:

- if provided, search forward from that instant
- if omitted, use a deterministic backend default for stable demos and tests

### Search Strategy

Use a two-stage search:

1. coarse search
   - sample at a multi-day cadence
   - identify a few best local minima
2. fine search
   - refine those minima with a smaller cadence
   - choose the final best date

Suggested defaults:

- coarse cadence: 5 to 10 days
- fine cadence: 0.5 to 1 day

### Window Construction

The recommended window should not be a fixed-width range.

Instead:

- start from the best date
- extend outward while candidate scores stay within a configured tolerance
- stop when score degradation exceeds that tolerance or feasibility breaks

This allows naturally narrower or wider windows depending on mission geometry.

## Scoring Model

Use one weighted score shape for both mission types:

- primary term: total `Delta-v`
- secondary term: total flight time
- complexity penalty:
  - flyby count
  - repeated visits
  - very long duration
  - miss distance for single-target plans

Recommended form:

- `score = dv_weight * delta_v + time_weight * duration + complexity_penalty`

`Delta-v` must remain the dominant term.

## API Design

Add a new endpoint:

- `POST /missions/launch-window`

### Request

Support both mission types with a shared shape:

- `missionType: "trajectory" | "tour"`
- `departureBody`
- `targetBody` for trajectory mode
- `requiredVisitBodies` for tour mode
- `earliestLaunchEpoch`
- optional `propulsionConfig`

### Response

Recommended top-level fields:

- `recommendedLaunchEpoch`
- `windowStartEpoch`
- `windowEndEpoch`
- `candidateLaunches`
- `searchSummary`
- `warnings`

Each `candidateLaunches` item should include:

- `launchEpoch`
- `score`
- `deltaVKmPerS`
- `flightTimeSeconds`
- `targetBody` or `visitOrder`
- `fullSequenceBodies` when applicable

`searchSummary` should include:

- `searchStartEpoch`
- `searchEndEpoch`
- `coarseSampleCount`
- `refinedCandidateCount`
- `scoringMode`

## Frontend Design

The mission form should present launch planning as a first-class control.

Default mode:

- recommended window

Visible data:

- recommended window range
- best launch date
- expected `Delta-v`
- expected flight time
- recommended visit order and full sequence for tours

Submit behavior:

1. user configures mission targets
2. frontend requests `/missions/launch-window`
3. user keeps the recommendation, selects inside the window, or switches to manual
4. frontend submits the final effective `launchEpoch` to the existing execution endpoint

## Error Handling

- If no feasible window exists, return an explicit failure or warning state.
- If only poor windows exist, return the best one with warnings.
- If tour search is expensive, limit sample density and only refine the best few minima.

## Testing Strategy

Backend unit tests:

- adaptive search horizon selection
- refinement finds a better date than a naive baseline
- window construction around the best date
- single-target window result shape
- tour window result shape

API tests:

- `POST /missions/launch-window` for trajectory missions
- `POST /missions/launch-window` for tour missions
- warnings for poor or missing windows

Frontend tests:

- default recommended-window mode
- rendering recommended window data
- selecting a date within the window
- switching to manual mode
- submitting the correct final `launchEpoch`

## Delivery Phases

### Phase 1

- single-target backend launch-window search
- new launch-window endpoint for trajectory missions
- frontend recommended-window flow for single-target missions

### Phase 2

- extend launch-window search to tours
- add recommended visit-order display
- wire tour execution to the selected launch date

### Phase 3

- tune scoring constants
- improve explanations and warnings
- optionally add richer visual exploration later

## Recommendation

Proceed with a dedicated launch-window planning service and endpoint.

Default the simulator to recommended-window planning, keep window-internal selection available, and preserve a full manual override mode. This gives the project a much more realistic mission-design workflow without destabilizing the current propagation, segment, and 3D scene systems.
