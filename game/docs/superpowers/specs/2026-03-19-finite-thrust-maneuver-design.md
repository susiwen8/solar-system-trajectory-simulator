# Finite-Thrust Maneuver Design

Date: 2026-03-19
Status: Draft approved in conversation, pending written review

## Summary

Extend the current solar-system trajectory simulator with finite-thrust maneuver modeling so missions can include realistic trajectory correction maneuvers, deep-space maneuvers, and arrival corrections.

The new capability should allow the system to:

- plan a baseline trajectory using the existing gravity-only mission stack
- insert a small number of short finite-thrust maneuver arcs automatically
- propagate thrust arcs with mass depletion rather than using impulsive delta-v jumps
- reduce terminal position and velocity error with realistic correction burns
- expose burn timing, fuel usage, and mass changes to the frontend

The first implementation should focus on short automatic correction burns, not full-time low-thrust optimization.

## Goals

- Add finite-thrust burn segments to the trajectory propagator
- Extend the spacecraft state from position and velocity to position, velocity, and mass
- Model propellant depletion using thrust and specific impulse
- Automatically place a bounded number of TCM, DSM, and arrival-correction burns
- Return burn events, propellant use, and remaining mass in mission results
- Visualize maneuver events in the current 3D playback interface

## Non-Goals For Phase 1

- Full continuous low-thrust mission design
- Detailed attitude dynamics or control-loop simulation
- Engine gimbal modeling or nozzle steering physics
- Full launch-vehicle ascent and parking-orbit injection
- Power, thermal, or avionics constraints
- High-fidelity GNC estimation and covariance analysis

## Product Scope

The first version should support the following workflow:

1. The user configures a normal mission or tour request.
2. The backend first solves a gravity-driven baseline trajectory.
3. The backend evaluates miss distance and trajectory quality.
4. The backend inserts up to three finite-thrust correction burns.
5. The backend returns the corrected trajectory, maneuver events, and propulsion metrics.
6. The frontend shows where burns occur and how much fuel they consume.

This feature should make the simulator feel more like a real mission design tool without turning it into a full low-thrust optimizer.

## Recommended Architecture

The first implementation should add four layers on top of the existing mission-planning stack.

### 1. Maneuver Planner

Responsibilities:

- analyze a baseline mission trajectory and determine where correction opportunities exist
- place candidate burn windows in early-flight, mid-course, and pre-arrival regions
- bound the number of burns and the allowed duration of each burn

The first version should support at most three burns:

- one early TCM
- one DSM
- one arrival correction

### 2. Thrust Arc Model

Responsibilities:

- model each maneuver as a short finite-thrust time interval
- parameterize each burn by start time, duration, thrust magnitude, and thrust direction
- support a small set of direction strategies in phase 1:
  - prograde
  - retrograde
  - target-error correction direction

The model should represent thrust continuously over a short arc instead of as an instantaneous velocity jump.

### 3. Propulsion And Mass Model

Responsibilities:

- introduce spacecraft mass and propellant state
- compute mass flow from thrust and specific impulse
- enforce propellant depletion and report remaining usable mass

Suggested initial fields:

- `initialMassKg`
- `propellantMassKg`
- `maxThrustN`
- `ispSeconds`

### 4. Propagator With Burn Segments

Responsibilities:

- propagate coast segments under existing multi-body gravity
- propagate burn segments under gravity plus continuous thrust acceleration
- integrate mass depletion during thrust arcs

The state vector should expand from:

- `[r, v]`

to:

- `[r, v, m]`

This makes finite-thrust corrections reusable for future auto-planned and user-authored burns.

## First-Version Maneuver Scope

The first version should explicitly limit scope to short automatic correction burns.

Supported maneuver categories:

1. `TCM`
   - early mission correction after departure
2. `DSM`
   - mid-course shaping burn
3. `arrivalCorrection`
   - final approach correction before target encounter

Recommended hard limits:

- maximum burns per mission: `3`
- burn duration range: minutes to a few hours
- thrust direction options limited to a small fixed strategy set
- no explicit attitude state or thrust-vector steering loop

