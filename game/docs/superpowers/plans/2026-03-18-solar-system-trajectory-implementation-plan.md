# Solar System Trajectory Simulator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an accuracy-first solar-system mission simulator with a Python astrodynamics API and a TypeScript 3D web client that can propagate an Earth-origin probe trajectory to any supported planet using bundled real ephemeris data.

**Architecture:** Keep numerical propagation and ephemeris access in a dedicated FastAPI service, and keep the web app focused on mission input, 3D rendering, and result playback. Start with explicit initial-state propagation, then leave stable interfaces for later transfer-search features without implementing them yet.

**Tech Stack:** FastAPI, Pydantic, NumPy, SciPy, pytest, Python 3.12, React, TypeScript, Vite, Three.js, @react-three/fiber, React Testing Library, Vitest

---

## Planned File Structure

### Repository Root

- Create: `.gitignore`
- Create: `README.md`
- Create: `Makefile`
- Create: `apps/api/`
- Create: `apps/web/`
- Create: `docs/superpowers/specs/2026-03-18-solar-system-trajectory-design.md`
- Create: `docs/superpowers/plans/2026-03-18-solar-system-trajectory-implementation-plan.md`

### Backend

- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/main.py`
- Create: `apps/api/app/api/routes_missions.py`
- Create: `apps/api/app/api/routes_ephemeris.py`
- Create: `apps/api/app/schemas/mission.py`
- Create: `apps/api/app/core/units.py`
- Create: `apps/api/app/core/constants.py`
- Create: `apps/api/app/core/ephemeris/base.py`
- Create: `apps/api/app/core/ephemeris/bundled.py`
- Create: `apps/api/app/core/dynamics/acceleration.py`
- Create: `apps/api/app/core/dynamics/propagator.py`
- Create: `apps/api/app/core/dynamics/events.py`
- Create: `apps/api/app/services/mission_service.py`
- Create: `apps/api/data/ephemeris/major_bodies.json`
- Create: `apps/api/tests/api/test_ephemeris_bodies.py`
- Create: `apps/api/tests/api/test_missions_validate_initial_state.py`
- Create: `apps/api/tests/api/test_missions_propagate.py`
- Create: `apps/api/tests/unit/test_units.py`
- Create: `apps/api/tests/unit/test_bundled_ephemeris.py`
- Create: `apps/api/tests/unit/test_acceleration.py`
- Create: `apps/api/tests/unit/test_propagator_two_body.py`
- Create: `apps/api/tests/unit/test_mission_service.py`
- Create: `apps/api/tests/fixtures/reference_states.json`

### Frontend

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/features/mission/types.ts`
- Create: `apps/web/src/features/mission/components/MissionForm.tsx`
- Create: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Create: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Create: `apps/web/src/features/scene/lib/scale.ts`
- Create: `apps/web/src/features/scene/lib/trajectory.ts`
- Create: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Create: `apps/web/src/App.test.tsx`

## Chunk 1: Workspace And Backend Foundations

### Task 1: Bootstrap The Monorepo And Test Harness

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `Makefile`
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/main.py`
- Create: `apps/api/tests/api/test_health.py`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing backend and frontend smoke tests**

```python
# apps/api/tests/api/test_health.py
from fastapi.testclient import TestClient
from app.main import app


def test_health_check_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

```tsx
// apps/web/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the simulator heading", () => {
  render(<App />);
  expect(screen.getByText("Solar System Trajectory Simulator")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the smoke tests to verify they fail**

Run: `cd apps/api && uv run pytest tests/api/test_health.py -v`  
Expected: FAIL because `app.main` or `/healthz` does not exist

Run: `cd apps/web && pnpm test -- --runInBand App.test.tsx`  
Expected: FAIL because the Vite app and test setup do not exist yet

- [ ] **Step 3: Add the minimal workspace scaffolding to make the tests pass**

```python
# apps/api/app/main.py
from fastapi import FastAPI

