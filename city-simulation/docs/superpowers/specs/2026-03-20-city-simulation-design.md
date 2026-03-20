# City Simulation Prototype Design

Date: 2026-03-20
Status: Approved for planning

## Overview

This project is a 3D city simulation game prototype focused on the relationship
between material supply, road layout, and population growth.

The chosen direction is:

- Top-down miniature 3D city presentation
- Continuous road network instead of isolated grid-only logistics
- Light-management gameplay
- Automatic logistics resolution
- Strong visual feedback for supply problems and growth trends

The main player fantasy is:

Build a city whose roads, production sites, storage, and housing form a working
supply network. Population growth should feel earned through good layout and
stable access to essentials, not through abstract score bonuses.

## Goals

- Show clear cause-and-effect between road structure, supply efficiency, and
  population change
- Let players build and read a city from a top-down 3D view
- Make logistics visible without requiring manual vehicle management
- Keep the first playable version narrow enough to prototype quickly
- Build the simulation in a way that can later support deeper systems

## Non-Goals

- No multi-level roads, bridges, tunnels, or terrain height in the first version
- No manual route drawing, vehicle assignment, or per-truck management
- No detailed traffic congestion simulation in the first version
- No complex finance, taxation, politics, or policy systems in the first version
- No realistic citizen agent simulation

## Core Experience

The player spends most of their time doing four actions:

1. Place roads to connect the city
2. Place housing to attract and hold population
3. Place production buildings to create essentials and building materials
4. Place storage and support buildings to stabilize long-distance supply

The core simulation loop is:

`road structure -> transport efficiency -> supply coverage -> population change -> new city demands`

The intended player learning loop is:

- Notice a city district is stagnating or shrinking
- Inspect which essential or connection is failing
- Improve layout with roads, production, or storage
- Watch stability return and growth resume

## Prototype Scope

The first playable prototype should include:

- A flat city map
- A controllable top-down 3D camera
- Road placement
- Building placement and removal
- Automatic supply routing through roads
- Population growth and decline driven by actual supply conditions
- HUD panels that explain why a district is growing or failing
- Heatmaps or overlays for supply and connectivity

The first playable prototype should not include:

- Saving/loading beyond basic local prototype support
- Disasters, weather, seasons with mechanical depth, or combat
- Advanced economy layers such as taxes or trade markets
- Visual polish that obscures system readability

## Simulation Systems

### Building Types

The first version should keep the building roster small and legible:

- Housing: creates residential capacity, hosts population, consumes essentials
- Farm: produces food
- Water Station: produces water
- Factory: produces building materials, consumes labor and possibly water
- Warehouse: buffers and redistributes storable resources

Additional buildings can be added later, but these are enough to express the
material-population loop.

### Resources

The initial resource model should use four core resource categories:

- Food: required by housing on an ongoing basis
- Water: required by housing and some production buildings
- Building Materials: required when constructing or expanding the city
- Labor: provided by population; not warehoused, but required for production

These resources create the desired tension:

- More population increases labor supply
- More population also raises food and water demand
- More buildings require both construction materials and reachable labor

### Population Rules

Population should be simulated at the district or building level, not per-person.

Housing tracks:

- Current population
- Capacity
- Recent food satisfaction
- Recent water satisfaction
- Recent job access
- A derived stability or happiness score

Population behavior:

- If housing has free capacity and stable access to essentials and jobs,
  population grows gradually
- If essentials are missing or job access is too low, growth pauses
- If poor conditions persist, population declines and residents leave

Employment rule:

- Non-housing operational buildings create jobs
- Housing evaluates job access through reachable connected workplaces
- Job access is based on whether enough employment exists within acceptable
  network cost, not on individual citizen pathfinding

This makes population feel like a downstream result of city health rather than
an independently tuned score.

### Road Network

The city should use a continuous road graph:

- Intersections become graph nodes
- Road segments become weighted edges
- Buildings connect to the road graph through nearby access points

The first version only needs to model:

- Whether a building is connected to the road network
- Path distance between buildings and supply points
- A base transport efficiency derived from path length and route quality

The first version does not need:

- Lane simulation
- Per-car traffic
- Dynamic congestion from vehicle counts

This preserves the feeling of networked logistics without turning the prototype
into a transport simulator.

### Placement Rules

Placement should stay simple and readable:

- Roads are placed as connected segments on the flat map
- Buildings are placed on valid ground near a road access point
- A building becomes operational only when its access point is connected to the
  road network
- Removing a road can disconnect downstream buildings and immediately affect
  supply and job access

This keeps the placement model understandable while preserving meaningful
network consequences.

### Logistics Resolution

Resource movement should be automatic and tick-based.

Suggested resolution model:

1. Producers add output into their local storage buffer
2. Consumers request resources from reachable providers
3. The simulation chooses the best reachable provider based on connection and
   path cost
4. Delivery effectiveness is reduced by route distance
5. Warehouses act as intermediate buffers and stabilize long routes

Important design principle:

Global production being sufficient must not guarantee local stability. A district
can still fail if supply has to travel too far or the network is poorly shaped.

