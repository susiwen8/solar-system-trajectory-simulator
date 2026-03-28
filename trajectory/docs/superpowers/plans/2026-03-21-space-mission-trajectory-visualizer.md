# Space Mission Trajectory Visualizer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack prototype that computes plausible multi-stop interplanetary missions from Earth using real ephemeris data and renders the selected mission in a 3D solar-system view with centered-spacecraft playback and first-person camera switching.

**Architecture:** Use a FastAPI backend for body metadata, cached JPL ephemeris retrieval, Lambert transfer solving, patched-conic flyby checks, candidate mission scoring, and trajectory sampling. Use a React + TypeScript + react-three-fiber frontend for mission planning UI, candidate comparison, shared playback clock, and 3D rendering. Keep numerical mission design code isolated from rendering code so the solver can be tested independently.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, NumPy, SciPy, httpx, pytest, React, TypeScript, Vite, Three.js, @react-three/fiber, @react-three/drei, Vitest, Testing Library

---

## Inputs

- Spec: `docs/superpowers/specs/2026-03-21-space-mission-trajectory-design.md`
- Process skills to follow during execution: `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

## File Structure

Create these files with single, narrow responsibilities:

- `.gitignore` - ignore Python, Node, build, cache, and local brainstorm artifacts
- `README.md` - local setup, development commands, and fidelity disclaimers
- `Makefile` - convenience commands for backend tests, frontend tests, and dev servers
- `apps/api/pyproject.toml` - backend dependencies, test config, and uv entrypoints
- `apps/api/app/main.py` - FastAPI app composition root
- `apps/api/app/core/config.py` - environment-backed settings such as cache directory and Horizons base URL
- `apps/api/app/core/body_catalog.py` - supported body metadata, display constants, and flyby constants
- `apps/api/app/core/schemas.py` - shared API response models for bodies, candidates, and samples
- `apps/api/app/data/ephemeris_cache.py` - file-backed cache for state vectors by body and timestamp window
- `apps/api/app/data/horizons_client.py` - JPL Horizons HTTP client and response parsing
- `apps/api/app/services/ephemeris_service.py` - cache lookup, remote fetch, and graceful fallback policy
- `apps/api/app/astrodynamics/vector_math.py` - shared vector helpers and safe normalization
- `apps/api/app/astrodynamics/lambert.py` - Lambert solver returning transfer endpoint velocities
- `apps/api/app/astrodynamics/flyby.py` - patched-conic turn-angle feasibility and status labeling
- `apps/api/app/mission/models.py` - validated mission request, leg constraints, and candidate data classes
- `apps/api/app/mission/scoring.py` - normalized mission ranking and compromise-score helpers
- `apps/api/app/mission/search.py` - coarse sampling, leg chaining, refinement, and candidate generation
- `apps/api/app/mission/sampling.py` - precomputed mission path and body-position sampling for playback
- `apps/api/app/routes/health.py` - minimal health endpoint for startup verification
- `apps/api/app/routes/bodies.py` - supported-bodies endpoint
- `apps/api/app/routes/missions.py` - mission solve endpoint and optional sample lookup endpoint
- `apps/api/tests/fixtures/body_states.py` - deterministic body state vectors for solver and API tests
- `apps/api/tests/integration/test_health.py` - API startup smoke test
- `apps/api/tests/integration/test_bodies_route.py` - bodies endpoint contract test
- `apps/api/tests/integration/test_mission_solve.py` - mission solve contract test with stubbed ephemeris
- `apps/api/tests/unit/test_body_catalog.py` - body metadata invariants
- `apps/api/tests/unit/test_ephemeris_service.py` - cache hit, cache miss, and fallback tests
- `apps/api/tests/unit/test_lambert.py` - Lambert solver sanity tests
- `apps/api/tests/unit/test_flyby.py` - turn-angle feasibility tests
- `apps/api/tests/unit/test_mission_search.py` - candidate generation and scoring tests
- `apps/api/tests/unit/test_sampling.py` - playback sample monotonicity tests
- `apps/web/package.json` - frontend dependencies and scripts
- `apps/web/tsconfig.json` - TypeScript compiler configuration
- `apps/web/vite.config.ts` - Vite config for React
- `apps/web/index.html` - frontend mount point
- `apps/web/src/main.tsx` - app bootstrap
- `apps/web/src/app/App.tsx` - page layout, top-level data flow, and shared providers
- `apps/web/src/styles/app.css` - layout, panel, control, and telemetry styling
- `apps/web/src/api/client.ts` - frontend HTTP client for backend endpoints
- `apps/web/src/state/missionStore.ts` - mission inputs, solver results, playback state, and camera mode
- `apps/web/src/components/MissionForm.tsx` - launch window, targets, and weighting controls
- `apps/web/src/components/CandidateList.tsx` - compact candidate cards and selection logic
- `apps/web/src/components/TimeControls.tsx` - pause, speed presets, and scrubber state
- `apps/web/src/components/TelemetryHud.tsx` - fidelity badges and first-person telemetry
- `apps/web/src/scene/sceneScale.ts` - conversions from kilometers/AU to render units and assistive halo sizing
- `apps/web/src/scene/usePlaybackClock.ts` - shared simulation clock and interpolation helpers
- `apps/web/src/scene/SceneRoot.tsx` - canvas composition, lights, and top-level scene graph
- `apps/web/src/scene/BodyLayer.tsx` - planet and dwarf-planet meshes plus halos and labels
- `apps/web/src/scene/OrbitLines.tsx` - reference orbit and body track rendering
- `apps/web/src/scene/TrajectoryLine.tsx` - selected mission path rendering
- `apps/web/src/scene/SpacecraftMarker.tsx` - animated probe marker and click target
- `apps/web/src/scene/CameraRig.tsx` - centered overview camera and first-person camera behavior
- `apps/web/tests/unit/app/App.test.tsx` - app shell and mocked API bootstrap test
- `apps/web/tests/unit/state/missionStore.test.ts` - store transitions for candidates, playback, and camera mode
- `apps/web/tests/unit/scene/sceneScale.test.ts` - scale and halo helper tests
- `apps/web/tests/unit/scene/playbackClock.test.ts` - playback clock interpolation tests
- `apps/web/tests/integration/missionPlannerFlow.test.tsx` - plan mission, view candidates, switch camera flow

Keep `apps/api/app/astrodynamics` pure and renderer-free. Keep `apps/web/src/scene` presentation-only and feed it precomputed samples instead of backend math logic.

## Chunk 1: Backend Foundation And Authoritative Data

### Task 1: Bootstrap the repository layout and backend health endpoint

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `Makefile`
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/main.py`
- Create: `apps/api/app/routes/health.py`
- Test: `apps/api/tests/integration/test_health.py`