app = FastAPI(title="Solar System Trajectory API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
```

```tsx
// apps/web/src/App.tsx
export default function App() {
  return <h1>Solar System Trajectory Simulator</h1>;
}
```

Also add:

- `.gitignore` for `.venv`, `node_modules`, `dist`, `.pytest_cache`, `.DS_Store`
- `Makefile` targets for `api-test`, `web-test`, `api-dev`, `web-dev`
- `apps/api/pyproject.toml` with FastAPI, NumPy, SciPy, pytest
- `apps/web/package.json` with React, Vite, Vitest, Testing Library, Three.js dependencies

- [ ] **Step 4: Run the smoke tests to verify the skeleton works**

Run: `cd apps/api && uv run pytest tests/api/test_health.py -v`  
Expected: PASS

Run: `cd apps/web && pnpm test -- --runInBand App.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit the bootstrap**

```bash
git add .gitignore README.md Makefile apps/api apps/web
git commit -m "chore: bootstrap api and web workspaces"
```

### Task 2: Add Units, Body Catalog, And Bundled Ephemeris Loading

**Files:**
- Create: `apps/api/app/core/units.py`
- Create: `apps/api/app/core/constants.py`
- Create: `apps/api/app/core/ephemeris/base.py`
- Create: `apps/api/app/core/ephemeris/bundled.py`
- Create: `apps/api/data/ephemeris/major_bodies.json`
- Create: `apps/api/tests/unit/test_units.py`
- Create: `apps/api/tests/unit/test_bundled_ephemeris.py`
- Create: `apps/api/tests/fixtures/reference_states.json`

- [ ] **Step 1: Write failing tests for time normalization and body-state lookup**

```python
# apps/api/tests/unit/test_units.py
from app.core.units import seconds_since_j2000


def test_seconds_since_j2000_for_reference_epoch() -> None:
    assert seconds_since_j2000("2000-01-01T12:00:00Z") == 0.0
```

```python
# apps/api/tests/unit/test_bundled_ephemeris.py
from app.core.ephemeris.bundled import BundledEphemeris


def test_bundled_ephemeris_returns_earth_state() -> None:
    ephemeris = BundledEphemeris("data/ephemeris/major_bodies.json")
    state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    assert state.body_id == "earth"
    assert len(state.position_km) == 3
    assert len(state.velocity_km_per_s) == 3
```

- [ ] **Step 2: Run the unit tests and confirm they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_units.py tests/unit/test_bundled_ephemeris.py -v`  
Expected: FAIL because the units and ephemeris modules do not exist

- [ ] **Step 3: Implement the body constants and bundled ephemeris loader**

```python
# apps/api/app/core/ephemeris/base.py
from dataclasses import dataclass


@dataclass(frozen=True)
class BodyState:
    body_id: str
    epoch: str
    position_km: tuple[float, float, float]
    velocity_km_per_s: tuple[float, float, float]
    mu_km3_per_s2: float
```

```python
# apps/api/app/core/units.py
from datetime import datetime, timezone

J2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


def seconds_since_j2000(epoch: str) -> float:
    current = datetime.fromisoformat(epoch.replace("Z", "+00:00"))
    return (current - J2000).total_seconds()
```

```python
# apps/api/app/core/ephemeris/bundled.py
class BundledEphemeris:
    def __init__(self, data_path: str) -> None: ...

    def get_body_state(self, body_id: str, epoch: str) -> BodyState: ...
```

Use `major_bodies.json` as a small preprocessed fixture containing Sun and major planets with interpolation-ready state samples for at least a few reference epochs.

- [ ] **Step 4: Run the unit tests and extend them until the loader is stable**

Run: `cd apps/api && uv run pytest tests/unit/test_units.py tests/unit/test_bundled_ephemeris.py -v`  
Expected: PASS

- [ ] **Step 5: Commit the ephemeris foundation**

```bash
git add apps/api/app/core apps/api/data/ephemeris apps/api/tests/unit apps/api/tests/fixtures
git commit -m "feat: add bundled ephemeris foundation"
```

### Task 3: Implement The Probe Force Model And Two-Body Propagator

**Files:**
- Create: `apps/api/app/core/dynamics/acceleration.py`
- Create: `apps/api/app/core/dynamics/propagator.py`
- Create: `apps/api/tests/unit/test_acceleration.py`
- Create: `apps/api/tests/unit/test_propagator_two_body.py`

- [ ] **Step 1: Write failing tests for solar gravity and two-body propagation**

```python
# apps/api/tests/unit/test_acceleration.py
import numpy as np
from app.core.dynamics.acceleration import point_mass_acceleration


def test_point_mass_acceleration_points_toward_origin() -> None:
    acc = point_mass_acceleration(
        body_position=np.array([0.0, 0.0, 0.0]),
        probe_position=np.array([1.0e8, 0.0, 0.0]),
        mu=1.32712440018e11,
    )

    assert acc[0] < 0.0
    assert acc[1] == 0.0
    assert acc[2] == 0.0
```

```python
# apps/api/tests/unit/test_propagator_two_body.py
from app.core.dynamics.propagator import propagate_two_body_reference_case


def test_two_body_reference_case_returns_ordered_samples() -> None:
    result = propagate_two_body_reference_case()

    assert len(result.samples) > 10
    assert result.samples[0].epoch < result.samples[-1].epoch
```

- [ ] **Step 2: Run the physics tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_acceleration.py tests/unit/test_propagator_two_body.py -v`  
Expected: FAIL because the dynamics modules are not implemented

- [ ] **Step 3: Implement the minimal force model and adaptive propagator**

```python
# apps/api/app/core/dynamics/acceleration.py
import numpy as np


def point_mass_acceleration(body_position: np.ndarray, probe_position: np.ndarray, mu: float) -> np.ndarray:
    delta = body_position - probe_position
    radius = np.linalg.norm(delta)
    return mu * delta / radius**3
```

```python
# apps/api/app/core/dynamics/propagator.py
from scipy.integrate import solve_ivp


def propagate_state(*, initial_state, t_span, sample_step_s, acceleration_fn, rtol, atol):
    return solve_ivp(...)
```

The first implementation should support:

- a state vector `[x, y, z, vx, vy, vz]`
- adaptive integration via `solve_ivp`
- decoupled output sampling
- a test-only two-body helper to validate the engine before multi-body work

- [ ] **Step 4: Run the unit tests and add one energy-stability assertion**

Run: `cd apps/api && uv run pytest tests/unit/test_acceleration.py tests/unit/test_propagator_two_body.py -v`  
Expected: PASS

Then extend `test_propagator_two_body.py` with an orbital-energy drift bound and rerun the same command.  
Expected: PASS with a documented tolerance

- [ ] **Step 5: Commit the propagation core**

```bash
git add apps/api/app/core/dynamics apps/api/tests/unit/test_acceleration.py apps/api/tests/unit/test_propagator_two_body.py
git commit -m "feat: add probe propagator core"
```

## Chunk 2: Mission Domain And API

### Task 4: Add Mission Schemas And Initial-State Validation

**Files:**
- Create: `apps/api/app/schemas/mission.py`
- Create: `apps/api/app/api/routes_missions.py`
- Create: `apps/api/tests/api/test_missions_validate_initial_state.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write the failing API tests for validation**

```python
# apps/api/tests/api/test_missions_validate_initial_state.py
from fastapi.testclient import TestClient
from app.main import app


def test_validate_initial_state_rejects_missing_velocity() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/validate-initial-state",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-10-15T00:00:00Z",
            "initialState": {"stateVector": {"positionKm": [1, 2, 3]}},
            "durationSeconds": 86400,
            "outputStepSeconds": 3600,
        },
    )

    assert response.status_code == 422
