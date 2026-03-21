# Space Mission Trajectory Visualizer Design

Date: 2026-03-21
Status: Approved for planning

## Overview

This project is a web-based 3D mission trajectory visualizer for interplanetary
and dwarf-planet exploration.

The chosen direction is:

- A browser-based 3D solar system view with a lightweight numerical backend
- Real planetary and dwarf-planet position data sourced from NASA/JPL services
- Mission design based on engineering-approximation astrodynamics rather than
  pure visual scripting
- Free-form multi-stop mission planning from Earth to any supported sequence of
  planets and dwarf planets
- Candidate route generation that balances flight time and fuel cost instead of
  optimizing a single metric only

The main user fantasy is:

Design a plausible deep-space mission by choosing a launch window and a
sequence of target worlds, then watch a scientifically grounded trajectory
unfold in 3D while the planets and spacecraft move through space in real time.

## Goals

- Let the user choose a multi-body visit sequence starting from Earth
- Use real ephemeris data so planetary and dwarf-planet positions are grounded
  in actual astronomy data
- Compute physically plausible transfer arcs using Lambert solutions and
  patched-conic mission design techniques
- Consider gravity-assist feasibility as part of route scoring
- Present multiple candidate trajectories that expose time and fuel trade-offs
- Render the full mission in 3D with real-time planet and spacecraft motion
- Keep the spacecraft centered in the main view by default
- Support smooth switching between an overhead mission view and a first-person
  spacecraft view
- Make the scientific fidelity legible so users understand what is exact data
  and what is engineering approximation

## Non-Goals

- No promise that generated trajectories are flight-certified or directly usable
  for real launch execution
- No full n-body optimal control, low-thrust trajectory design, or finite-burn
  mission planning in the first version
- No modeling of solar radiation pressure, non-spherical gravity harmonics, or
  atmospheric drag
- No modeling of moons, Lagrange points, asteroids, or comet missions in the
  first version
- No multiplayer, account system, or cloud persistence in the first version
- No photoreal planetary rendering that compromises readability or performance

## Core Experience

The user spends most of their time doing five actions:

1. Choose a launch window and mission constraints
2. Build an ordered visit list of planets and dwarf planets
3. Ask the solver for candidate trajectories
4. Compare candidate solutions by time, delta-v, and flyby feasibility
5. Watch the selected trajectory play back in the 3D scene with camera changes

The core loop is:

`select targets -> solve candidate transfers -> compare trade-offs -> inspect 3D mission playback -> refine mission constraints`

The intended learning loop is:

- Try a target sequence that seems interesting
- See whether the route is feasible, expensive, or slow
- Notice how launch date and flyby opportunities reshape the solution
- Adjust the mission sequence or time window
- Build intuition for real interplanetary mission design trade-offs

## Prototype Scope

The first complete version should include:

- A frontend built for 3D mission visualization and interaction
- A lightweight backend for ephemeris retrieval, caching, and mission solving
- Support for the eight planets plus the five officially recognized dwarf
  planets: Ceres, Pluto, Haumea, Makemake, and Eris
- A mission planner that starts from Earth and accepts a free-form ordered visit
  sequence
- Time-window constraints for launch and per-leg travel duration
- Candidate search based on multi-leg Lambert transfers
- Gravity-assist feasibility checks using patched-conic turn-angle limits
- A Pareto-like result set containing at least fuel-efficient, time-efficient,
  and recommended compromise solutions
- A 3D scene that shows the Sun, selected bodies, their orbits, the mission
  path, and the current spacecraft position
- Bird's-eye and first-person spacecraft camera modes
- Time controls for pause and accelerated playback
- Visual labels and scientific fidelity disclaimers

The first complete version should not include:

- Editable spacecraft mass budgets, staging, or detailed propulsion subsystem
  modeling
- User-authored arbitrary impulsive maneuvers between Lambert legs
- Launch from bodies other than Earth
- Full offline mirroring of all external astronomy data
- Long-term save/load beyond basic local mission export if that becomes useful

## Scientific Positioning

This product should be described as a mission-design-inspired simulator.

The fidelity model should be communicated explicitly:

- `Ephemeris fidelity: high` for body positions retrieved from JPL data
- `Transfer fidelity: engineering approximation` for Lambert-based heliocentric
  transfer arcs