- [ ] **Step 1: Write the failing backend health test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_route_reports_ok() -> None:
    client = TestClient(create_app())

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Create the repository and backend toolchain files**

Create `.gitignore`, `README.md`, `Makefile`, and `apps/api/pyproject.toml`.

`apps/api/pyproject.toml` should include:

```toml
[project]
name = "trajectory-api"
requires-python = ">=3.12"
dependencies = ["fastapi", "uvicorn", "pydantic", "httpx", "numpy", "scipy"]

[dependency-groups]
dev = ["pytest", "pytest-cov"]
```

`Makefile` should expose at least:

```make
api-test:
	cd apps/api && uv run pytest

web-test:
	cd apps/web && npm run test -- --run
```

- [ ] **Step 3: Run the health test and verify it fails**

Run: `cd apps/api && uv run pytest tests/integration/test_health.py -q`

Expected: FAIL because `app.main` and `create_app()` do not exist yet.

- [ ] **Step 4: Implement the minimal FastAPI app and health route**

Create `apps/api/app/main.py` and `apps/api/app/routes/health.py`:

```python
from fastapi import APIRouter, FastAPI


health_router = APIRouter(prefix="/api")


@health_router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}


def create_app() -> FastAPI:
    app = FastAPI(title="Trajectory API")
    app.include_router(health_router)
    return app
```

- [ ] **Step 5: Run the health test and verify it passes**

Run: `cd apps/api && uv run pytest tests/integration/test_health.py -q`

Expected: PASS with `1 passed`.

- [ ] **Step 6: Commit the backend scaffold**

```bash
git add .gitignore README.md Makefile apps/api/pyproject.toml apps/api/app/main.py apps/api/app/routes/health.py apps/api/tests/integration/test_health.py
git commit -m "chore: bootstrap trajectory backend"
```

### Task 2: Add supported-body metadata and the bodies endpoint

**Files:**
- Create: `apps/api/app/core/body_catalog.py`
- Create: `apps/api/app/core/schemas.py`
- Create: `apps/api/app/routes/bodies.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/unit/test_body_catalog.py`
- Test: `apps/api/tests/integration/test_bodies_route.py`

- [ ] **Step 1: Write the failing body-catalog unit test**

```python
from app.core.body_catalog import BODY_CATALOG


def test_body_catalog_contains_planets_and_dwarf_planets() -> None:
    assert "earth" in BODY_CATALOG
    assert "jupiter" in BODY_CATALOG
    assert "pluto" in BODY_CATALOG
    assert "ceres" in BODY_CATALOG
    assert BODY_CATALOG["earth"].radius_km > BODY_CATALOG["pluto"].radius_km
    assert BODY_CATALOG["jupiter"].mu_km3_s2 > BODY_CATALOG["mars"].mu_km3_s2
```