```

- [ ] **Step 2: Run the validation test to confirm it fails**

Run: `cd apps/api && uv run pytest tests/api/test_missions_validate_initial_state.py -v`  
Expected: FAIL because the route and schemas do not exist

- [ ] **Step 3: Implement mission request models and validation rules**

```python
# apps/api/app/schemas/mission.py
from pydantic import BaseModel, Field, model_validator


class StateVectorInput(BaseModel):
    positionKm: tuple[float, float, float]
    velocityKmPerSec: tuple[float, float, float]


class InitialStateInput(BaseModel):
    stateVector: StateVectorInput | None = None
    launchFromBody: dict | None = None

    @model_validator(mode="after")
    def ensure_one_mode(self):
        if (self.stateVector is None) == (self.launchFromBody is None):
            raise ValueError("Provide exactly one initial-state mode")
        return self
```

```python
# apps/api/app/api/routes_missions.py
from fastapi import APIRouter

router = APIRouter(prefix="/missions", tags=["missions"])


@router.post("/validate-initial-state", status_code=204)
def validate_initial_state(_: MissionRequest) -> None:
    return None
```

Wire the router in `app.main`.

- [ ] **Step 4: Run the validation tests and add success-case coverage**

Run: `cd apps/api && uv run pytest tests/api/test_missions_validate_initial_state.py -v`  
Expected: PASS

Then add a success test for a valid `stateVector` payload and rerun the same command.  
Expected: PASS

- [ ] **Step 5: Commit the mission schema layer**

```bash
git add apps/api/app/schemas apps/api/app/api/routes_missions.py apps/api/app/main.py apps/api/tests/api/test_missions_validate_initial_state.py
git commit -m "feat: add mission validation endpoint"
```

### Task 5: Build Mission Propagation Service And API Endpoint

**Files:**
- Create: `apps/api/app/services/mission_service.py`
- Create: `apps/api/app/core/dynamics/events.py`
- Create: `apps/api/tests/unit/test_mission_service.py`
- Create: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Modify: `apps/api/app/core/dynamics/propagator.py`

- [ ] **Step 1: Write failing service and API tests for propagation output**

```python
# apps/api/tests/unit/test_mission_service.py
from app.services.mission_service import MissionService


