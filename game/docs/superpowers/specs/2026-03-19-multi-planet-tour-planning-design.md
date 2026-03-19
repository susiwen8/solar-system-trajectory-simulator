# Multi-Planet Tour Planning Design

Date: 2026-03-19
Status: Draft approved in conversation, pending written review

## Summary

Extend the current solar-system trajectory simulator from single-target mission planning into a multi-planet tour planner.

The new capability should allow a user to:

- specify a set of planets that must be visited
- let the system decide the best visit order automatically
- allow extra gravity-assist flybys beyond the required visit set
- rank complete mission tours by a combined score
- inspect the best mission tours in the existing 3D playback interface

The first implementation should optimize over both visit-order permutations and optional assist insertions at the same time, while using strong pruning to keep the search tractable.

## Goals

- Support user-defined required visit sets rather than a single final target
- Automatically choose the visit order instead of requiring the user to specify it
- Allow additional assist bodies between required visits
- Support repeated flybys when they improve the mission score
- Optimize using a combined score that balances fuel, time, and mission complexity
- Reuse the current Lambert, flyby-feasibility, and trajectory playback stack
- Return multiple ranked full-mission candidates rather than a single answer

## Non-Goals For Phase 1

- Unlimited number of required visit planets
- Unlimited extra assists per leg
- Full continuous global optimization over every timing and flyby variable at once
- Low-thrust mission design
- Moon and major-satellite tour planning
- Operational mission-design fidelity equal to GMAT, MONTE, or MALTO
- Launch-vehicle, parking-orbit, or atmospheric entry modeling

## Product Scope

The first version should support the following user workflow:

1. The user chooses Earth as the departure body.
2. The user provides a list of planets that must be visited.
3. The backend searches over both visit order and optional assist bodies.
4. The backend returns a ranked list of full mission-tour candidates.
5. The user selects a candidate and inspects the entire mission in the existing 3D view.

The product should distinguish between:

- required visits, where the mission is considered to formally visit a planet
- assist flybys, where a planet is used only as a gravity-assist body

## Recommended Architecture

The first implementation should add five layers on top of the current gravity-assist stack.

### 1. Visit Sequence Generator

Responsibilities:

- generate candidate visit-order permutations for the required visit set
- support automatic ordering rather than user-supplied ordering
- attach coarse heuristics to each ordering so weak candidates can be pruned early

Example:

- user-required visits: `Venus, Jupiter, Saturn`
- sequence candidates:
  - `Earth -> Venus -> Jupiter -> Saturn`
  - `Earth -> Jupiter -> Venus -> Saturn`
  - `Earth -> Venus -> Saturn -> Jupiter`

### 2. Assist-Expanded Leg Search

Responsibilities:

- search each required leg while optionally inserting assist bodies
- reuse the current Lambert and flyby-feasibility solvers for sub-legs
- support direct, one-assist, and two-assist variants for each required leg

Example:

- required leg: `Venus -> Jupiter`
- subpath candidates:
  - `Venus -> Jupiter`
  - `Venus -> Earth -> Jupiter`
  - `Venus -> Mars -> Jupiter`
  - `Venus -> Earth -> Mars -> Jupiter`

### 3. Joint Mission Assembler

Responsibilities:

- combine visit-order candidates with per-leg assist-expanded candidates
- build complete mission tours rather than isolated leg solutions
- preserve clear semantics for required visits versus assist flybys

### 4. Global Mission Scorer

Responsibilities:

- compute total mission cost across the full tour
- score the mission using total delta-v, total duration, flyby count, and repeated-body complexity
- keep the top ranked full-mission candidates for refinement and UI display

### 5. Mission Playback Model

Responsibilities:

- expose complete event chains to the frontend
- distinguish required visit events from flyby events
- return trajectory samples that support whole-mission playback in the existing Three.js scene

## Search Strategy

The system should use a staged search, but unlike the current single-target planner, it should jointly reason about visit order and gravity assists.

### Stage A: Visit-Order Enumeration

- enumerate permutations of the required visit set
- apply cheap orbital-regime heuristics to reject obviously poor orders early
- keep only a bounded set of promising orderings

### Stage B: Per-Leg Assist Expansion

For each remaining visit order:

- solve every required leg as:
  - direct
  - one-assist
  - two-assist
- use existing patched-conic flyby checks to reject impossible subpaths
- keep only the best small set of leg candidates per required leg

### Stage C: Full-Mission Assembly

- combine the best leg candidates into complete mission tours
- compute total score across the assembled mission
- retain only the top full-mission candidates for refinement

### Stage D: Refinement And Verification

- refine the best tours with tighter timing and scoring
- verify intercept quality and event timing
- return the final ranked list to the frontend

This strategy is recommended because it preserves the stronger global search requested by the user while remaining far more tractable than a fully continuous all-at-once optimizer.

## Search-Space Controls

The first version must aggressively bound the search.