- [ ] **Step 2: Write the failing bodies-route integration test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_bodies_route_returns_sorted_supported_bodies() -> None:
    client = TestClient(create_app())

    response = client.get("/api/bodies")

    payload = response.json()
    assert response.status_code == 200
    assert payload["bodies"][0]["id"] == "ceres"
    assert any(body["id"] == "earth" for body in payload["bodies"])
    assert any(body["id"] == "eris" for body in payload["bodies"])
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_body_catalog.py tests/integration/test_bodies_route.py -q`

Expected: FAIL because the catalog and route do not exist yet.

- [ ] **Step 4: Implement the catalog, response schema, and route**

Create a narrow catalog model:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class BodyDefinition:
    id: str
    name: str
    horizons_id: str
    radius_km: float
    mu_km3_s2: float
    color_hex: str
```

Populate entries for the eight planets plus `ceres`, `pluto`, `haumea`, `makemake`, and `eris`. Add `/api/bodies` that returns a deterministic `{"bodies": [...]}` payload built from this catalog.

- [ ] **Step 5: Run the catalog and route tests and verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_body_catalog.py tests/integration/test_bodies_route.py -q`

Expected: PASS with both tests green.

- [ ] **Step 6: Commit the supported-body slice**

```bash
git add apps/api/app/core/body_catalog.py apps/api/app/core/schemas.py apps/api/app/routes/bodies.py apps/api/app/main.py apps/api/tests/unit/test_body_catalog.py apps/api/tests/integration/test_bodies_route.py
git commit -m "feat: add supported body catalog"
```

### Task 3: Implement the ephemeris client, file cache, and fallback policy

**Files:**
- Create: `apps/api/app/core/config.py`
- Create: `apps/api/app/data/ephemeris_cache.py`
- Create: `apps/api/app/data/horizons_client.py`
- Create: `apps/api/app/services/ephemeris_service.py`
- Test: `apps/api/tests/unit/test_ephemeris_service.py`

- [ ] **Step 1: Write the failing ephemeris-service tests**

```python
from pathlib import Path

from app.services.ephemeris_service import EphemerisService


class StubClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = 0

    def fetch_vectors(self, *_, **__):
        self.calls += 1
        return self.payload


def test_ephemeris_service_hits_remote_then_caches(tmp_path: Path) -> None:
    payload = [{"timestamp": "2030-01-01T00:00:00Z", "position_km": [1.0, 2.0, 3.0], "velocity_km_s": [0.1, 0.2, 0.3]}]
    service = EphemerisService(cache_dir=tmp_path, client=StubClient(payload))

    first = service.get_vectors("earth", "2030-01-01", "2030-01-02", "1d")
    second = service.get_vectors("earth", "2030-01-01", "2030-01-02", "1d")

    assert first == second
    assert service.client.calls == 1
```

- [ ] **Step 2: Add a failing fallback test**

Write a second test where cached data exists, the client raises an exception, and the service still returns cached vectors while marking the response source as `"cache"`.

- [ ] **Step 3: Run the ephemeris-service tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_ephemeris_service.py -q`

Expected: FAIL because the service, cache, and client modules do not exist yet.

- [ ] **Step 4: Implement settings, cache, and Horizons client seam**

Implement:

- `TrajectorySettings` in `config.py` with `cache_dir` and `horizons_base_url`
- a file cache keyed by body plus time window in `ephemeris_cache.py`
- `HorizonsClient.fetch_vectors()` in `horizons_client.py`
- `EphemerisService.get_vectors()` that tries cache, then remote, then cached fallback on remote failure

The first implementation can parse a narrow normalized record format:

```python
{
    "timestamp": "2030-01-01T00:00:00Z",
    "position_km": [x, y, z],
    "velocity_km_s": [vx, vy, vz],
}
```

- [ ] **Step 5: Run the ephemeris-service tests and verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_ephemeris_service.py -q`

Expected: PASS with cache-hit and fallback assertions green.

- [ ] **Step 6: Commit ephemeris retrieval and caching**

```bash
git add apps/api/app/core/config.py apps/api/app/data/ephemeris_cache.py apps/api/app/data/horizons_client.py apps/api/app/services/ephemeris_service.py apps/api/tests/unit/test_ephemeris_service.py
git commit -m "feat: add ephemeris cache and client"
```

### Task 4: Add Lambert and flyby astrodynamics primitives

**Files:**
- Create: `apps/api/app/astrodynamics/vector_math.py`
- Create: `apps/api/app/astrodynamics/lambert.py`
- Create: `apps/api/app/astrodynamics/flyby.py`
- Test: `apps/api/tests/unit/test_lambert.py`
- Test: `apps/api/tests/unit/test_flyby.py`

- [ ] **Step 1: Write the failing Lambert solver test**

```python
import numpy as np