def test_mission_service_returns_closest_approach_metric(bundled_ephemeris) -> None:
    service = MissionService(ephemeris=bundled_ephemeris)
    result = service.propagate(sample_mission_request())

    assert result.closest_approach.body_id == "mars"
    assert result.flight_time_seconds > 0
```

```python
# apps/api/tests/api/test_missions_propagate.py
from fastapi.testclient import TestClient
from app.main import app


def test_propagate_returns_samples_and_metrics() -> None:
    client = TestClient(app)
    response = client.post("/missions/propagate", json=sample_payload())

    assert response.status_code == 200
    data = response.json()
    assert len(data["samples"]) > 10
    assert "closestApproach" in data
```

- [ ] **Step 2: Run the propagation tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_mission_service.py tests/api/test_missions_propagate.py -v`  
Expected: FAIL because the mission service and `/missions/propagate` route do not exist

- [ ] **Step 3: Implement mission propagation, event extraction, and response serialization**

```python
# apps/api/app/services/mission_service.py
class MissionService:
    def __init__(self, ephemeris):
        self.ephemeris = ephemeris

    def propagate(self, request: MissionRequest) -> TrajectoryResult:
        # 1. Normalize the initial state into heliocentric coordinates
        # 2. Build a multi-body acceleration function from ephemeris states
        # 3. Propagate with solve_ivp
        # 4. Compute closest approach and warnings
        ...
```

```python
# apps/api/app/core/dynamics/events.py
def compute_closest_approach(samples, target_samples):
    ...
```

Update `routes_missions.py` so the endpoint resolves the bundled ephemeris provider and returns a JSON-safe `TrajectoryResult`.

- [ ] **Step 4: Run propagation tests and add one suspicious-result warning test**

Run: `cd apps/api && uv run pytest tests/unit/test_mission_service.py tests/api/test_missions_propagate.py -v`  
Expected: PASS

Then add a test that a clearly unstable input returns a warning entry instead of silently succeeding.  
Expected: PASS

- [ ] **Step 5: Commit the mission propagation slice**

```bash
git add apps/api/app/services apps/api/app/core/dynamics/events.py apps/api/app/api/routes_missions.py apps/api/tests/unit/test_mission_service.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: add mission propagation service"
```

### Task 6: Expose Ephemeris States To The Frontend

**Files:**
- Create: `apps/api/app/api/routes_ephemeris.py`
- Create: `apps/api/tests/api/test_ephemeris_bodies.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write the failing ephemeris endpoint test**

```python
# apps/api/tests/api/test_ephemeris_bodies.py
from fastapi.testclient import TestClient
from app.main import app


def test_ephemeris_bodies_returns_major_planet_states() -> None:
    client = TestClient(app)
    response = client.get("/ephemeris/bodies", params={"epoch": "2026-10-15T00:00:00Z"})

    assert response.status_code == 200
    data = response.json()
    assert any(body["bodyId"] == "earth" for body in data["bodies"])
    assert any(body["bodyId"] == "mars" for body in data["bodies"])
```

- [ ] **Step 2: Run the API test and verify it fails**

Run: `cd apps/api && uv run pytest tests/api/test_ephemeris_bodies.py -v`  
Expected: FAIL because the route is not registered yet

- [ ] **Step 3: Implement the ephemeris route**

```python
# apps/api/app/api/routes_ephemeris.py
from fastapi import APIRouter, Query

router = APIRouter(prefix="/ephemeris", tags=["ephemeris"])


@router.get("/bodies")
def list_bodies(epoch: str = Query(...)) -> dict:
    ...
