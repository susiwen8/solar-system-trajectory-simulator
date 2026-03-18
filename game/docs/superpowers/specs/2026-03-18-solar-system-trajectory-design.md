# Solar System Trajectory Simulator Design

Date: 2026-03-18
Status: Draft approved in conversation, pending written review

## Summary

Build a solar-system mission simulator focused on accurate probe trajectory computation rather than visual fidelity first. The product should simulate a probe launched from Earth toward any other major planet using real solar-system data, with a front-end for 3D visualization and a back-end for astrodynamics computation.

The first phase prioritizes:

- Real ephemeris-driven planetary states
- Multi-body gravity for the probe
- High-accuracy numerical propagation
- A clear API boundary between visualization and computation
- Automated validation proving the propagation results are trustworthy

The first phase explicitly does not prioritize:

- Full mission design automation from day one
- Low-thrust propulsion
- Lunar modeling
- Solar radiation pressure
- Full-fidelity operational time-system complexity

Those advanced capabilities are reserved for later phases.

## Goals

- Simulate a probe trajectory from Earth to any supported target planet in the solar system
- Base planetary motion on real solar-system data
- Compute probe trajectories with a physics model that is strong enough to be extended toward mission-planning use cases
- Visualize the solar system and propagated trajectory in 3D
- Support both direct state-vector propagation and a later upgrade path to automatic transfer search

## Non-Goals For Phase 1

- Full flight-proven mission-analysis fidelity
- Complete JPL DE ingestion on day one
- Finite-burn maneuver design
- Porkchop plots and Lambert search in the first deliverable
- N-body self-consistent integration of the entire solar system
- Atmospheric entry, aerobraking, or landing simulation

## Product Scope

Phase 1 should support a user workflow where the user:

1. Chooses Earth as the departure body and any supported planet as the target body
2. Provides a launch epoch and an initial probe state
3. Runs a propagation over a chosen mission duration
4. Inspects the resulting 3D trajectory, target geometry, closest approach, and mission timing

The system should first support explicit initial-state propagation, then later add automatic transfer search using the same core astrodynamics engine.

## Recommended Architecture

The system should be split into four modules.

### 1. Frontend

Responsibilities:

- 3D solar-system rendering
- Mission configuration UI
- Timeline playback and camera controls
- Display of propagated trajectory samples and mission metrics
- Visual comparison of probe path against planetary positions

The frontend should not perform orbital mechanics calculations beyond light presentation-layer transformations.

### 2. Mission API

Responsibilities:

- Accept mission requests from the frontend
- Validate mission parameters
- Call the astrodynamics core
- Return structured results for rendering and analysis

This layer should provide stable contracts that do not leak UI-specific assumptions into the computation layer.

### 3. Astrodynamics Core

Responsibilities:

- Unit and frame normalization
- Ephemeris access abstraction
- Gravity model assembly
- Numerical propagation of the probe state
- Event extraction and mission metrics

This is the most important module in the project and should be treated as a reusable engine rather than page-specific application code.

### 4. Ephemeris/Data Layer

Responsibilities:

- Serve body state vectors at requested epochs
- Expose planetary constants such as gravitational parameters
- Start with project-bundled preprocessed data
- Preserve an interface that can later swap to JPL-backed sources

This layer should be designed so that changing the source of celestial data does not require changing the propagation API.

## Physics Model

Phase 1 should use the following physical model.

### Reference Frame

Use a heliocentric inertial frame as the internal propagation frame for the first version. This minimizes early coordinate-system complexity and is well suited to interplanetary transfer simulation.

### Planetary Motion

Planetary positions and velocities should come from ephemeris data rather than being re-integrated by the system in phase 1.

This means:

- The probe is numerically propagated
- The planets are treated as time-varying bodies provided by the ephemeris layer

This is the recommended balance between realism and engineering complexity for the first phase.

### Force Model

The probe acceleration should include:

- Solar gravity
- Gravity from the major planets included in the supported body set

Deferred to later phases:

- Moon gravity
- Solar radiation pressure
- Finite-duration thrust modeling
- Relativistic corrections
- Non-spherical gravity fields

### Numerical Propagation

Use a mature adaptive-step ODE integrator, such as RK45 or DOP853, rather than a simple fixed-step approach.

Key rules:

- Internal integration step size must remain independent from output sample spacing
- Relative and absolute tolerances should be explicit parameters in the computation layer
- The frontend should expose only a few preset quality levels at first

## Mission Flow

The propagation workflow for phase 1 should be:

1. The user submits a mission request
2. The system resolves ephemeris states for supported bodies over the requested time span
3. The astrodynamics core builds the acceleration model for the probe
4. The integrator propagates the probe state over time
5. The result pipeline computes closest approach, flight duration, and event summaries
6. The frontend renders the trajectory and body motion in 3D

This flow intentionally prioritizes deterministic propagation before automatic transfer solving.

## Data Model

The backend should define a small set of explicit domain objects.

### MissionRequest

Suggested fields:

- `departureBody`
- `targetBody`
- `launchEpoch`
- `initialState`
- `durationSeconds`
- `outputStepSeconds`
- `ephemerisSource`
- `gravityModel`

