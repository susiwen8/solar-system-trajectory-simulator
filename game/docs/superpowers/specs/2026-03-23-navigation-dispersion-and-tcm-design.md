# Navigation Dispersion And TCM Design

## Summary

This design adds a first-pass mission-operations realism layer on top of the current trajectory simulator by modeling:

- random launch injection dispersion
- divergence between a nominal mission and an actual flown mission
- automatic trajectory correction maneuvers (TCMs)
- visual and numeric presentation of deviation, correction, and convergence

The first version targets mission-level realism rather than full navigation-estimation realism. The simulator will not model measurements, covariance propagation, orbit determination, or human-in-the-loop targeting. Instead, it will answer a simpler question:

`If the spacecraft leaves Earth with a realistic random injection error, how many correction maneuvers are needed to recover the mission, when do they occur, and what do they cost?`

This version must support both single-destination missions and multi-planet tours.

## Goals

1. Produce both a nominal trajectory and a dispersed trajectory for each solved mission.
2. Introduce randomized launch/injection error so repeated solves of the same mission can diverge.
3. Trigger TCMs automatically when either:
   - predicted target/flyby miss distance exceeds a threshold
   - current state deviation from nominal exceeds a threshold
4. Show the correction loop clearly in both 3D playback and mission summaries.
5. Keep the implementation compatible with both single-target and tour workflows.

## Non-Goals

1. No orbit determination, tracking noise, or state-estimation covariance.
2. No manual user-driven maneuver placement in this version.
3. No high-fidelity thrust steering optimization for TCM design.
4. No launch vehicle performance simulation beyond randomized injection error.
5. No attempt to preserve deterministic repeatability unless a random seed is explicitly supplied.

## User Experience

### Mission Form

Add a `Navigation Dispersion` section to the mission form with:

- enable/disable toggle
- random seed mode:
  - automatic random
  - optional fixed seed for reproducible demonstrations
- injection dispersion magnitude controls:
  - position error scale
  - velocity error scale
- automatic correction settings:
  - maximum TCM count
  - predicted target miss threshold
  - state deviation threshold

Reasonable defaults should make the feature immediately demonstrable without extra tuning.

### Mission Results

Mission results should show:

- nominal route
- actual dispersed route
- number of TCMs
- maximum predicted target miss distance
- maximum state deviation
- cumulative correction delta-v
- correction propellant usage when propulsion is enabled
- final miss distance after corrections

### 3D Scene

The 3D scene should show:

- nominal trajectory as a subdued reference line
- dispersed trajectory as the active flown line
- TCM markers at correction epochs
- playback state that follows the dispersed mission rather than the nominal one

During playback, the HUD should expose:

- current navigation mode: nominal / dispersed with corrections
- current state deviation
- predicted next-target miss distance
- next correction status or “within thresholds”

## System Design

### Core Model

Each mission solve will produce two linked mission products:

1. `nominal mission`
   - the existing best-knowledge trajectory already produced by the solver
2. `navigation-adjusted mission`
   - starts from the nominal trajectory
   - injects a randomized initial dispersion
   - propagates the actual trajectory
   - inserts TCMs when deviation thresholds are exceeded

The nominal mission remains the reference plan. The dispersed mission is what the spacecraft actually flies.

### Navigation Flow

The backend flow becomes:

1. Solve the nominal mission using current logic.
2. Build a navigation context from the nominal mission:
   - target events
   - flyby events
   - nominal samples
   - mission segments
3. Inject randomized dispersion into the initial flown state.
4. Propagate the actual flown state forward.
5. At evaluation checkpoints, compute:
   - current state deviation from nominal
   - predicted miss distance to the next mission-critical encounter
6. If either threshold is exceeded and TCM budget remains:
   - synthesize a small correction maneuver
   - update mass if propulsion is enabled
   - continue propagation from the corrected state
7. Return the final actual mission plus navigation diagnostics.

## Correction Trigger Logic

### Threshold Families

The first version uses a dual-threshold trigger:

1. `predicted encounter miss threshold`
   - estimated miss distance to the next target body or flyby body if no correction is made
2. `state deviation threshold`
   - magnitude of position and velocity drift from the nominal mission at the current epoch

TCM triggers when either threshold is exceeded.

### Evaluation Checkpoints

To keep implementation bounded, evaluate thresholds only at mission checkpoints:

- fixed cadence during cruise
- segment boundaries
- after major events such as launch escape or flyby exit
- before the terminal approach window

This avoids continuous optimization while still producing realistic “mission operations” cadence.

### TCM Placement

When a correction is triggered, place the maneuver at the current checkpoint epoch. This creates a clear operations story:

- we detect divergence
- we execute a planned correction
- we observe later convergence

## TCM Synthesis

### First-Version Strategy

Use a local corrective targeting method rather than a global re-solve.

At a TCM epoch:

1. identify the nearest nominal reference state at the same epoch
2. compute state error relative to nominal
3. compute a bounded corrective delta-v that reduces the downstream miss
4. clamp the correction to a configurable maximum per maneuver

This should be implemented as a simple task-level correction law, not a full differential corrector.