```

Return a stable payload like:

```json
{
  "referenceFrame": "heliocentric-inertial",
  "epoch": "2026-10-15T00:00:00Z",
  "bodies": []
}
```

- [ ] **Step 4: Run the endpoint test and then the full backend suite**

Run: `cd apps/api && uv run pytest tests/api/test_ephemeris_bodies.py -v`  
Expected: PASS

Run: `cd apps/api && uv run pytest -v`  
Expected: PASS

- [ ] **Step 5: Commit the ephemeris API**

```bash
git add apps/api/app/api/routes_ephemeris.py apps/api/app/main.py apps/api/tests/api/test_ephemeris_bodies.py
git commit -m "feat: add ephemeris bodies endpoint"
```

## Chunk 3: Web Client And Visualization

### Task 7: Add A Typed API Client And Mission Input Form

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/features/mission/types.ts`
- Create: `apps/web/src/features/mission/components/MissionForm.tsx`
- Create: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Create: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write the failing UI test for mission configuration**

```tsx
// apps/web/src/features/mission/components/MissionForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MissionForm from "./MissionForm";

it("submits a request for an Earth to Mars mission", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} />);

  await userEvent.selectOptions(screen.getByLabelText("Target Planet"), "mars");
  await userEvent.type(screen.getByLabelText("Launch Epoch"), "2026-10-15T00:00:00Z");
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ departureBody: "earth", targetBody: "mars" }),
  );
});
```

- [ ] **Step 2: Run the frontend form test and confirm it fails**

Run: `cd apps/web && pnpm test -- --runInBand src/features/mission/components/MissionForm.test.tsx`  
Expected: FAIL because the form component does not exist

- [ ] **Step 3: Implement the typed request model, API client, and form**

```tsx
// apps/web/src/features/mission/types.ts
export type MissionRequest = {
  departureBody: "earth";
  targetBody: string;
  launchEpoch: string;
  durationSeconds: number;
  outputStepSeconds: number;
  initialState: {
    stateVector: {
      positionKm: [number, number, number];
      velocityKmPerSec: [number, number, number];
    };
  };
};
```

```tsx
// apps/web/src/lib/api.ts
export async function propagateMission(request: MissionRequest) {
  const response = await fetch("/missions/propagate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) throw new Error("Propagation request failed");
  return response.json();
}
```

The form should:

- lock `departureBody` to Earth in phase 1
- allow any supported target planet
- expose launch epoch, mission duration, and output step
- start with a raw state-vector entry mode
- reserve, but not yet implement, the `launchFromBody` path in the UI

- [ ] **Step 4: Run the form test and then the app smoke test**

Run: `cd apps/web && pnpm test -- --runInBand src/features/mission/components/MissionForm.test.tsx`  
Expected: PASS

Run: `cd apps/web && pnpm test -- --runInBand src/App.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit the mission input UI**

```bash
git add apps/web/src/lib apps/web/src/features/mission apps/web/src/App.tsx
git commit -m "feat: add mission input workflow"
```

### Task 8: Render The Solar System And Propagated Trajectory In 3D

**Files:**
- Create: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Create: `apps/web/src/features/scene/lib/scale.ts`
- Create: `apps/web/src/features/scene/lib/trajectory.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write the failing scene integration test**

```tsx
// apps/web/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("shows the mission metrics panel after propagation results load", async () => {
  render(<App />);
  expect(await screen.findByText("Closest Approach")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the scene integration test and confirm it fails**

Run: `cd apps/web && pnpm test -- --runInBand src/App.test.tsx`  
Expected: FAIL because the results view is not implemented

- [ ] **Step 3: Implement scene scaling, trajectory rendering, and mission summary**

```tsx
// apps/web/src/features/scene/lib/scale.ts
export function scaleDistanceKm(distanceKm: number): number {
  return distanceKm / 1_000_000;
}
```

```tsx
// apps/web/src/features/scene/lib/trajectory.ts
export function toLinePoints(samples: Array<{ positionKm: [number, number, number] }>) {
  return samples.map((sample) => sample.positionKm.map(scaleDistanceKm));
}
```

`SolarSystemScene.tsx` should render:

- the Sun at the origin
- planets from `/ephemeris/bodies`
- the propagated probe path as a line strip
- a simple time scrubber or frame index control

`MissionSummary.tsx` should show:

- target body
- flight time
- closest approach distance
- warnings, if any

- [ ] **Step 4: Run the scene test and then the full web suite**

Run: `cd apps/web && pnpm test -- --runInBand src/App.test.tsx`  
Expected: PASS

Run: `cd apps/web && pnpm test -- --runInBand`  
Expected: PASS

- [ ] **Step 5: Commit the 3D result view**

```bash
git add apps/web/src/App.tsx apps/web/src/features/scene apps/web/src/features/mission/components/MissionSummary.tsx
git commit -m "feat: add 3d solar system results view"
```

## Chunk 4: Validation, Fixtures, And Delivery

### Task 9: Add Reference Validation And Regression Tests

**Files:**
- Modify: `apps/api/tests/fixtures/reference_states.json`
- Modify: `apps/api/tests/unit/test_bundled_ephemeris.py`
- Modify: `apps/api/tests/unit/test_propagator_two_body.py`
- Create: `apps/api/tests/unit/test_reference_scenarios.py`

- [ ] **Step 1: Write the failing validation tests for ephemeris and regression stability**

```python
# apps/api/tests/unit/test_reference_scenarios.py
from app.services.mission_service import MissionService


