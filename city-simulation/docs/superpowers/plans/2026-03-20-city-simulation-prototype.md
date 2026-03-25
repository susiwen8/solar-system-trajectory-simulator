# City Simulation Prototype Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop web prototype of a top-down 3D city simulation where roads determine supply efficiency and supply stability determines population growth.

**Architecture:** Use a pure TypeScript simulation core that owns roads, buildings, logistics, and population rules, then project that state into a Three.js renderer and a small DOM HUD. Keep simulation code engine-agnostic so the core rules can be verified with Vitest before any visual wiring.

**Tech Stack:** TypeScript, Vite, Three.js, Vitest, vanilla DOM/CSS

---

## Inputs

- Spec: `docs/superpowers/specs/2026-03-20-city-simulation-design.md`
- Process skills to follow during execution: `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

## File Structure

Create these files with single, narrow responsibilities:

- `.gitignore` - ignore `node_modules`, `dist`, `.superpowers`, and coverage output
- `package.json` - scripts and dependencies for Vite, Three.js, and Vitest
- `tsconfig.json` - TypeScript compiler settings for app and tests
- `vite.config.ts` - Vite app config
- `vitest.config.ts` - Vitest config for jsdom-based tests
- `index.html` - single app mount point
- `src/main.ts` - entry point that boots the app into `#app`
- `src/styles/app.css` - base layout, HUD, and overlay styles
- `src/app/createGameApp.ts` - composition root that wires simulation, renderer, and HUD
- `src/app/gameClock.ts` - fixed-step simulation clock and render callback loop
- `src/world/buildingCatalog.ts` - building definitions, footprints, job counts, and storage caps
- `src/world/resourceTypes.ts` - resource enums and shared resource helpers
- `src/world/worldState.ts` - root world state and constructors
- `src/world/roadGraph.ts` - road nodes, road segments, connectivity, and path cost lookups
- `src/world/placeRoad.ts` - immutable-style helpers for adding and removing roads
- `src/world/placeBuilding.ts` - building placement, adjacency checks, and operational status
- `src/simulation/productionSystem.ts` - building production and local buffer updates
- `src/simulation/logisticsSystem.ts` - supply request matching and warehouse buffering
- `src/simulation/populationSystem.ts` - housing satisfaction, employment access, and growth/decline
- `src/simulation/runSimulationTick.ts` - orchestrates tick order and collects diagnostics
- `src/rendering/viewModel.ts` - derives renderer-friendly visual state from world state
- `src/rendering/createSceneView.ts` - creates Three.js scene, camera, and lights
- `src/rendering/syncSceneView.ts` - syncs meshes, warning markers, and overlays from the view model
- `src/ui/createHud.ts` - root HUD shell and DOM mounting
- `src/ui/hudState.ts` - derives top bar, side panel, and warning data from world state
- `src/ui/renderSelectionPanel.ts` - renders selected building or district details
- `src/ui/renderOverlayControls.ts` - renders overlay toggles and time controls
- `tests/unit/app/createGameApp.test.ts` - app bootstrap smoke test
- `tests/unit/world/worldState.test.ts` - world constructors and catalog invariants
- `tests/unit/world/roadGraph.test.ts` - graph connectivity and path cost tests
- `tests/unit/world/placeBuilding.test.ts` - placement and operational-status tests
- `tests/unit/simulation/productionSystem.test.ts` - resource production tests
- `tests/unit/simulation/logisticsSystem.test.ts` - nearest-provider and warehouse tests
- `tests/unit/simulation/populationSystem.test.ts` - growth, stall, and decline tests
- `tests/unit/rendering/viewModel.test.ts` - status-to-visual mapping tests
- `tests/unit/ui/hudState.test.ts` - HUD derivation tests
- `tests/integration/prototypeLoop.test.ts` - boot, tick, and HUD integration test

Keep the simulation modules free of browser and Three.js imports. Keep renderer and HUD thin by feeding them derived view state instead of raw domain logic.