- `Flyby fidelity: patched-conic approximation` for gravity assists

The UI should never imply that the system is a direct replacement for
professional mission analysis tools such as GMAT, MONTE, or STK/Astrogator.

## Data Sources

The implementation should prefer authoritative public NASA/JPL sources:

- JPL Horizons API for heliocentric position and velocity vectors
- NASA or NSSDC planetary fact sheets for radius, mass, and display constants
- NAIF/SPICE generic kernels as a future-quality fallback or validation path
- NASA Basics of Space Flight material for explanatory copy about gravity
  assists and interplanetary transfers

The system should cache retrieved astronomy data locally on the backend so that:

- repeated mission solves do not repeatedly call the remote API
- the UI remains responsive after the first retrieval
- temporary upstream outages can degrade gracefully when cached data exists

## Supported Bodies

The first version should support:

- Mercury
- Venus
- Earth
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune
- Ceres
- Pluto
- Haumea
- Makemake
- Eris

Each supported body should expose:

- canonical name
- ephemeris identifier used by the backend
- mean or equatorial radius used for display and flyby clearance constraints
- gravitational parameter if needed for flyby calculations
- representative color and rendering material settings

## Mission Planning Model

The user mission request should contain:

- origin body, fixed to Earth in the first version
- ordered target sequence, for example `Mars -> Jupiter -> Pluto`
- launch window start and end date
- total mission duration cap
- optional minimum and maximum time-of-flight bounds per leg
- time-versus-fuel weighting used for recommendation scoring
- whether gravity assists are allowed
- a minimum safe flyby altitude multiplier per body

The planner should validate requests before solving:

- at least one destination must be selected
- duplicate consecutive bodies are invalid
- launch window end must not precede launch window start
- mission duration cap must be positive
- per-leg duration bounds must be consistent
- unsupported body combinations should be rejected with clear messaging

## Trajectory Computation Model

The first version should use a Sun-centered patched-conics mission design
approach.

For each leg:

1. Query or retrieve cached heliocentric state vectors for departure and arrival
   bodies over the requested time span
2. Sample candidate departure and arrival dates within the allowed window
3. Solve a Lambert problem for each sampled pair to produce a heliocentric
   transfer arc
4. Compute departure and arrival hyperbolic excess velocities relative to the
   bodies involved
5. Estimate the impulsive cost or flyby feasibility associated with entering and
   leaving the leg

For a multi-leg mission:

1. Solve each leg independently in a coarse search pass
2. Chain compatible legs together
3. For interior visit bodies, evaluate whether the incoming and outgoing
   hyperbolic excess vectors can be connected by a feasible gravity assist under
   the chosen minimum periapsis constraint
4. Reject sequences whose required turn angle exceeds the physically achievable
   turn angle
5. Refine the best candidate chains with denser local sampling

The result is a set of physically plausible candidate missions rather than one
globally optimal trajectory.

## Lambert Solver Requirements

The Lambert solver should:

- handle prograde heliocentric transfers as the default path
- work with the distance and time scales needed for inner and outer solar system
  travel
- return velocities at both ends of the transfer arc
- expose failures cleanly when no valid solution exists for the sampled pair
- be covered by numerical regression tests against known two-body transfer cases

The first version does not need:

- multi-revolution Lambert branches
- retrograde mission solving as a primary UI path
- finite-thrust propagation

## Gravity-Assist Model

Gravity assists should be modeled with patched-conic flyby geometry.

For each interior flyby:

- compute incoming and outgoing `v_infinity` vectors relative to the flyby body
- compute the required turning angle between those vectors
- compute the maximum achievable turning angle from the body's gravitational
  parameter, the `v_infinity` magnitude, and the minimum allowable periapsis
- mark the leg transition as feasible only if the required angle is within the
  allowed limit

The system should present flyby outcomes clearly:

- `feasible`
- `near limit`
- `infeasible`

If a route is infeasible because the flyby angle is too large, the UI should
suggest:

- widening the launch window
- increasing the mission duration cap
- inserting a different assist body
- lowering the time preference weight

## Candidate Search and Scoring

The solver should not return only one answer.

It should instead produce a compact candidate set that includes:

- a time-efficient solution
- a fuel-efficient solution
- a system-recommended compromise solution

Each candidate should include:

- total mission duration
- aggregate delta-v estimate
- per-leg departure and arrival dates
- flyby feasibility data
- high-level risk or sensitivity notes

The recommendation score should combine:

- normalized total mission duration
- normalized aggregate delta-v
- penalties for narrow windows or flyby transitions close to feasibility limits

The exact scoring formula should be transparent in code and easy to tune.

## Numerical and Unit Conventions

The project should choose explicit and consistent units:

- time in seconds for internal dynamics calculations
- calendar time in UTC at the API boundary
- distances in kilometers internally for mission solving
- astronomical units only for selected display labels when useful
- velocities in kilometers per second

Every physics-related module should state its expected units in code comments or
type-level documentation.

## Error Handling and Degradation

The backend should distinguish between:

- invalid user input
- unsupported solver configuration
- ephemeris fetch failure with cached fallback available
- ephemeris fetch failure with no cached fallback
- no feasible mission found within the requested constraints
- numerical solver failure on one or more sampled legs

The frontend should surface these cases with actionable language rather than
generic error banners.

Examples:

- "No feasible route found in this launch window. Try widening the departure
  range or increasing maximum mission duration."
- "JPL data service is temporarily unavailable. Showing results from cached
  ephemeris data retrieved earlier."
- "This flyby would require a sharper turn than the selected safe altitude
  allows."

## System Architecture

The implementation should use two main applications:

- `frontend`: a React and TypeScript single-page app for mission setup and 3D
  playback
- `backend`: a FastAPI service for astronomy data access and mission solving

The architecture boundary should be:

- the backend owns ephemeris retrieval, local caching, mission search, scoring,
  and trajectory sampling
- the frontend owns user input, candidate comparison, animation state,
  rendering, and camera behavior

This split keeps the numerically heavy logic out of the browser while preserving
an interactive frontend experience.

## Backend Design

The backend should be organized into focused modules with clear interfaces:

- `body_catalog`: supported-body metadata and canonical identifiers
- `ephemeris_client`: external API integration for JPL data
- `ephemeris_cache`: local storage and cache lookup policy
- `mission_request`: validated input models
- `lambert_solver`: transfer arc solver
- `flyby_analysis`: gravity-assist turn-angle feasibility
- `mission_search`: coarse search, chaining, refinement, and scoring
- `trajectory_sampling`: conversion of solved arcs into time-sampled points for
  playback
- `api`: FastAPI routes and response models

Each module should be understandable and testable without reading unrelated
implementation details.

### Backend API Surface

The backend should expose at minimum:

- `GET /api/bodies`
  - returns supported bodies and display constants
- `POST /api/ephemeris`
  - returns state vectors for requested bodies and times when needed for focused
    inspection
- `POST /api/missions/solve`
  - accepts mission constraints and returns candidate trajectories
- `GET /api/missions/{missionId}/samples`
  - returns sampled trajectory and body positions for playback if mission solve
    results are persisted or cached

The `missions/solve` response should include enough information for the frontend
to render a selected candidate without recomputing astrodynamics.

## Frontend Design

The frontend should use:

- React with TypeScript for stateful UI
- Vite for development and build tooling
- Three.js through react-three-fiber for 3D rendering
- a small state layer for mission configuration, playback time, and camera mode

The main interface should be organized as:

- left panel for mission configuration
- center viewport for the 3D scene
- right panel for candidate details and selected-body information
- bottom strip for time controls and mission timeline feedback

### Frontend Modules

The frontend should be decomposed into focused units:

- `mission-form`: origin, targets, dates, and weighting controls
- `candidate-list`: compact comparison of returned solutions
- `time-controls`: playback speed, pause, and timeline scrubber
- `scene-root`: top-level 3D composition
- `body-renderer`: planets and dwarf planets
- `orbit-renderer`: reference orbit paths for bodies
- `trajectory-renderer`: selected mission path and progress overlay
- `spacecraft-renderer`: animated probe mesh and interaction target
- `camera-controller`: overhead and first-person camera logic
- `hud`: on-screen telemetry and fidelity notices

## 3D World and Scale Strategy

The scene must preserve scientific honesty without becoming unreadable.

The rendering strategy should be:

- heliocentric spatial layout based on real ephemeris positions
- orbit distances rendered in a common world scale derived from astronomical
  distances
- planet and dwarf-planet radii rendered in true relative proportion to one
  another