from app.astrodynamics.lambert import solve_lambert


def test_solve_lambert_returns_finite_endpoint_velocities() -> None:
    mu_sun = 1.32712440018e11
    r1 = np.array([149_597_870.7, 0.0, 0.0])
    r2 = np.array([0.0, 227_939_200.0, 0.0])
    solution = solve_lambert(r1, r2, 220 * 86400.0, mu_sun)

    assert solution is not None
    assert np.isfinite(solution.v1_km_s).all()
    assert np.isfinite(solution.v2_km_s).all()
```

- [ ] **Step 2: Write the failing flyby-feasibility test**

```python
import numpy as np

from app.astrodynamics.flyby import classify_flyby


def test_classify_flyby_reports_infeasible_when_turn_angle_is_too_large() -> None:
    incoming = np.array([7.0, 0.0, 0.0])
    outgoing = np.array([0.0, 7.0, 0.0])

    result = classify_flyby(
        incoming_vinf_km_s=incoming,
        outgoing_vinf_km_s=outgoing,
        mu_km3_s2=3.24859e5,
        body_radius_km=6051.8,
        min_altitude_km=5000.0,
    )

    assert result.status == "infeasible"
    assert result.required_turn_angle_deg > result.max_turn_angle_deg
```

- [ ] **Step 3: Run the astrodynamics tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_lambert.py tests/unit/test_flyby.py -q`

Expected: FAIL because the solver and flyby modules are missing.

- [ ] **Step 4: Implement vector helpers, a Lambert solver, and flyby classification**

Implement:

- safe norm and unit-vector helpers in `vector_math.py`
- a universal-variable Lambert solver in `lambert.py`
- a `FlybyResult` data object and `classify_flyby()` in `flyby.py`

Keep the first solver focused:

- prograde transfers only
- no multi-revolution branches
- explicit `None` or typed failure on non-convergence

- [ ] **Step 5: Run the astrodynamics tests and verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_lambert.py tests/unit/test_flyby.py -q`

Expected: PASS with finite-velocity and turn-limit assertions green.

- [ ] **Step 6: Commit the astrodynamics primitives**

```bash
git add apps/api/app/astrodynamics/vector_math.py apps/api/app/astrodynamics/lambert.py apps/api/app/astrodynamics/flyby.py apps/api/tests/unit/test_lambert.py apps/api/tests/unit/test_flyby.py
git commit -m "feat: add lambert and flyby primitives"
```

## Chunk 2: Mission Search, Scoring, And Solve API

### Task 5: Implement mission models, validation, and single-leg scoring

**Files:**
- Create: `apps/api/app/mission/models.py`
- Create: `apps/api/app/mission/scoring.py`
- Create: `apps/api/tests/fixtures/body_states.py`
- Test: `apps/api/tests/unit/test_mission_search.py`

- [ ] **Step 1: Write the failing mission-model and scoring test**

```python
from app.mission.models import MissionRequest
from app.mission.scoring import score_candidate


def test_score_candidate_rewards_lower_time_and_delta_v() -> None:
    request = MissionRequest(
        targets=["mars"],
        launch_window_start="2030-01-01T00:00:00Z",
        launch_window_end="2030-03-01T00:00:00Z",
        max_duration_days=500,
        min_leg_duration_days=100,
        max_leg_duration_days=300,
        time_weight=0.4,
        allow_gravity_assists=True,
        flyby_altitude_multiplier=2.0,
    )

    fast_expensive = score_candidate(request, total_delta_v=9.0, total_duration_days=180.0, near_limit_count=0)
    slow_cheap = score_candidate(request, total_delta_v=5.5, total_duration_days=260.0, near_limit_count=0)

    assert fast_expensive > 0
    assert slow_cheap > 0
    assert fast_expensive != slow_cheap
```

- [ ] **Step 2: Extend the same test file with request validation cases**

Add a test that rejects an empty target list and a test that rejects `launch_window_end` before `launch_window_start`.

- [ ] **Step 3: Run the mission-model tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_mission_search.py -q`

Expected: FAIL because the mission models and scorer do not exist yet.

- [ ] **Step 4: Implement validated mission inputs and normalized scoring**