def test_earth_to_mars_reference_scenario_stays_within_expected_bounds(bundled_ephemeris) -> None:
    result = MissionService(ephemeris=bundled_ephemeris).propagate(sample_mars_request())

    assert 50 * 24 * 3600 < result.flight_time_seconds < 500 * 24 * 3600
    assert result.closest_approach.distance_km > 0
```

- [ ] **Step 2: Run the validation tests and verify they fail where coverage is missing**

Run: `cd apps/api && uv run pytest tests/unit/test_reference_scenarios.py -v`  
Expected: FAIL because the fixtures and helpers are not finished

- [ ] **Step 3: Fill in reference fixtures and regression assertions**

Add:

- reference body states for selected epochs
- one Earth-to-Mars reference request
- one Earth-to-Venus or Earth-to-Jupiter regression request
- explicit tolerances for ephemeris interpolation and energy drift

Document every tolerance in test comments so later changes do not loosen them casually.

- [ ] **Step 4: Run the complete backend suite**

Run: `cd apps/api && uv run pytest -v`  
Expected: PASS with stable reference metrics

- [ ] **Step 5: Commit the validation suite**

```bash
git add apps/api/tests/fixtures apps/api/tests/unit
git commit -m "test: add astrodynamics reference validation"
```

### Task 10: Document Local Development And First Demo Flow

**Files:**
- Modify: `README.md`
- Modify: `Makefile`

- [ ] **Step 1: Write the failing documentation checklist**

Add a temporary checklist to `README.md` describing the missing items:

- backend setup
- frontend setup
- test commands
- sample propagation payload
- expected first demo flow

- [ ] **Step 2: Verify the checklist is incomplete**

Run: `rg "TODO-DOCS" README.md Makefile`  
Expected: matches placeholder markers that still need replacement

- [ ] **Step 3: Replace placeholders with the final operator guide**

Document:

- `uv sync` in `apps/api`
- `pnpm install` in `apps/web`
- `make api-dev` and `make web-dev`
- `make api-test` and `make web-test`
- one sample `curl` for `/missions/propagate`
- what a successful demo looks like in the browser

- [ ] **Step 4: Verify the final developer workflow**

Run: `cd apps/api && uv run pytest -v`  
Expected: PASS

Run: `cd apps/web && pnpm test -- --runInBand`  
Expected: PASS

Run: `make api-dev` and `make web-dev` in separate terminals  
Expected: both services start without manual file edits

- [ ] **Step 5: Commit the delivery polish**

```bash
git add README.md Makefile
git commit -m "docs: add local development guide"
```

## Review Notes For The Implementer

- Keep the first ephemeris dataset intentionally small and explicit. The goal is to prove architecture and correctness, not to ship the full JPL pipeline immediately.
- Do not add Lambert solving, porkchop plots, or low-thrust logic during this plan. Those belong to a separate follow-up plan.
- If `launchFromBody` is not ready by the time the state-vector workflow works end to end, leave the API placeholder in place and keep the UI hidden behind a clear TODO in tests.
- Treat every numerical tolerance as part of the public contract of the backend. If a tolerance changes, document why in the commit that changes it.

Plan complete and saved to `docs/superpowers/plans/2026-03-18-solar-system-trajectory-implementation-plan.md`. Ready to execute?