## Chunk 1: Project Foundation And World State

### Task 1: Bootstrap the app shell and test harness

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles/app.css`
- Create: `src/app/createGameApp.ts`
- Test: `tests/unit/app/createGameApp.test.ts`

- [ ] **Step 1: Write the failing app bootstrap test**

```ts
import { describe, expect, it } from "vitest";
import { createGameApp } from "../../../src/app/createGameApp";

describe("createGameApp", () => {
  it("mounts the simulation shell into the app root", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.getElementById("app")!;

    const app = createGameApp(root);

    expect(root.querySelector("[data-role='city-canvas']")).not.toBeNull();
    expect(root.querySelector("[data-role='hud']")).not.toBeNull();
    expect(app.dispose).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Create the toolchain files**

Create `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `index.html`.

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install three vite vitest typescript jsdom @types/three @types/node`

Expected: npm reports packages added with no vulnerabilities that block local development.

- [ ] **Step 4: Run the bootstrap test and verify it fails**

Run: `npm run test -- --run tests/unit/app/createGameApp.test.ts`

Expected: FAIL with an import or symbol error for `createGameApp`.

- [ ] **Step 5: Implement the minimal boot shell**

Create `src/main.ts`, `src/styles/app.css`, and `src/app/createGameApp.ts` so `createGameApp(root)` mounts:

```ts
export function createGameApp(root: HTMLElement) {
  root.innerHTML = `
    <div class="app-shell">
      <canvas data-role="city-canvas"></canvas>
      <aside data-role="hud"></aside>
    </div>
  `;

  return {
    dispose() {
      root.innerHTML = "";
    },
  };
}
```

- [ ] **Step 6: Run the bootstrap test and verify it passes**

Run: `npm run test -- --run tests/unit/app/createGameApp.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 7: Commit the foundation bootstrap**

Run:

```bash
git add .gitignore package.json tsconfig.json vite.config.ts vitest.config.ts index.html src/main.ts src/styles/app.css src/app/createGameApp.ts tests/unit/app/createGameApp.test.ts
git commit -m "chore: bootstrap city simulation web prototype"
```

### Task 2: Add world primitives and building catalog

**Files:**
- Create: `src/world/resourceTypes.ts`
- Create: `src/world/buildingCatalog.ts`
- Create: `src/world/worldState.ts`
- Test: `tests/unit/world/worldState.test.ts`

- [ ] **Step 1: Write the failing world-state test**

```ts
import { describe, expect, it } from "vitest";
import { BUILDING_CATALOG } from "../../../src/world/buildingCatalog";
import { createEmptyWorldState } from "../../../src/world/worldState";

describe("createEmptyWorldState", () => {
  it("starts with no entities and known building/resource definitions", () => {
    const world = createEmptyWorldState();

    expect(world.buildings).toEqual([]);
    expect(world.roadGraph.nodes.size).toBe(0);
    expect(BUILDING_CATALOG.housing.jobs).toBe(0);
    expect(BUILDING_CATALOG.farm.produces.food).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- --run tests/unit/world/worldState.test.ts`

Expected: FAIL because the world files do not exist yet.

- [ ] **Step 3: Implement the resource, building, and world primitives**

Create:

```ts
export const RESOURCE_TYPES = ["food", "water", "materials", "labor"] as const;

export const BUILDING_CATALOG = {
  housing: { footprint: [2, 2], jobs: 0, storage: { food: 4, water: 4 } },
  farm: { footprint: [3, 3], jobs: 6, produces: { food: 6 } },
  waterStation: { footprint: [2, 2], jobs: 4, produces: { water: 8 } },
  factory: { footprint: [3, 2], jobs: 10, produces: { materials: 4 } },
  warehouse: { footprint: [2, 2], jobs: 2, storage: { food: 12, water: 12, materials: 20 } },
} as const;
```

Add `createEmptyWorldState()` with empty entity collections and selection state.

- [ ] **Step 4: Run the world-state test and verify it passes**

Run: `npm run test -- --run tests/unit/world/worldState.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the world primitives**

```bash
git add src/world/resourceTypes.ts src/world/buildingCatalog.ts src/world/worldState.ts tests/unit/world/worldState.test.ts
git commit -m "feat: add world state primitives"
```

### Task 3: Implement the road graph and path cost lookups

**Files:**
- Create: `src/world/roadGraph.ts`
- Create: `src/world/placeRoad.ts`
- Test: `tests/unit/world/roadGraph.test.ts`

- [ ] **Step 1: Write the failing road-graph tests**

```ts
import { describe, expect, it } from "vitest";
import { addRoadSegment, createRoadGraph, getShortestPathCost } from "../../../src/world/roadGraph";

describe("road graph", () => {
  it("connects segments through shared intersections", () => {
    const graph = createRoadGraph();
    addRoadSegment(graph, [0, 0], [4, 0]);
    addRoadSegment(graph, [4, 0], [8, 0]);

    expect(getShortestPathCost(graph, "0,0", "8,0")).toBe(8);
  });
});
```

- [ ] **Step 2: Run the road-graph tests and verify they fail**

Run: `npm run test -- --run tests/unit/world/roadGraph.test.ts`

Expected: FAIL because `createRoadGraph` and helpers are undefined.

- [ ] **Step 3: Implement graph creation, segment insertion, and Dijkstra lookup**

Create `src/world/roadGraph.ts` with:

```ts
export function createRoadGraph() {
  return { nodes: new Map<string, { position: [number, number]; edges: Map<string, number> }>() };
}
```

Add `addRoadSegment()` and `getShortestPathCost()` using segment length as edge weight. Use `src/world/placeRoad.ts` for world-state mutations that call the graph helpers.

- [ ] **Step 4: Add a second test for disconnection**

Add a test that requests a path between two unconnected node groups and expects `Infinity`.

- [ ] **Step 5: Run the road-graph tests and verify they pass**

Run: `npm run test -- --run tests/unit/world/roadGraph.test.ts`

Expected: PASS with both connectivity assertions green.

- [ ] **Step 6: Commit the road graph**

```bash
git add src/world/roadGraph.ts src/world/placeRoad.ts tests/unit/world/roadGraph.test.ts
git commit -m "feat: add road graph connectivity"
```

### Task 4: Implement building placement and operational connectivity

**Files:**
- Create: `src/world/placeBuilding.ts`
- Modify: `src/world/worldState.ts`
- Test: `tests/unit/world/placeBuilding.test.ts`

- [ ] **Step 1: Write the failing building-placement tests**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyWorldState } from "../../../src/world/worldState";
import { placeBuilding } from "../../../src/world/placeBuilding";
import { placeRoadSegment } from "../../../src/world/placeRoad";

describe("placeBuilding", () => {
  it("marks a building operational only when it reaches the road network", () => {
    const world = createEmptyWorldState();
    placeRoadSegment(world, [0, 0], [6, 0]);

    const connected = placeBuilding(world, { type: "housing", origin: [1, 1] });
    const disconnected = placeBuilding(world, { type: "farm", origin: [20, 20] });

    expect(connected.isOperational).toBe(true);
    expect(disconnected.isOperational).toBe(false);
  });
});
```

- [ ] **Step 2: Run the placement tests and verify they fail**

Run: `npm run test -- --run tests/unit/world/placeBuilding.test.ts`

Expected: FAIL because placement helpers are missing.

- [ ] **Step 3: Implement building placement rules**

Add `placeBuilding()` to:

- validate map bounds and collision against existing buildings
- find the nearest road access point within a small threshold
- stamp building status as `connected`, `warning`, or `disconnected`
- attach local storage buffers derived from the building catalog

- [ ] **Step 4: Add a removal/regression test**

Extend the test file with a case where removing the connecting road causes `recomputeOperationalStatus(world)` to mark the downstream building disconnected.

- [ ] **Step 5: Run the placement tests and verify they pass**

Run: `npm run test -- --run tests/unit/world/placeBuilding.test.ts`

Expected: PASS with connected and disconnected cases covered.

- [ ] **Step 6: Commit placement and connectivity**

```bash
git add src/world/placeBuilding.ts src/world/worldState.ts tests/unit/world/placeBuilding.test.ts
git commit -m "feat: add building placement and connectivity"
```

## Chunk 2: Simulation Rules

### Task 5: Implement production and local resource buffers

**Files:**
- Create: `src/simulation/productionSystem.ts`
- Modify: `src/world/worldState.ts`
- Test: `tests/unit/simulation/productionSystem.test.ts`

- [ ] **Step 1: Write the failing production tests**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyWorldState } from "../../../src/world/worldState";
import { placeRoadSegment } from "../../../src/world/placeRoad";
import { placeBuilding } from "../../../src/world/placeBuilding";
import { runProductionStep } from "../../../src/simulation/productionSystem";

describe("runProductionStep", () => {
  it("lets operational farms add food into their local buffer", () => {
    const world = createEmptyWorldState();
    placeRoadSegment(world, [0, 0], [6, 0]);
    const farm = placeBuilding(world, { type: "farm", origin: [1, 1] });

    runProductionStep(world);

    expect(farm.buffer.food).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the production tests and verify they fail**

Run: `npm run test -- --run tests/unit/simulation/productionSystem.test.ts`

Expected: FAIL because `runProductionStep` is missing.

- [ ] **Step 3: Implement the minimal production rules**

Create `runProductionStep(world)` to:

- skip disconnected buildings
- add food for farms
- add water for water stations
- add materials for factories only when labor and water requirements are met
- expose per-building diagnostics such as `lastProductionBlockedBy`

- [ ] **Step 4: Add a blocked-factory test**

Add a test where a factory without labor or water produces no materials and records the blocking reason.

- [ ] **Step 5: Run the production tests and verify they pass**

Run: `npm run test -- --run tests/unit/simulation/productionSystem.test.ts`

Expected: PASS with farm output and blocked factory behavior covered.

- [ ] **Step 6: Commit the production system**

```bash
git add src/simulation/productionSystem.ts src/world/worldState.ts tests/unit/simulation/productionSystem.test.ts
git commit -m "feat: add resource production rules"
```

### Task 6: Implement logistics resolution and warehouse buffering

**Files:**
- Create: `src/simulation/logisticsSystem.ts`
- Test: `tests/unit/simulation/logisticsSystem.test.ts`

- [ ] **Step 1: Write the failing logistics tests**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyWorldState } from "../../../src/world/worldState";
import { placeRoadSegment } from "../../../src/world/placeRoad";
import { placeBuilding } from "../../../src/world/placeBuilding";
import { resolveLogisticsStep } from "../../../src/simulation/logisticsSystem";

describe("resolveLogisticsStep", () => {
  it("chooses the lowest-cost reachable provider", () => {
    const world = createEmptyWorldState();
    placeRoadSegment(world, [0, 0], [4, 0]);
    placeRoadSegment(world, [4, 0], [8, 0]);
    placeRoadSegment(world, [4, 0], [4, 4]);
    placeRoadSegment(world, [0, 4], [4, 4]);
    placeRoadSegment(world, [4, 4], [8, 4]);

    const providerA = placeBuilding(world, { type: "farm", origin: [1, 1], id: "provider-a" });
    const providerB = placeBuilding(world, { type: "farm", origin: [1, 5], id: "provider-b" });
    const housing = placeBuilding(world, { type: "housing", origin: [6, 1], id: "housing-a" });

    providerA.buffer.food = 10;
    providerB.buffer.food = 10;
    housing.population = 8;
    housing.buffer.food = 0;

    const report = resolveLogisticsStep(world);

    expect(report.deliveries[0].providerId).toBe("provider-a");
  });
});
```

- [ ] **Step 2: Run the logistics tests and verify they fail**

Run: `npm run test -- --run tests/unit/simulation/logisticsSystem.test.ts`

Expected: FAIL because logistics resolution is not implemented.

- [ ] **Step 3: Implement request matching and distance-based efficiency**

Create `resolveLogisticsStep(world)` so that it:

- gathers resource requests from housing and factories
- finds reachable providers through the road graph
- ranks providers by path cost and available stock
- moves resources into consumer buffers with a simple distance penalty
- returns delivery diagnostics for HUD messaging

- [ ] **Step 4: Add a warehouse stabilization test**

Add a test that inserts a warehouse between a distant farm and a housing block and verifies the housing receives more consistent food over repeated ticks.

- [ ] **Step 5: Run the logistics tests and verify they pass**

Run: `npm run test -- --run tests/unit/simulation/logisticsSystem.test.ts`

Expected: PASS with nearest-provider and warehouse-buffering cases green.

- [ ] **Step 6: Commit the logistics system**

```bash
git add src/simulation/logisticsSystem.ts tests/unit/simulation/logisticsSystem.test.ts
git commit -m "feat: add automatic logistics resolution"
```

### Task 7: Implement population, employment access, and district outcomes

**Files:**
- Create: `src/simulation/populationSystem.ts`
- Create: `src/simulation/runSimulationTick.ts`
- Test: `tests/unit/simulation/populationSystem.test.ts`

- [ ] **Step 1: Write the failing population tests**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyWorldState } from "../../../src/world/worldState";
import { placeRoadSegment } from "../../../src/world/placeRoad";
import { placeBuilding } from "../../../src/world/placeBuilding";
import { runPopulationStep } from "../../../src/simulation/populationSystem";

describe("runPopulationStep", () => {
  it("grows connected housing with food, water, and jobs", () => {
    const world = createEmptyWorldState();
    placeRoadSegment(world, [0, 0], [10, 0]);
    const housing = placeBuilding(world, { type: "housing", origin: [1, 1] });
    placeBuilding(world, { type: "factory", origin: [5, 1] });

    housing.population = 8;
    housing.capacity = 16;
    housing.buffer.food = 8;
    housing.buffer.water = 8;

    runPopulationStep(world);

    expect(housing.population).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 2: Run the population tests and verify they fail**

Run: `npm run test -- --run tests/unit/simulation/populationSystem.test.ts`

Expected: FAIL because the population system does not exist.

- [ ] **Step 3: Implement housing satisfaction and employment access**

Create `runPopulationStep(world)` to:

- calculate recent food and water satisfaction per housing building
- compute reachable jobs from connected non-housing buildings
- derive a stability score
- grow population when all thresholds are healthy
- stall or decline population when shortages persist

- [ ] **Step 4: Implement the simulation orchestrator**

Create `runSimulationTick(world)` with this order:

```ts
refreshConnectivity(world);
runProductionStep(world);
resolveLogisticsStep(world);
runPopulationStep(world);
return collectSimulationReport(world);
```

- [ ] **Step 5: Add decline and unemployment tests**

Add tests that verify:

- housing stops growing when water is missing
- prolonged unemployment causes decline
- disconnected housing remains stagnant even when global stock exists

- [ ] **Step 6: Run the population tests and verify they pass**

Run: `npm run test -- --run tests/unit/simulation/populationSystem.test.ts`

Expected: PASS with growth, stall, and decline scenarios covered.

- [ ] **Step 7: Commit the simulation loop**

```bash
git add src/simulation/populationSystem.ts src/simulation/runSimulationTick.ts tests/unit/simulation/populationSystem.test.ts
git commit -m "feat: add population and tick simulation"
```

## Chunk 3: Rendering, HUD, And Integration

### Task 8: Derive renderer state and create the Three.js scene shell

**Files:**
- Create: `src/rendering/viewModel.ts`
- Create: `src/rendering/createSceneView.ts`
- Create: `src/rendering/syncSceneView.ts`
- Test: `tests/unit/rendering/viewModel.test.ts`

- [ ] **Step 1: Write the failing renderer-view-model tests**

```ts
import { describe, expect, it } from "vitest";
import { deriveViewModel } from "../../../src/rendering/viewModel";

describe("deriveViewModel", () => {
  it("maps disconnected buildings to warning markers", () => {
    const model = deriveViewModel({
      buildings: [{ id: "b1", type: "housing", status: "disconnected", population: 12 }],
      overlays: { mode: "connectivity" },
    } as any);

    expect(model.warnings[0].tone).toBe("danger");
  });
});
```

- [ ] **Step 2: Run the renderer-view-model tests and verify they fail**

Run: `npm run test -- --run tests/unit/rendering/viewModel.test.ts`

Expected: FAIL because the renderer derivation files do not exist.

- [ ] **Step 3: Implement the pure renderer derivation**

Create `deriveViewModel(world, uiState)` that returns:

- road segment draw data
- building mesh descriptors
- warning markers
- overlay tint values for supply, growth, and connectivity modes

- [ ] **Step 4: Implement the Three.js scene shell**

Create `createSceneView(canvas)` with an orthographic or shallow-perspective camera, directional light, ambient light, and a root scene group. Keep all scene mutation in `syncSceneView(view, model)`.

- [ ] **Step 5: Run the renderer-view-model tests and verify they pass**

Run: `npm run test -- --run tests/unit/rendering/viewModel.test.ts`

Expected: PASS with warning/overlay mapping covered.

- [ ] **Step 6: Commit the renderer shell**

```bash
git add src/rendering/viewModel.ts src/rendering/createSceneView.ts src/rendering/syncSceneView.ts tests/unit/rendering/viewModel.test.ts
git commit -m "feat: add city renderer shell"
```

### Task 9: Build the HUD, selection panel, and overlay controls

**Files:**
- Create: `src/ui/hudState.ts`
- Create: `src/ui/createHud.ts`
- Create: `src/ui/renderSelectionPanel.ts`
- Create: `src/ui/renderOverlayControls.ts`
- Modify: `src/styles/app.css`
- Test: `tests/unit/ui/hudState.test.ts`

- [ ] **Step 1: Write the failing HUD-state tests**

```ts
import { describe, expect, it } from "vitest";
import { deriveHudState } from "../../../src/ui/hudState";

describe("deriveHudState", () => {
  it("surfaces top-level shortages and selected-building diagnostics", () => {
    const hud = deriveHudState({
      totals: { population: 120, foodDelta: -2, waterDelta: 4 },
      selectedBuilding: { id: "h1", shortages: ["water"], employmentAccess: 0.4 },
    } as any);

    expect(hud.topBar.population).toBe(120);
    expect(hud.selection.warnings).toContain("water");
  });
});
```

- [ ] **Step 2: Run the HUD-state tests and verify they fail**

Run: `npm run test -- --run tests/unit/ui/hudState.test.ts`

Expected: FAIL because the HUD derivation files do not exist.

- [ ] **Step 3: Implement HUD derivation and rendering**

Create:

- `deriveHudState(world, selection, overlayMode)` for top bar, event strip, and right panel data
- `createHud(root)` to mount the left build palette, top metrics, bottom event strip, and right detail panel
- `renderSelectionPanel()` to show shortages, job access, and growth trend
- `renderOverlayControls()` to switch between supply, growth, and connectivity overlays

- [ ] **Step 4: Wire the HUD into `createGameApp`**

Update `src/app/createGameApp.ts` so it owns:

- current overlay mode
- selected building id
- time speed and pause state
- HUD event handlers that request re-rendering

- [ ] **Step 5: Run the HUD-state tests and verify they pass**

Run: `npm run test -- --run tests/unit/ui/hudState.test.ts`

Expected: PASS with top bar and selection warnings covered.

- [ ] **Step 6: Commit the HUD**

```bash
git add src/ui/hudState.ts src/ui/createHud.ts src/ui/renderSelectionPanel.ts src/ui/renderOverlayControls.ts src/app/createGameApp.ts src/styles/app.css tests/unit/ui/hudState.test.ts
git commit -m "feat: add hud and overlay controls"
```

### Task 10: Integrate the game loop, interaction flow, and end-to-end verification

**Files:**
- Create: `src/app/gameClock.ts`
- Modify: `src/app/createGameApp.ts`
- Modify: `src/world/placeRoad.ts`
- Modify: `src/world/placeBuilding.ts`
- Test: `tests/integration/prototypeLoop.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import { describe, expect, it } from "vitest";
import { createGameApp } from "../../src/app/createGameApp";

describe("prototype loop", () => {
  it("boots, advances simulation ticks, and refreshes HUD warnings", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = createGameApp(document.getElementById("app")!);

    app.debug.placeRoad([0, 0], [6, 0]);
    app.debug.placeBuilding({ type: "housing", origin: [1, 1] });
    app.debug.tick(3);

    expect(app.debug.getHudState().topBar.population).toBeGreaterThanOrEqual(0);
    app.dispose();
  });
});
```

- [ ] **Step 2: Run the integration test and verify it fails**

Run: `npm run test -- --run tests/integration/prototypeLoop.test.ts`

Expected: FAIL because the debug harness and game clock are not wired yet.

- [ ] **Step 3: Implement the fixed-step clock and debug hooks**

Create `src/app/gameClock.ts` with a fixed simulation step and render callback. Expose a small `debug` surface from `createGameApp()` for tests:

- `placeRoad(start, end)`
- `placeBuilding(input)`
- `tick(count)`
- `getHudState()`

- [ ] **Step 4: Connect renderer, HUD, and simulation updates**

Update `createGameApp()` to:

- initialize empty world state
- create the scene view and HUD
- run `runSimulationTick(world)` on the fixed clock
- call `deriveViewModel()` and `deriveHudState()` after each tick
- refresh scene and HUD on selection or overlay changes

- [ ] **Step 5: Run the integration test and the full suite**

Run: `npm run test -- --run tests/integration/prototypeLoop.test.ts`

Expected: PASS with the prototype loop test green.

Run: `npm run test -- --run`

Expected: PASS with all unit and integration tests green.

- [ ] **Step 6: Run a production build**

Run: `npm run build`

Expected: PASS with Vite output under `dist/`.

- [ ] **Step 7: Manually verify the prototype**

Run: `npm run dev`

Manual checklist:

- place roads and see them appear in the 3D view
- place housing, farms, water stations, factories, and warehouses
- confirm disconnected buildings show warnings
- confirm overlay toggles change scene coloring
- confirm population stalls when essentials are missing
- confirm warehouses improve remote district stability

- [ ] **Step 8: Commit the integrated prototype**

```bash
git add src/app/gameClock.ts src/app/createGameApp.ts src/world/placeRoad.ts src/world/placeBuilding.ts tests/integration/prototypeLoop.test.ts
git commit -m "feat: integrate city simulation prototype loop"
```

## Local Review Checklist

Before execution, verify this plan against the spec:

- no tasks introduce congestion, taxes, disasters, or per-vehicle simulation
- every simulation rule that affects population has a unit test before implementation
- renderer and HUD only consume derived state, not raw simulation internals
- each commit leaves the app in a runnable state
- `.superpowers/` remains ignored and uncommitted

## Done Criteria

The implementation is ready to demo when:

- a player can place roads and key buildings on a flat map
- logistics resolve automatically through the road network
- housing growth and decline respond to actual food, water, and job access
- the 3D city view shows warnings and overlay state clearly
- HUD panels explain why a district is healthy, stressed, or failing
- tests and production build pass

Plan complete and saved to `docs/superpowers/plans/2026-03-20-city-simulation-prototype.md`. Ready to execute?