Implement `MissionRequest`, `MissionLegCandidate`, and `MissionCandidate` in `models.py`. Add `score_candidate()` in `scoring.py` that combines normalized duration, normalized delta-v, and a penalty per near-limit flyby.

- [ ] **Step 5: Run the mission-model tests and verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_mission_search.py -q`

Expected: PASS with validation and score-differentiation assertions green.

- [ ] **Step 6: Commit mission models and scoring**

```bash
git add apps/api/app/mission/models.py apps/api/app/mission/scoring.py apps/api/tests/fixtures/body_states.py apps/api/tests/unit/test_mission_search.py
git commit -m "feat: add mission request models and scoring"
```

### Task 6: Build coarse-to-fine mission search and trajectory sampling

**Files:**
- Create: `apps/api/app/mission/search.py`
- Create: `apps/api/app/mission/sampling.py`
- Test: `apps/api/tests/unit/test_mission_search.py`
- Test: `apps/api/tests/unit/test_sampling.py`

- [ ] **Step 1: Add a failing mission-search test for one-leg candidate generation**

Extend `apps/api/tests/unit/test_mission_search.py`:

```python
from app.mission.search import MissionSearchService


def test_search_service_returns_ranked_candidates_for_stubbed_earth_mars_transfer(stub_ephemeris_service) -> None:
    service = MissionSearchService(ephemeris_service=stub_ephemeris_service)
    candidates = service.solve(
        targets=["mars"],
        launch_window_start="2030-01-01T00:00:00Z",
        launch_window_end="2030-02-01T00:00:00Z",
        max_duration_days=400,
        min_leg_duration_days=120,
        max_leg_duration_days=260,
        time_weight=0.5,
        allow_gravity_assists=True,
        flyby_altitude_multiplier=2.0,
    )

    assert len(candidates) >= 1
    assert candidates[0].legs[0].departure_body_id == "earth"
    assert candidates[0].legs[0].arrival_body_id == "mars"
```

- [ ] **Step 2: Write the failing sampling test**

```python
from app.mission.sampling import sample_candidate


def test_sample_candidate_returns_monotonic_timestamps(example_candidate) -> None:
    samples = sample_candidate(example_candidate, step_seconds=86400)

    timestamps = [sample.timestamp for sample in samples.spacecraft]
    assert timestamps == sorted(timestamps)
    assert len(samples.spacecraft) > 2
```

- [ ] **Step 3: Run the mission-search and sampling tests and verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_mission_search.py tests/unit/test_sampling.py -q`

Expected: FAIL because the search and sampling services are still missing.

- [ ] **Step 4: Implement the search pipeline**

Implement `MissionSearchService.solve()` with:

- launch-date and arrival-date grid sampling
- Lambert solution per sampled pair
- per-leg delta-v estimation from relative `v_infinity`
- flyby feasibility checks for interior bodies when there are multiple legs
- ranking into `fuel_efficient`, `time_efficient`, and `recommended` candidates

Use a narrow first pass:

- coarse sampling first
- local refinement around the best windows
- maximum of roughly three returned candidates

- [ ] **Step 5: Implement deterministic playback sampling**

`sample_candidate()` should produce:

- spacecraft sample points
- event markers for launch, flyby, and arrival
- body positions for relevant bodies over the same simulation clock range

Return enough data for the frontend to animate without recomputing Lambert arcs.

- [ ] **Step 6: Run the mission-search and sampling tests and verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_mission_search.py tests/unit/test_sampling.py -q`

Expected: PASS with ranked candidates and monotonic sample timestamps.

- [ ] **Step 7: Commit mission search and sampling**

```bash
git add apps/api/app/mission/search.py apps/api/app/mission/sampling.py apps/api/tests/unit/test_mission_search.py apps/api/tests/unit/test_sampling.py
git commit -m "feat: add mission search and sampling"
```

### Task 7: Wire the solve endpoint and backend contract tests

**Files:**
- Create: `apps/api/app/routes/missions.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/integration/test_mission_solve.py`

- [ ] **Step 1: Write the failing mission-solve integration test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_mission_solve_returns_candidate_payload(stubbed_app) -> None:
    client = TestClient(stubbed_app)

    response = client.post(
        "/api/missions/solve",
        json={
            "targets": ["mars", "jupiter"],
            "launch_window_start": "2030-01-01T00:00:00Z",
            "launch_window_end": "2030-03-01T00:00:00Z",
            "max_duration_days": 3000,
            "min_leg_duration_days": 90,
            "max_leg_duration_days": 1200,
            "time_weight": 0.6,
            "allow_gravity_assists": True,
            "flyby_altitude_multiplier": 2.0,
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert len(payload["candidates"]) >= 1
    assert payload["candidates"][0]["summary"]["label"] in {"recommended", "time_efficient", "fuel_efficient"}
```