This scope is intentionally narrower than a full low-thrust mission solver, but much more realistic than impulsive-only corrections.

## Solution Flow

The end-to-end workflow should be:

### Stage A: Baseline Trajectory

- solve a normal mission trajectory using the current Lambert, gravity-assist, and multi-body propagation stack
- produce a gravity-only baseline result

### Stage B: Error Analysis

- measure final position error
- measure final velocity error
- evaluate flyby or arrival geometry quality
- identify where correction burns would produce the most benefit

### Stage C: Burn Window Placement

- define candidate windows for TCM, DSM, and arrival correction burns
- limit the search space so the problem remains interactive

### Stage D: Local Burn Optimization

For each candidate burn:

- adjust burn start time
- adjust duration
- choose from the allowed thrust-direction strategies
- propagate the updated trajectory under finite thrust and mass depletion

### Stage E: Full-Mission Verification

- propagate the full mission again with all accepted burn segments enabled
- compute final miss distance, mass remaining, and fuel use
- return the corrected mission result and burn event list

This staged flow is recommended because it reuses the existing gravity-first planner and adds finite-thrust correction where it matters most.

## Data Model

The backend should add explicit propulsion and maneuver objects.

### `PropulsionConfig`

Suggested fields:

- `initialMassKg`
- `propellantMassKg`
- `maxThrustN`
- `ispSeconds`

### `ManeuverEvent`

Suggested fields:

- `type`
- `startEpoch`
- `durationSeconds`
- `thrustDirection`
- `deltaVEstimateKmPerS`
- `propellantUsedKg`
- `massBeforeKg`
- `massAfterKg`

### Mission Result Extensions

Suggested fields:

- `maneuverEvents`
- `finalMassKg`
- `totalPropellantUsedKg`
- `propulsionConfig`

These fields should be available on both single-target mission results and multi-planet tour candidates once the feature is integrated across the planner stack.

## Frontend Presentation

The frontend should extend the current mission summary and 3D playback, not replace them.

### Summary Additions

Add propulsion metrics to the left-side mission summary:

- total propellant used
- final remaining mass
- maneuver count

### Scene Additions

Add maneuver markers in the right-side Three.js scene:

- mark each burn location along the trajectory
- distinguish burn types visually when possible

### Playback Additions

When the playback reaches a burn:

- indicate that the spacecraft is in an active maneuver segment
- show burn type, duration, and estimated delta-v
- surface mass change in the HUD

This keeps the new realism visible to the user instead of hiding it entirely in backend calculations.

## Error Handling And Limits

The first version should explicitly handle:

1. invalid propulsion inputs
   - non-positive mass, thrust, or specific impulse
2. impossible maneuver requests
   - burn requires more propellant than is available
3. unstable optimization results
   - burn candidate worsens terminal error or produces nonphysical mass
4. partial success cases
   - corrected mission still misses target materially, but best found solution should still be returned with warnings

The backend should surface these as structured warnings and validation errors, not opaque failures.

## Testing Strategy

The implementation should add both numerical and product-level coverage.

### Backend Tests

- verify coast propagation remains compatible with the current solver when thrust is disabled
- verify mass decreases correctly during burn arcs
- verify finite-thrust arcs change velocity continuously rather than impulsively
- verify automatic correction reduces miss distance on at least one reference mission
- verify impossible burns fail cleanly

### Frontend Tests

- verify maneuver events render in the scene
- verify propulsion metrics appear in the summary
- verify playback highlights active burn windows

## Phase 1 Acceptance Criteria

Phase 1 should be considered complete when:

1. the propagator supports finite-thrust short arcs
2. spacecraft mass and propellant depletion are modeled
3. the planner inserts up to three automatic correction burns
4. mission results include maneuver events and propulsion totals
5. the frontend displays burn markers and propulsion metrics
6. automated tests verify both dynamics behavior and UI presentation

## Future Extensions

After phase 1, the architecture should be ready for:

- user-authored burn placement
- longer finite-thrust arcs
- thrust-direction optimization in continuous space
- low-thrust mission modes
- navigation uncertainty and Monte Carlo correction analysis
- arrival orbit-insertion and capture burns