Recommended defaults:

- maximum required visit planets: `4`
- maximum extra assist bodies per required leg: `2`
- full-mission candidates kept for refinement: `20`
- final mission candidates returned to the frontend: `5`

Recommended pruning rules:

1. Reject visit orders that obviously reverse orbital scale without a compensating assist pattern.
2. Limit repeated flybys with an explicit complexity penalty.
3. Prune assist-body choices by leg regime:
   - inner-system legs prioritize Mercury, Venus, Earth, Mars
   - outer-system legs prioritize Venus, Earth, Mars, Jupiter, Saturn
4. Reject subpaths that exceed per-leg timing or flyby-feasibility thresholds.
5. Reject full tours that fail to cover every required visit body exactly once as a formal visit event.

These controls should keep the search large enough to be useful, but bounded enough to run interactively.

## Mission Data Model

The backend should introduce two main models.

### `MissionTourRequest`

Suggested fields:

- `departureBody`
- `requiredVisitBodies`
- `launchWindow`
- `optimizationMode`
- `allowAssistBodies`
- `allowRepeatedFlybys`
- `maxAssistBodiesPerLeg`
- `maxReturnedCandidates`

Important semantics:

- `requiredVisitBodies` is an unordered set from the user's perspective
- the backend determines the visit order

### `MissionTourCandidate`

Suggested fields:

- `visitOrder`
- `fullSequenceBodies`
- `legs`
- `visitEvents`
- `flybyEvents`
- `totalFlightTime`
- `totalDeltaV`
- `score`
- `samples`

Each `leg` should include:

- `startBody`
- `endBody`
- `assistBodies`
- `duration`
- `deltaV`
- `closestApproachToEndBody`

The model should clearly separate required visits from assist flybys because the frontend should visualize and label them differently.

## Optimization Objective

The first implementation should optimize complete mission tours using a combined score.

Suggested form:

`score = total_delta_v + a * total_flight_days + b * total_flyby_count + c * repeated_body_penalty + d * residual_penalty`

Where:

- `total_delta_v` has the highest weight
- `total_flight_days` has the second-highest weight
- flyby count penalizes excessive mission complexity
- repeated-body penalty discourages unnecessary revisit loops
- residual penalty handles poor intercept quality after verification

The system should never rank candidates by isolated leg quality alone. Scoring must happen on the assembled full mission.

## API Shape

The first version should add a dedicated tour-planning endpoint rather than overloading the current single-target propagation payload too heavily.

Recommended endpoint:

- `POST /missions/plan-tour`

Response shape:

- `ephemerisSource`
- `candidates`
- `selectedCandidateIndex`

Each candidate should include:

- visit order
- full sequence bodies
- total metrics
- event list
- playback samples

The existing single-target mission route should remain intact.

## Frontend Behavior

The frontend should preserve the current left-panel and right-scene structure while extending the mission form.

### Left Panel

Add three new sections:

1. `Required Visit List`
   - add and remove required planets
   - order shown as an unordered required set, not a fixed itinerary

2. `Optimization Controls`
   - combined-score mode
   - allow or disallow extra assist bodies
   - allow or disallow repeated flybys
   - maximum assists per leg

3. `Tour Candidate List`
   - ranked full-tour candidates
   - show visit order, full sequence, total time, total delta-v, and score

### Right Scene

Continue using the solar-centered top-down Three.js view, but add:

- visit markers for formal mission visits
- flyby markers for assist-only events
- timeline playback across the full mission chain
- candidate switching that updates the entire tour

The UI should make it visually obvious whether a planet is being formally visited or only used for a gravity assist.

## Testing Strategy

The first implementation should add tests at three levels.

### 1. Search Tests

- candidate tours always include every required visit body
- visit order is chosen by the backend rather than copied from input
- repeated flybys are allowed only within configured limits

### 2. Scoring Tests

- candidate ranking is stable for fixed inputs
- lower total mission cost outranks obviously worse tours
- repeated-body penalties affect sorting as expected

### 3. API And UI Tests

- the new endpoint returns ranked tour candidates
- the frontend can switch among full-tour candidates
- the scene distinguishes visit markers from flyby markers

## Phase-1 Acceptance Criteria

This phase should be considered complete when:

1. The user can provide multiple required visit planets.
2. The backend automatically determines visit order.
3. Each required leg may include up to two extra assist bodies.
4. The backend returns ranked full-mission candidates rather than a single path.
5. The frontend can switch among tour candidates and replay complete mission chains.
6. Automated tests verify that:
   - all required visit planets are formally covered
   - visit order is backend-selected
   - returned candidates are sortable by stable mission score

## Future Extensions

After phase 1, natural next steps include:

- broader launch-window optimization
- stronger continuous refinement across full tours
- support for moons and repeated gravity-assist families
- porkchop-style tour comparison views
- richer event telemetry and mission-segment diagnostics