- [ ] **Step 2: Run the solve-route test and verify it fails**

Run: `cd apps/api && uv run pytest tests/integration/test_mission_solve.py -q`

Expected: FAIL because the route and dependency wiring do not exist yet.

- [ ] **Step 3: Implement the route and dependency composition**

Add `missions.py` and wire it from `create_app()`:

- parse the request into `MissionRequest`
- call `MissionSearchService.solve()`
- sample each returned candidate for playback
- return a stable JSON shape with `candidates`, `relevantBodies`, `fidelity`, and `warnings`

- [ ] **Step 4: Add a second contract test for infeasible searches**

Add a test that posts an over-constrained route and expects:

- `200 OK`
- an empty `candidates` list
- at least one user-facing suggestion in `warnings`

- [ ] **Step 5: Run the backend integration tests and verify they pass**

Run: `cd apps/api && uv run pytest tests/integration/test_health.py tests/integration/test_bodies_route.py tests/integration/test_mission_solve.py -q`

Expected: PASS with all route contracts green.

- [ ] **Step 6: Commit the solve API**

```bash
git add apps/api/app/routes/missions.py apps/api/app/main.py apps/api/tests/integration/test_mission_solve.py
git commit -m "feat: add mission solve api"
```

## Chunk 3: Frontend Shell, 3D Playback, And UX

### Task 8: Bootstrap the React frontend and application shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/styles/app.css`
- Test: `apps/web/tests/unit/app/App.test.tsx`

- [ ] **Step 1: Write the failing frontend shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "../../../src/app/App";


test("renders the planner shell", () => {
  render(<App />);

  expect(screen.getByText(/mission planner/i)).toBeInTheDocument();
  expect(screen.getByText(/trajectory candidates/i)).toBeInTheDocument();
  expect(screen.getByTestId("scene-shell")).toBeInTheDocument();
});
```

- [ ] **Step 2: Create the frontend toolchain files**

`apps/web/package.json` should include scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest"
  }
}
```

Install:

- runtime: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`
- dev: `typescript`, `vite`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`

- [ ] **Step 3: Run the frontend shell test and verify it fails**

Run: `cd apps/web && npm run test -- --run tests/unit/app/App.test.tsx`

Expected: FAIL because the app shell does not exist yet.

- [ ] **Step 4: Implement the base layout**

Create `App.tsx` and `app.css` with:

- left planner panel
- center scene viewport placeholder
- right candidate panel
- bottom control strip

The shell can start with static headings and empty-state placeholders.

- [ ] **Step 5: Run the frontend shell test and verify it passes**

Run: `cd apps/web && npm run test -- --run tests/unit/app/App.test.tsx`

Expected: PASS with one rendered-shell test.

- [ ] **Step 6: Commit the frontend scaffold**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html apps/web/src/main.tsx apps/web/src/app/App.tsx apps/web/src/styles/app.css apps/web/tests/unit/app/App.test.tsx
git commit -m "chore: bootstrap trajectory frontend"
```

### Task 9: Implement mission input state, API client, and candidate list

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/state/missionStore.ts`
- Create: `apps/web/src/components/MissionForm.tsx`
- Create: `apps/web/src/components/CandidateList.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/tests/unit/state/missionStore.test.ts`
- Test: `apps/web/tests/integration/missionPlannerFlow.test.tsx`

- [ ] **Step 1: Write the failing mission-store tests**

```ts
import { createMissionStore } from "../../../src/state/missionStore";


test("selects a returned candidate and resets playback to the new mission", () => {
  const store = createMissionStore();

  store.setCandidates([
    { id: "candidate-a", summary: { label: "recommended", totalDurationDays: 240, totalDeltaV: 5.8 } },
    { id: "candidate-b", summary: { label: "fuel_efficient", totalDurationDays: 310, totalDeltaV: 4.9 } },
  ]);

  store.selectCandidate("candidate-b");

  expect(store.getState().selectedCandidateId).toBe("candidate-b");
  expect(store.getState().playback.currentTimeSeconds).toBe(0);
});
```

- [ ] **Step 2: Write the failing mission-planner flow test**

Add an integration test that:

- renders `<App />` with a mocked API client
- selects `Mars` and `Jupiter`
- submits the form
- verifies that candidate cards appear
- verifies that the recommended candidate is auto-selected

- [ ] **Step 3: Run the mission-store and flow tests and verify they fail**

Run: `cd apps/web && npm run test -- --run tests/unit/state/missionStore.test.ts tests/integration/missionPlannerFlow.test.tsx`

Expected: FAIL because the store, form, and candidate list do not exist yet.