- supplemental non-physical selection halos, labels, or rings added only for
  usability

Important constraint:

If body radii and orbital distances share one strict visual scale, many bodies
will become nearly invisible at solar-system distances. The renderer should not
fake physical body sizes, but it may add explicit non-physical assistive visuals
so users can still see and select them.

## Camera and Interaction Design

The default camera mode should be a bird's-eye mission view.

Required behavior:

- the spacecraft remains at the center of the active framing target
- users can zoom in and out smoothly
- users can orbit the scene around the spacecraft
- users can reset to a stable top-down or slightly oblique overview

The spacecraft itself should be clickable.

On spacecraft click:

- switch to first-person mode
- attach the camera to the spacecraft
- orient the camera primarily along the current velocity vector
- show a small HUD with current body target, heliocentric speed, and solar
  distance

The user must be able to leave first-person mode quickly through:

- clicking the spacecraft again
- a visible UI button
- or a keyboard shortcut such as `Esc`

## Time and Playback Model

The entire scene should advance on one shared simulation clock.

That clock must drive:

- planetary and dwarf-planet positions
- spacecraft position along the sampled mission path
- timeline markers and mission event labels

Playback should support at least:

- pause
- 1x
- 10x
- 100x
- 1000x

The system should avoid recalculating Lambert solutions during frame rendering.
Playback should use precomputed sample points and interpolate smoothly between
them.

## Visualization Requirements

The scene should always show:

- the Sun
- currently relevant bodies for the selected mission
- the selected mission trajectory
- the current spacecraft position
- labels or badges for mission events such as launch, arrival, and flyby

The trajectory should be split visually into:

- a full reference path for the whole candidate mission
- a highlighted current-progress segment or marker

Candidate switching should update the path and playback state deterministically.

## Performance Strategy

The implementation should preserve responsiveness by:

- caching ephemeris responses on the backend
- using coarse-to-fine search instead of full brute-force enumeration
- precomputing trajectory samples for playback
- rendering lightweight lines and meshes in the frontend
- reducing far-distance sampling density when outer-solar-system missions become
  extremely long
- keeping hot animation loops free of network requests and heavy numerical work

## Validation and Testing Strategy

Testing should be split into four layers.

### Numerical Unit Tests

Cover:

- body constant normalization and unit conversion
- Lambert solver sanity against known transfer cases
- flyby turn-angle calculations
- trajectory sampling monotonicity and interpolation assumptions

### Mission Search Tests

Cover:

- invalid mission request rejection
- feasible and infeasible multi-leg chaining behavior
- scoring stability when weights change
- graceful handling of partial numerical failures during sampling sweeps

### API Tests

Cover:

- schema correctness for mission solve responses
- cache-hit and cache-miss behavior
- upstream ephemeris outage fallback behavior

### Frontend Interaction Tests

Cover:

- candidate selection updates the scene
- spacecraft remains centered in overview mode
- first-person camera toggles on spacecraft interaction
- playback clock updates bodies and spacecraft consistently

## Success Criteria

The first version is successful if:

- a user can choose an ordered sequence of planets and dwarf planets beginning
  at Earth
- the backend returns multiple candidate trajectories with time and delta-v
  trade-offs
- at least one candidate mission can show a gravity-assist feasibility analysis
- the frontend can play the selected mission in 3D with synchronized body and
  spacecraft motion
- the default view keeps the spacecraft centered and supports zooming
- the spacecraft can switch into and out of a first-person view
- the UI clearly explains what parts of the result are based on authoritative
  data and what parts are engineering approximations

## Open Design Constraints for Planning

These are not unresolved TODOs. They are explicit implementation choices that
the planning phase must turn into concrete tasks:

- how non-spherical or sparsely characterized dwarf planets should be given a
  stable representative display radius for rendering and flyby-clearance rules
- which Lambert algorithm variant is selected for the backend implementation
- whether mission samples are returned directly from solve responses or served
  through a follow-up endpoint backed by cache
- how dense trajectory playback sampling must be to balance smooth animation and
  payload size

## Source References

- JPL Horizons API documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- NASA NSSDC planetary fact sheets:
  https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- NASA Basics of Space Flight, Chapter 4:
  https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/
- NAIF generic kernels overview:
  https://naif.jpl.nasa.gov/naif/data_generic.html