That is the main source of strategic depth in the prototype.

## World Model

The world state should be organized around a small set of focused models:

- `RoadNode`: graph node with world position and adjacency
- `RoadSegment`: connection between nodes with length and transport cost
- `Building`: type, footprint, connection point, local storage, and status
- `DistrictState`: aggregated population and satisfaction metrics for an area
- `ResourceBuffer`: amount, capacity, and resource type data
- `SimulationState`: global container for map entities, tick timing, and metrics

These models should stay engine-agnostic so the simulation can be tested without
the renderer.

## Player Interaction and HUD

The interface should prioritize explanation over decoration.

Recommended layout:

- Left side: construction palette for roads and buildings
- Center: top-down 3D city view
- Right side: selected building or district detail panel
- Top bar: population, core resource trends, employment, time controls
- Bottom strip: event messages and short trend summaries

The player should always be able to answer three questions quickly:

1. Where is supply failing?
2. Which areas are disconnected or inefficiently connected?
3. Which districts are growing, stable, or shrinking?

Required first-version feedback:

- In-world warning labels for disconnected or undersupplied buildings
- Overlay or heatmap toggles for connectivity, supply coverage, and growth
- Detail panel showing exact local shortages and likely causes
- High-level trend display for total population and key resources

## Rendering Direction

The renderer should emphasize readability:

- Top-down miniature city view with moderate tilt if needed for depth cues
- Simplified but distinct building silhouettes
- Strong color language for healthy, stressed, and failing areas
- Lightweight animations for growth, warning states, and route flow indicators

The art direction should support comprehension first. Realism is less important
than making the simulation legible.

## Technical Architecture

Recommended stack:

- TypeScript
- Vite
- Three.js

Recommended module boundaries:

- `simulation/`: pure simulation rules, tick processing, and tests
- `world/`: map entities, state containers, and placement logic
- `rendering/`: Three.js scene, camera, meshes, overlays, and visual markers
- `ui/`: HUD panels, build menu, detail views, and time controls
- `app/`: orchestration, input routing, and game bootstrapping

Key architecture principle:

The simulation must not depend on Three.js. Rendering and UI consume simulation
state, but the simulation should remain independently testable.

## Tick and Frame Model

Rendering and simulation should run on separate rhythms:

- Render loop: updates camera, animation, cursor feedback, and scene visuals
- Simulation tick: runs at a fixed step, such as 2 to 4 ticks per second

Suggested simulation tick order:

1. Rebuild or refresh road connectivity if the network changed
2. Resolve production outputs
3. Resolve warehousing and supply requests
4. Resolve housing consumption
5. Update employment access and district stability
6. Apply population growth or decline
7. Emit UI events and update overlays

This separation improves determinism, debugging, and iteration speed.

## Error Handling and Edge Cases

The prototype should explain failures instead of hiding them.

Important cases:

- Unconnected building: clearly mark as disconnected
- Sufficient global resource but failing local district: show distance or route
  quality as the reason
- No labor access: show labor shortage separately from material shortage
- Full warehouse or empty provider: surface that state in the detail panel
- Invalid placement: show placement preview and reason for rejection

The player should almost always understand why the city is struggling.

## Testing Strategy

The first version should prioritize tests for simulation logic.

Unit tests should cover:

- Housing stops growing when food is missing
- Housing stops growing when water is missing
- Long routes reduce supply reliability compared to short routes
- Adding a warehouse improves remote district stability
- Prolonged low employment triggers decline or stalled growth
- Disconnected buildings remain inactive

Integration checks should cover:

- Building placement updates the world model correctly
- Road edits refresh connectivity and downstream supply outcomes
- HUD state matches simulation state for selected buildings or districts

## Risks and Mitigations

### Risk: the continuous road model becomes too expensive or complex

Mitigation:

- Keep route logic simple and deterministic
- Recompute only when topology changes if possible
- Avoid per-vehicle simulation in the prototype

### Risk: the game feels abstract despite being 3D

Mitigation:

- Use in-world warnings and visible growth/failure states
- Make roads and supply relationships visually prominent
- Add overlays that directly explain simulation state

### Risk: the first version becomes too broad

Mitigation:

- Keep the building set minimal
- Exclude congestion, policy, and fine-grained economic systems
- Focus all design decisions on the core loop

## Milestone Shape

The implementation plan should likely break work into these slices:

1. Project setup with scene, camera, input, and map foundation
2. Road placement and world state modeling
3. Building placement and basic resource production/consumption
4. Road-based supply resolution and district population rules
5. HUD, overlays, and diagnostics
6. Balancing, tests, and prototype polish

## Open Assumptions

- The prototype targets desktop web first
- Mouse-first controls are acceptable for the initial version
- The first milestone values clarity over audiovisual polish
- Warehouses are the main stabilizer for long-distance logistics in version one

## Summary

This prototype should feel like a readable, systemic city model rather than a
fully realistic city builder. The defining promise is that city form matters:
roads and layout determine whether production actually reaches people, and that
directly determines whether the population thrives or declines.