- [ ] **Step 4: Implement mission state and the narrow API client**

Implement:

- `createMissionStore()` with mission inputs, candidate list, selected candidate, playback state, and camera mode
- `client.ts` methods for `getBodies()` and `solveMission()`
- `MissionForm.tsx` with launch window, target multi-select, and time-weight controls
- `CandidateList.tsx` with label, duration, delta-v, and flyby badges

- [ ] **Step 5: Run the mission-store and planner flow tests and verify they pass**

Run: `cd apps/web && npm run test -- --run tests/unit/state/missionStore.test.ts tests/integration/missionPlannerFlow.test.tsx`

Expected: PASS with selected-candidate and planner-submit assertions green.

- [ ] **Step 6: Commit the mission planner UI**

```bash
git add apps/web/src/api/client.ts apps/web/src/state/missionStore.ts apps/web/src/components/MissionForm.tsx apps/web/src/components/CandidateList.tsx apps/web/src/app/App.tsx apps/web/tests/unit/state/missionStore.test.ts apps/web/tests/integration/missionPlannerFlow.test.tsx
git commit -m "feat: add mission planner ui"
```

### Task 10: Add 3D scene scale helpers, body rendering, and trajectory rendering

**Files:**
- Create: `apps/web/src/scene/sceneScale.ts`
- Create: `apps/web/src/scene/SceneRoot.tsx`
- Create: `apps/web/src/scene/BodyLayer.tsx`
- Create: `apps/web/src/scene/OrbitLines.tsx`
- Create: `apps/web/src/scene/TrajectoryLine.tsx`
- Create: `apps/web/src/scene/SpacecraftMarker.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/tests/unit/scene/sceneScale.test.ts`

- [ ] **Step 1: Write the failing scene-scale test**

```ts
import { kmToWorldUnits, haloRadiusForBody } from "../../../src/scene/sceneScale";


test("keeps true body proportions while enforcing a visible interaction halo", () => {
  const plutoRadius = kmToWorldUnits(1188.3);
  const earthRadius = kmToWorldUnits(6378.1);

  expect(earthRadius).toBeGreaterThan(plutoRadius);
  expect(haloRadiusForBody(plutoRadius)).toBeGreaterThan(plutoRadius);
});
```

- [ ] **Step 2: Run the scene-scale test and verify it fails**

Run: `cd apps/web && npm run test -- --run tests/unit/scene/sceneScale.test.ts`

Expected: FAIL because the scale helpers and scene modules do not exist yet.

- [ ] **Step 3: Implement scene scaling and render layers**

Implement:

- `sceneScale.ts` with AU-to-world and kilometer-to-radius conversions
- `SceneRoot.tsx` with `<Canvas>` and scene lights
- `BodyLayer.tsx` with actual body spheres plus non-physical selection halos
- `OrbitLines.tsx` with reference orbit tracks
- `TrajectoryLine.tsx` with the selected candidate path
- `SpacecraftMarker.tsx` with a clickable probe marker

- [ ] **Step 4: Mount the scene into the app shell**

Replace the viewport placeholder in `App.tsx` with `SceneRoot` wired to the selected candidate and relevant body samples.

- [ ] **Step 5: Run the scene-scale test and verify it passes**

Run: `cd apps/web && npm run test -- --run tests/unit/scene/sceneScale.test.ts`

Expected: PASS with true-proportion and halo assertions green.

- [ ] **Step 6: Commit the 3D scene foundation**

```bash
git add apps/web/src/scene/sceneScale.ts apps/web/src/scene/SceneRoot.tsx apps/web/src/scene/BodyLayer.tsx apps/web/src/scene/OrbitLines.tsx apps/web/src/scene/TrajectoryLine.tsx apps/web/src/scene/SpacecraftMarker.tsx apps/web/src/app/App.tsx apps/web/tests/unit/scene/sceneScale.test.ts
git commit -m "feat: add 3d mission scene"
```

### Task 11: Implement playback controls, centered camera, and first-person mode

**Files:**
- Create: `apps/web/src/components/TimeControls.tsx`
- Create: `apps/web/src/components/TelemetryHud.tsx`
- Create: `apps/web/src/scene/usePlaybackClock.ts`
- Create: `apps/web/src/scene/CameraRig.tsx`
- Modify: `apps/web/src/scene/SceneRoot.tsx`
- Modify: `apps/web/src/scene/SpacecraftMarker.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/tests/unit/scene/playbackClock.test.ts`
- Test: `apps/web/tests/integration/missionPlannerFlow.test.tsx`

- [ ] **Step 1: Write the failing playback-clock test**

