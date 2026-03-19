# Gravity Assist Search Design

Date: 2026-03-19
Status: Draft approved in conversation, pending written review

## Summary

Extend the existing solar-system trajectory simulator into a gravity-assist mission planner that can automatically search for multi-flyby interplanetary trajectories.

The new capability should move the product from:

- Single-leg Earth-to-target transfer planning

to:

- Automatic search over candidate gravity-assist sequences
- Flyby feasibility checks at planetary spheres of influence
- Multi-leg transfer refinement
- Ranked mission candidates balancing fuel cost, total time, and complexity

The first implementation should support automatic search over all major planets as potential assist bodies, while using aggressive pruning and staged optimization to keep the problem tractable.

## Goals

- Automatically search for gravity-assist trajectories from Earth to a target planet
- Support candidate sequences with up to three intermediate flybys in the first version
- Allow all major planets to appear as assist candidates
- Use real ephemeris-driven planetary states throughout search and verification
- Rank candidate missions by a combined score rather than a single metric
- Reuse the current Lambert, multi-body propagation, and refinement stack wherever possible
- Surface multiple candidate solutions to the frontend for comparison and playback

## Non-Goals For Phase 1

- Unlimited flyby count
- Full low-thrust trajectory optimization
- Atmospheric aerogravity assist or aerobraking
- Moon or major satellite flybys
- High-order gravity harmonics, drag, or relativistic corrections
- Fully continuous global optimization over sequence identity and all timing variables at once
- Operational mission design fidelity equal to GMAT, MONTE, or MALTO

## Product Scope

The gravity-assist planner should support a workflow where the user:

1. Chooses Earth as the departure body and any supported major planet as the final target
2. Requests automatic planning rather than manual state-vector propagation
3. Lets the backend search for candidate flyby sequences
4. Receives a ranked list of mission options
5. Selects a candidate and inspects its full trajectory, assist events, and mission metrics in 3D

The planner should initially emphasize useful, physically plausible candidate discovery over exhaustive optimality.

## Recommended Architecture

The gravity-assist extension should add four backend modules on top of the current astrodynamics stack.

### 1. Sequence Generator

Responsibilities:

- Generate candidate assist sequences from Earth to the requested target
- Respect a configured maximum number of flybys
- Apply heuristic pruning before expensive evaluation
- Prioritize sequences likely to help based on target regime and assist-body characteristics

Examples:

- `Earth -> Jupiter -> Saturn`
- `Earth -> Venus -> Earth -> Jupiter -> Saturn`

### 2. Multi-Leg Transfer Solver

Responsibilities:

- Treat each interplanetary segment as a leg between two planetary events
- Solve per-leg Lambert-style initial guesses
- Build a consistent chain of departure, assist, and arrival epochs
- Produce a candidate piecewise trajectory before fine refinement

### 3. Flyby Constraint Solver

Responsibilities:

- Check whether each assist event is physically realizable
- Match incoming and outgoing hyperbolic excess velocities in the flyby-body frame
- Enforce periapsis safety constraints
- Reject legs that require impossible turn angles

### 4. Trajectory Refiner

Responsibilities:

- Refine top-ranked candidates using continuous optimization
- Adjust launch time, leg durations, and flyby parameters
- Re-run multi-body propagation on shortlisted candidates
- Return final mission metrics and event details

This layered design keeps sequence search, flyby feasibility, and final multi-body verification separate, making failures easier to diagnose and behavior easier to test.

## Search Strategy

The planner should use a two-stage search.

### Stage A: Discrete Candidate Search

Generate candidate sequences and evaluate them over a coarse timing grid.

This stage should:

- Enumerate assist sequences up to three intermediate flybys
- Use rough launch-window and leg-duration samples
- Run fast per-leg feasibility checks
- Reject candidates early when flyby geometry is impossible
- Keep only the best `Top-N` candidates for deeper refinement

### Stage B: Continuous Refinement

Take the coarse shortlist and refine it with continuous optimization.

This stage should:

- Adjust launch epoch
- Adjust per-leg time of flight
- Tune flyby parameters such as periapsis radius or turning geometry
- Re-verify the result with the existing multi-body propagation engine

This staged approach is recommended because a fully continuous all-at-once optimizer over sequences, epochs, and flyby parameters would be too expensive and too fragile for the first implementation.

## Sequence Pruning Rules

Because all major planets are allowed as assist bodies, the generator must prune aggressively.

Recommended rules:

1. Limit the first implementation to at most three flybys.
2. Reject obviously redundant sequences such as repeated assists with no meaningful orbital-energy change.
3. Reject sequences whose orbital scale does not fit the target regime.
4. Prioritize assist bodies by usefulness for the target:
   - Inner-system targets: Venus, Earth, Mars first
   - Outer-system targets: Jupiter and Saturn first, then others
5. Keep only a bounded shortlist after coarse evaluation, such as 20 to 50 candidates.

These heuristics should bias the search without forbidding valid outliers when they score well.

## Flyby Physics Model

The first implementation should model gravity assists using patched conics and sphere-of-influence transitions.

Each flyby must satisfy four checks.

### 1. Incoming and Outgoing `v_infinity`

In the flyby-body frame, the incoming and outgoing hyperbolic excess velocity vectors must be connected by a realizable hyperbolic arc.

### 2. Turn-Angle Feasibility