### InitialState

Support two input modes that normalize into a shared internal state-vector format.

Mode A:

- `stateVector`
- `positionKm`
- `velocityKmPerSec`

Mode B:

- `launchFromBody`
- Parameters describing altitude, direction, and excess velocity relative to the departure body

The API may accept both, but the propagation engine should always operate on a normalized heliocentric state vector.

### BodyState

Suggested fields:

- `bodyId`
- `epoch`
- `positionKm`
- `velocityKmPerSec`
- `mu`

### TrajectorySample

Suggested fields:

- `epoch`
- `positionKm`
- `velocityKmPerSec`
- `distanceToTargetKm`
- `distanceToSunKm`

### TrajectoryResult

Suggested fields:

- `referenceFrame`
- `samples`
- `closestApproach`
- `flightTime`
- `energyMetrics`
- `events`
- `warnings`

## API Shape

Phase 1 should expose three main endpoints.

### `POST /missions/propagate`

Purpose:

- Accept a mission definition
- Run numerical propagation
- Return the trajectory and mission metrics

This is the primary endpoint for phase 1.

### `GET /ephemeris/bodies?epoch=...`

Purpose:

- Return planetary states at a given epoch
- Allow the frontend to render body positions independently from mission execution

### `POST /missions/validate-initial-state`

Purpose:

- Catch invalid inputs before expensive propagation
- Return structured validation errors

Examples of checks:

- Unsupported body identifiers
- Invalid timestamps
- Missing vector components
- Non-positive durations
- Physically implausible parameter combinations

Phase 2 can later add:

- `POST /missions/search-transfer`
- `GET /missions/porkchop`

## Error Handling

The API should distinguish clearly between three categories of failure.

### Invalid Input

Examples:

- Bad time format
- Missing initial velocity
- Unsupported target planet
- Invalid duration

These should return structured validation errors, not generic server failures.

### Propagation Failure

Examples:

- Integrator fails to converge
- Numerical instability
- Invalid intermediate state

The response should include:

- Failure category
- Human-readable reason
- The last valid propagated state, when available

### Suspicious But Completed Result

Examples:

- Extremely large distances reached unusually quickly
- Output sampling too coarse for accurate closest-approach interpretation
- Configuration likely outside trusted validity bounds

These should appear as warnings rather than hard failures.

## Validation Strategy

The first release should only be considered successful if it proves the core propagation is trustworthy.

At minimum, add automated validation in four areas.

### 1. Ephemeris Validation

Compare bundled planetary states against reference data at selected epochs to ensure the internal ephemeris source stays within its intended error bounds.

### 2. Two-Body Sanity Tests

Disable all perturbing bodies except the Sun and validate expected orbital behavior. This catches mistakes in units, sign conventions, and integrator wiring.

### 3. Known Interplanetary Scenarios

Run known Earth-to-planet scenarios and verify metrics such as:

- Transfer duration range
- Perihelion and aphelion behavior
- Closest-approach magnitude

The goal is not to match a production flight system yet, but to prove the results are physically reasonable and stable.

### 4. Regression Tests

Ensure repeated runs of the same request remain consistent and that later code changes do not silently degrade solution quality.

## Phase Plan

### Phase 1

Deliver:

- Frontend 3D visualization of the major bodies and propagated probe trajectory
- Backend numerical propagation driven by real ephemeris data abstraction
- Earth-to-any-planet mission configuration
- Closest-approach and flight-time reporting
- Automated validation suite for propagation correctness

### Phase 2

Add:

- Automatic transfer search
- Lambert solver or equivalent transfer-guess generation
- Time-window scans
- Porkchop data generation
- Richer launch parameter tools

### Phase 3

Consider:

- Moon modeling
- Solar radiation pressure
- Finite-burn or low-thrust segments
- Stronger time-system support
- JPL-backed high-fidelity ephemeris integration

## Technology Direction

Because the product is accuracy-first and the user selected a front-end/back-end split, the architecture should favor:

- A frontend specialized for 3D presentation
- A backend specialized for numerical computation and domain logic

The final language choices can still be decided during implementation planning, but the design strongly favors keeping the astrodynamics core isolated behind service boundaries.

## Success Criteria

Phase 1 is complete when all of the following are true:

1. The user can configure an Earth-origin mission to any supported planet
2. The backend can propagate the probe trajectory using real ephemeris-driven planetary motion
3. The frontend can visualize the solar system and propagated trajectory in 3D
4. The system reports core metrics including closest approach and flight time
5. Automated validation demonstrates that the propagation engine is reliable within declared phase-1 assumptions
6. The service contracts already leave room for a later automatic transfer-search layer

## Open Decisions For Implementation Planning

These should be resolved in the implementation plan rather than in this design document:

- Exact frontend framework and rendering stack
- Exact backend framework and language
- Exact ephemeris packaging format for the bundled starter dataset
- Exact supported planet set in phase 1
- Exact tolerance presets exposed in the UI
- Exact format for event extraction and telemetry summaries