```ts
import { createPlaybackClock } from "../../../src/scene/usePlaybackClock";


test("advances mission time according to the selected speed multiplier", () => {
  const clock = createPlaybackClock();

  clock.setSpeed(100);
  clock.tick(0.25);

  expect(clock.getState().currentTimeSeconds).toBe(25);
});
```

- [ ] **Step 2: Extend the flow test for camera switching**

Add assertions that:

- clicking the spacecraft marker toggles `cameraMode` from `"overview"` to `"first_person"`
- switching candidates returns the mode to `"overview"`

- [ ] **Step 3: Run the playback and flow tests and verify they fail**

Run: `cd apps/web && npm run test -- --run tests/unit/scene/playbackClock.test.ts tests/integration/missionPlannerFlow.test.tsx`

Expected: FAIL because playback and camera modules are not implemented yet.

- [ ] **Step 4: Implement time controls, shared playback clock, and telemetry**

Implement:

- `TimeControls.tsx` for pause and speed presets `1x`, `10x`, `100x`, `1000x`
- `createPlaybackClock()` plus a React wrapper hook in `usePlaybackClock.ts`
- `TelemetryHud.tsx` with fidelity badges and first-person readouts

- [ ] **Step 5: Implement the centered overview camera and first-person camera**

Add `CameraRig.tsx` that:

- keeps the spacecraft position as the orbit-controls target in overview mode
- supports zooming around that target
- snaps to a stable overhead default on reset
- attaches to the spacecraft and looks down the velocity vector in first-person mode

Wire spacecraft clicks to the store so the user can toggle camera modes.

- [ ] **Step 6: Run the playback and flow tests and verify they pass**

Run: `cd apps/web && npm run test -- --run tests/unit/scene/playbackClock.test.ts tests/integration/missionPlannerFlow.test.tsx`

Expected: PASS with playback-speed and camera-toggle assertions green.

- [ ] **Step 7: Commit playback and camera controls**

```bash
git add apps/web/src/components/TimeControls.tsx apps/web/src/components/TelemetryHud.tsx apps/web/src/scene/usePlaybackClock.ts apps/web/src/scene/CameraRig.tsx apps/web/src/scene/SceneRoot.tsx apps/web/src/scene/SpacecraftMarker.tsx apps/web/src/app/App.tsx apps/web/tests/unit/scene/playbackClock.test.ts apps/web/tests/integration/missionPlannerFlow.test.tsx
git commit -m "feat: add playback and camera controls"
```

### Task 12: Final integration, docs, and verification

**Files:**
- Modify: `README.md`
- Modify: `Makefile`
- Modify: `apps/api/app/routes/missions.py`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/api/tests/integration/test_mission_solve.py`
- Test: `apps/web/tests/integration/missionPlannerFlow.test.tsx`

- [ ] **Step 1: Add a failing end-to-end expectation to the frontend flow test**

Extend the flow test so that after solving a mission it verifies the UI shows:

- a fidelity badge
- at least one warning or hint area
- visible time controls

- [ ] **Step 2: Run the backend and frontend integration tests and verify gaps remain**

Run:

```bash
cd apps/api && uv run pytest tests/integration/test_mission_solve.py -q
cd apps/web && npm run test -- --run tests/integration/missionPlannerFlow.test.tsx
```

Expected: at least one FAIL that exposes missing final wiring or copy.

- [ ] **Step 3: Finish the remaining wiring and documentation**

Ensure:

- backend responses include fidelity metadata and user-facing warnings
- the frontend renders fidelity badges and infeasibility guidance
- `README.md` documents both dev servers and explains the simulator's scientific limits
- `Makefile` exposes `api-dev`, `web-dev`, `api-test`, and `web-test`

- [ ] **Step 4: Run the targeted integration tests and verify they pass**

Run:

```bash
cd apps/api && uv run pytest tests/integration/test_health.py tests/integration/test_bodies_route.py tests/integration/test_mission_solve.py -q
cd apps/web && npm run test -- --run tests/unit/app/App.test.tsx tests/unit/state/missionStore.test.ts tests/unit/scene/sceneScale.test.ts tests/unit/scene/playbackClock.test.ts tests/integration/missionPlannerFlow.test.tsx
```

Expected: PASS with all selected backend and frontend tests green.

- [ ] **Step 5: Run production verification**

Run:

```bash
cd apps/api && uv run pytest -q
cd apps/web && npm run build
cd apps/web && npm run test -- --run
```

Expected:

- backend test suite passes
- frontend build completes without TypeScript errors
- frontend test suite passes

- [ ] **Step 6: Commit the integrated prototype**

```bash
git add README.md Makefile apps/api apps/web
git commit -m "feat: build mission trajectory visualizer prototype"
```