Given the body gravitational parameter and the allowed periapsis radius, the maximum achievable deflection angle is limited.

If the required direction change exceeds that limit, the flyby is invalid.

### 3. Minimum Periapsis Radius

Every assist body should have a minimum allowed periapsis:

- `planetary radius + safety altitude`

This prevents solutions that clip the atmosphere or unrealistically skim the body.

### 4. Energy Gain or Loss In The Heliocentric Frame

The planner should record the heliocentric velocity change caused by each flyby so the final mission report can explain where the trajectory gained or lost useful orbital energy.

The first implementation should not yet model:

- Atmospheric drag
- Lift-assisted flybys
- J2 or non-spherical gravity
- Major moons

## Optimization Objective

The planner should not optimize for fuel or time alone. It should compute a combined mission score.

Suggested form:

`score = w1 * normalized_delta_v + w2 * normalized_flight_time + w3 * normalized_flyby_count + penalties`

Where:

- `delta_v` receives the highest weight
- `flight_time` receives the second-highest weight
- `flyby_count` penalizes excessive mission complexity
- hard or soft penalties are added for poor periapsis margins, weak final intercept quality, or large refinement residuals

The planner should return multiple ranked candidates, not only the best one.

## Result Model

Each mission candidate should expose at least the following fields.

### `flybySequence`

Examples:

- `Earth -> Jupiter -> Saturn`
- `Earth -> Venus -> Earth -> Jupiter -> Neptune`

### `launchEpoch`

The planned departure epoch.

### `legDurations`

The duration of each transfer leg in seconds.

### `flybyEvents`

Each event should include:

- body id
- epoch
- periapsis radius or altitude
- turn angle
- incoming `v_infinity`
- outgoing `v_infinity`

### `totalFlightTime`

The total mission duration.

### `deltaVMetrics`

Should include:

- departure cost
- arrival relative speed
- optional equivalent mission-cost summary

### `score`

The final combined ranking score.

### `verification`

Should summarize:

- final multi-body intercept miss distance
- whether all flyby constraints passed
- whether refinement converged

## Frontend Changes

The frontend should be extended so users can compare candidate missions instead of viewing only one transfer.

Recommended additions:

1. A candidate list in the left control panel
2. For each candidate:
   - flyby sequence
   - total flight time
   - score
   - key assist bodies
3. Candidate selection that updates the active 3D trajectory
4. Flyby event markers in the timeline and scene
5. Event details such as closest approach altitude and turn angle

The scene should remain centered on the solar-system view, but now highlight assist events in addition to the final target arrival.

## API Additions

The gravity-assist planner should add at least one new planning endpoint.

### `POST /missions/search-gravity-assist`

Purpose:

- Accept a departure body, target body, and search settings
- Run sequence generation, coarse search, refinement, and verification
- Return a ranked list of mission candidates

Suggested request fields:

- `departureBody`
- `targetBody`
- `launchWindowStart`
- `launchWindowEnd`
- `maxFlybys`
- `allowedAssistBodies`
- `objectiveProfile`
- `candidateLimit`

Suggested response fields:

- `candidates`
- `searchSummary`
- `ephemerisSource`
- `warnings`

## Implementation Plan By Phase

The work should be broken into four delivery phases.

### Phase A: Flyby Constraint Kernel

Deliverables:

- SOI utilities
- Hyperbolic-turn feasibility checks
- Periapsis safety rules
- Unit tests with known-valid and known-invalid flyby cases

### Phase B: Single-Assist Auto Search

Deliverables:

- `Earth -> Assist -> Target` automatic search
- Candidate scoring
- Ranked response payload

This phase is a stepping stone even though the final product will support multiple flybys.

### Phase C: Multi-Assist Coarse Search

Deliverables:

- Sequence generator up to three assists
- Coarse timing-grid evaluation
- Top-N shortlist pruning

### Phase D: Continuous Refinement And UI Integration

Deliverables:

- Continuous refinement for shortlisted candidates
- Multi-body verification for final solutions
- Candidate selection in the frontend
- Flyby event rendering in the 3D scene

## Acceptance Criteria For The First Full Gravity-Assist Version

The first full gravity-assist milestone should be considered complete when:

1. The backend can search trajectories with up to three intermediate assists.
2. All major planets are available as assist candidates.
3. Candidate generation uses pruning and does not attempt unbounded brute force.
4. Every shortlisted mission passes patched-conic flyby feasibility checks.
5. Final candidates are re-verified with the current multi-body propagation engine.
6. The API returns multiple ranked mission options.
7. The frontend can switch between candidate missions and visualize assist events.

## Risks And Mitigations

### Search Explosion

Risk:

- Candidate count grows too fast when all major planets are allowed.

Mitigation:

- Hard flyby-count limit
- Strong sequence pruning
- Top-N shortlist before refinement

### False Positives From Coarse Search

Risk:

- Coarse candidate evaluation may admit sequences that collapse during refinement.

Mitigation:

- Use explicit flyby-feasibility checks before refinement
- Require final multi-body validation

### Numerical Cost

Risk:

- Repeated multi-body verification becomes expensive.

Mitigation:

- Use fast coarse screening
- Cache ephemeris queries
- Limit refinement to the best candidates only

### UI Complexity

Risk:

- Too many candidates or event details overwhelm the user.

Mitigation:

- Show only the top candidates by default
- Keep the left panel list concise
- Expand details only for the selected candidate