### Why This Approach

It is cheaper and more robust than re-solving the whole trajectory after every correction, while still matching the user-facing behavior we want:

- visible divergence
- visible correction
- measurable convergence

## Data Model

### Request Additions

Add `navigationConfig` to both mission request types.

Suggested shape:

```ts
type NavigationConfig = {
  enabled: boolean;
  randomSeed?: number | null;
  injectionDispersion: {
    positionSigmaKm: number;
    velocitySigmaKmPerS: number;
  };
  correctionPolicy: {
    maxTcmCount: number;
    predictedMissThresholdKm: number;
    positionDeviationThresholdKm: number;
    velocityDeviationThresholdKmPerS: number;
    checkpointStepSeconds: number;
    maxCorrectionDeltaVKmPerS: number;
  };
};
```

### Response Additions

Add a navigation layer to the mission response:

```ts
type NavigationEvent = {
  type: "dispersionInjected" | "tcmTriggered" | "tcmExecuted";
  epoch: string;
  reason?: "predictedMiss" | "stateDeviation" | "both";
  predictedMissBeforeKm?: number;
  predictedMissAfterKm?: number;
  positionDeviationBeforeKm?: number;
  positionDeviationAfterKm?: number;
  velocityDeviationBeforeKmPerS?: number;
  velocityDeviationAfterKmPerS?: number;
  deltaVKmPerS?: number;
  propellantUsedKg?: number | null;
};

type NavigationTelemetry = {
  enabled: boolean;
  nominalSamples: TrajectorySample[];
  dispersedSamples: TrajectorySample[];
  navigationEvents: NavigationEvent[];
  tcmCount: number;
  cumulativeCorrectionDeltaVKmPerS: number;
  maxPredictedMissKm: number;
  maxPositionDeviationKm: number;
  maxVelocityDeviationKmPerS: number;
  finalPredictedMissKm: number | null;
};
```

The top-level mission result should still expose a single active sample stream for playback. In navigation-enabled mode, that active stream should be the corrected dispersed mission, while `nominalSamples` remain available for comparison.

## Single-Target And Tour Support

### Single-Target Missions

The next critical encounter is the terminal target body.

### Tour Missions

The next critical encounter is the next body in the mission chain:

- flyby body during assist legs
- visit body during terminal legs

The logic should reset its encounter focus after each successful encounter. This keeps the same framework usable across:

- Earth -> Mars
- Earth -> Venus -> Jupiter -> Saturn

without creating separate navigation systems.

## Frontend Design

### Mission Summary

Add a `Navigation` section that reports:

- navigation enabled / disabled
- TCM count
- cumulative correction delta-v
- maximum predicted miss
- maximum state deviation
- final miss after last correction

### Playback Controls

Add an optional comparison toggle:

- `Show nominal reference`
- `Show dispersed flown path`

Default behavior should show both when navigation is enabled.

### Visual Language

- nominal path: muted cyan/gray
- dispersed path: brighter mission accent color
- TCM markers: amber
- warning state when thresholds are exceeded before correction

The display should make it obvious that corrections are mission operations, not permanent engine burns.

## Backend Components

Add a dedicated service layer rather than mixing this logic directly into existing planners:

1. `navigation_dispersion.py`
   - builds random injection error
2. `navigation_thresholds.py`
   - evaluates predicted miss and state deviation
3. `tcm_planner.py`
   - synthesizes bounded corrective maneuvers
4. `navigation_simulator.py`
   - orchestrates dispersed propagation + TCM insertion

Existing mission services remain responsible for the nominal solve.

## Testing Strategy

### Backend Tests

1. dispersion injection changes initial flown state while leaving nominal unchanged
2. fixed random seed produces reproducible dispersed trajectories
3. threshold breach triggers TCM insertion
4. TCM reduces predicted miss distance
5. TCM count never exceeds configured maximum
6. single-target and tour missions both emit valid navigation telemetry

### Frontend Tests

1. mission summary renders navigation metrics when enabled
2. scene can display both nominal and dispersed trajectories
3. TCM markers appear at navigation event epochs
4. playback follows dispersed samples, not nominal ones

## Rollout Plan

### Phase 1

- request/response schema
- random dispersion
- dispersed propagation
- navigation telemetry

### Phase 2

- threshold checks
- TCM insertion
- summary metrics

### Phase 3

- dual-path 3D visualization
- TCM markers
- HUD deviation readouts

## Risks

1. tour missions may need careful handling around flyby transitions so the “next encounter” is always correct
2. over-aggressive TCM logic could create oscillation or too many maneuvers
3. response payload size may grow significantly if both nominal and dispersed samples are always returned

## Mitigations

1. cap TCM count at a small number in v1
2. evaluate at checkpoints instead of every sample
3. keep correction law simple and bounded
4. if payload size becomes a problem, downsample nominal reference samples for display

## Recommendation

This feature should be implemented as a mission-level navigation overlay, not a replacement for the current trajectory engine. That keeps the simulator understandable and demo-friendly while making it feel far more like a real interplanetary mission program.
