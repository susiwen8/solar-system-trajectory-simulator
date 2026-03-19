# Finite-Thrust Maneuver Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short finite-thrust correction burns with mass depletion to the existing mission solver, then surface maneuver events and propulsion metrics in the current UI.

**Architecture:** Extend the current gravity-first planning flow rather than replacing it: keep Lambert, gravity-assist, and multi-body propagation as the baseline planner, then layer finite-thrust burn segments on top as a correction phase. Model coast and burn segments in the same propagator by expanding the spacecraft state to include mass, and expose maneuver events to both the backend API and the Three.js playback UI.

**Tech Stack:** FastAPI, Pydantic, NumPy, SciPy, pytest, React, TypeScript, Vite, Three.js, Vitest, React Testing Library

---

## Planned File Structure

### Backend

- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/app/core/constants.py`
- Modify: `apps/api/app/core/dynamics/acceleration.py`
- Modify: `apps/api/app/core/dynamics/propagator.py`
- Create: `apps/api/app/core/dynamics/thrust.py`
- Create: `apps/api/app/services/maneuver_planner.py`
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/transfer_planner.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Create: `apps/api/tests/unit/test_thrust_dynamics.py`
- Create: `apps/api/tests/unit/test_maneuver_planner.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_transfer_planner.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`

### Frontend

- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Create: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

## Chunk 1: Backend Propulsion Domain

### Task 1: Add propulsion and maneuver schema coverage

**Files:**
- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Write the failing API assertions for propulsion fields**

```python
def test_propagate_returns_propulsion_fields_when_maneuvers_enabled() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {"launchFromBody": {"mode": "autoTransfer"}},
            "propulsionConfig": {
                "initialMassKg": 1800,
                "propellantMassKg": 420,
                "maxThrustN": 0.8,
                "ispSeconds": 3200,
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "maneuverEvents" in data
    assert "finalMassKg" in data
    assert "totalPropellantUsedKg" in data
```

- [ ] **Step 2: Run the focused API test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py`
Expected: FAIL because `propulsionConfig`, `maneuverEvents`, or mass fields are not defined.

- [ ] **Step 3: Add minimal schema support**

Extend `apps/api/app/schemas/mission.py` with:

- `PropulsionConfig`
- `ManeuverEvent`
- `thrustDirection` and `type` string fields
- `maneuverEvents`, `finalMassKg`, `totalPropellantUsedKg`, and `propulsionConfig` on mission result models

- [ ] **Step 4: Re-run the focused API test**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py`
Expected: FAIL on missing behavior instead of request/response parsing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/mission.py apps/api/tests/api/test_missions_propagate.py apps/api/tests/api/test_missions_plan_tour.py
git commit -m "test: add propulsion schema coverage"
```

### Task 2: Add finite-thrust dynamics unit tests

**Files:**
- Create: `apps/api/app/core/dynamics/thrust.py`
- Create: `apps/api/tests/unit/test_thrust_dynamics.py`
- Test: `apps/api/tests/unit/test_thrust_dynamics.py`

- [ ] **Step 1: Write the failing dynamics tests**

```python
from app.core.dynamics.thrust import BurnSegment, burn_mass_flow_kg_per_s, thrust_acceleration_km_per_s2


def test_thrust_acceleration_scales_with_mass() -> None:
    accel = thrust_acceleration_km_per_s2(thrust_newtons=1.2, mass_kg=600.0, direction=(1.0, 0.0, 0.0))
    assert accel[0] > 0
    assert accel[1] == 0
    assert accel[2] == 0


def test_burn_mass_flow_uses_isp() -> None:
    flow = burn_mass_flow_kg_per_s(thrust_newtons=0.6, isp_seconds=3000.0)
    assert flow > 0
```

- [ ] **Step 2: Run the thrust unit tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_thrust_dynamics.py`
Expected: FAIL because the thrust module does not exist.

- [ ] **Step 3: Implement the minimal thrust helpers**

Create `apps/api/app/core/dynamics/thrust.py` with:

- `BurnSegment` dataclass
- `normalize_direction(...)`
- `thrust_acceleration_km_per_s2(...)`
- `burn_mass_flow_kg_per_s(...)`
- `is_burn_active(...)`

Use `g0 = 9.80665 m/s^2` and convert thrust acceleration into `km/s^2`.

- [ ] **Step 4: Re-run the thrust tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_thrust_dynamics.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/dynamics/thrust.py apps/api/tests/unit/test_thrust_dynamics.py
git commit -m "feat: add finite-thrust helper primitives"
```

## Chunk 2: Propagator With Mass And Burn Segments

### Task 3: Extend the propagator state to include mass

**Files:**
- Modify: `apps/api/app/core/dynamics/propagator.py`
- Modify: `apps/api/app/core/dynamics/acceleration.py`
- Modify: `apps/api/app/core/constants.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_transfer_planner.py`
- Test: `apps/api/tests/unit/test_thrust_dynamics.py`

- [ ] **Step 1: Write a failing propagation test for mass depletion**

```python
def test_propagator_decreases_mass_during_active_burn() -> None:
    result = propagate_with_burn(...)
    assert result.samples[0].massKg > result.samples[-1].massKg
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_thrust_dynamics.py tests/unit/test_mission_service.py`
Expected: FAIL because samples do not include mass and the propagator ignores burns.

- [ ] **Step 3: Implement minimal mass-aware propagation**

Modify `apps/api/app/core/dynamics/propagator.py` to:

- accept optional burn segments
- integrate `[x, y, z, vx, vy, vz, mass]`
- leave coast behavior unchanged when no burns exist

Modify `apps/api/app/core/dynamics/acceleration.py` to:

- combine gravity acceleration with finite-thrust acceleration during active burns

Add constants in `apps/api/app/core/constants.py` for:

- standard gravity
- default propulsion presets
- maneuver type labels if needed

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_thrust_dynamics.py tests/unit/test_mission_service.py`
Expected: PASS for mass depletion and coast compatibility.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/constants.py apps/api/app/core/dynamics/acceleration.py apps/api/app/core/dynamics/propagator.py apps/api/tests/unit/test_thrust_dynamics.py apps/api/tests/unit/test_mission_service.py
git commit -m "feat: add mass-aware finite-thrust propagation"
```

### Task 4: Preserve current mission behavior when propulsion is disabled

**Files:**
- Modify: `apps/api/tests/unit/test_transfer_planner.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_transfer_planner.py`

- [ ] **Step 1: Add regression tests for no-burn compatibility**

```python
def test_auto_transfer_without_propulsion_matches_existing_flow() -> None:
    result = service.propagate_mission(request_without_propulsion)
    assert result.maneuver_events == []
    assert result.final_mass_kg is None
```

- [ ] **Step 2: Run the regression tests to verify current mismatch**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_transfer_planner.py tests/api/test_missions_propagate.py`
Expected: FAIL if the new state handling leaks propulsion-only fields or changes no-burn results incorrectly.

- [ ] **Step 3: Tighten the no-burn code path**

Ensure:

- no-burn requests do not require propulsion config
- no-burn results still serialize consistently
- thrust logic short-circuits cleanly when no burn segments are provided

- [ ] **Step 4: Re-run the regression tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_transfer_planner.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/dynamics/propagator.py apps/api/tests/unit/test_transfer_planner.py apps/api/tests/api/test_missions_propagate.py
git commit -m "fix: preserve no-burn propagation behavior"
```

## Chunk 3: Automatic Maneuver Planning

### Task 5: Add maneuver planner unit coverage

**Files:**
- Create: `apps/api/app/services/maneuver_planner.py`
- Create: `apps/api/tests/unit/test_maneuver_planner.py`
- Test: `apps/api/tests/unit/test_maneuver_planner.py`

- [ ] **Step 1: Write the failing maneuver planner tests**

```python
def test_maneuver_planner_places_tcm_dsm_and_arrival_windows() -> None:
    planner = ManeuverPlanner()
    maneuvers = planner.plan_candidate_windows(samples=reference_samples, closest_epoch_seconds=8_000_000)
    assert {maneuver.type for maneuver in maneuvers} <= {"TCM", "DSM", "arrivalCorrection"}
    assert len(maneuvers) <= 3


def test_maneuver_planner_rejects_invalid_propulsion_config() -> None:
    with pytest.raises(ValueError):
        ManeuverPlanner().validate_propulsion_config(...)
```

- [ ] **Step 2: Run the planner unit tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_maneuver_planner.py`
Expected: FAIL because the planner does not exist.

- [ ] **Step 3: Implement the minimal planner**

Create `apps/api/app/services/maneuver_planner.py` with:

- `validate_propulsion_config(...)`
- `plan_candidate_windows(...)`
- `estimate_correction_direction(...)`
- `build_burn_segments(...)`

For phase 1, use deterministic window placement:

- early TCM: 5-10% of flight time
- DSM: 45-60% of flight time
- arrival correction: 85-95% of flight time

- [ ] **Step 4: Re-run the planner tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_maneuver_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/maneuver_planner.py apps/api/tests/unit/test_maneuver_planner.py
git commit -m "feat: add automatic maneuver window planner"
```

### Task 6: Integrate automatic finite-thrust correction into mission and tour services

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/transfer_planner.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`

- [ ] **Step 1: Write the failing integration tests**

```python
def test_mission_service_reduces_terminal_error_with_corrections() -> None:
    result = service.propagate_mission(request_with_propulsion)
    assert result.total_propellant_used_kg > 0
    assert result.maneuver_events


def test_tour_planner_carries_maneuver_events_into_candidates() -> None:
    result = planner.plan_tour(...)
    assert result.candidates[0].maneuver_events is not None
```

- [ ] **Step 2: Run the integration tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py`
Expected: FAIL because services do not invoke the maneuver planner or include maneuver metadata.

- [ ] **Step 3: Implement service integration**

Modify `apps/api/app/services/mission_service.py` to:

- compute baseline trajectory
- invoke `ManeuverPlanner` when `propulsionConfig` is present
- re-propagate with burn segments
- populate `maneuverEvents`, `finalMassKg`, and `totalPropellantUsedKg`

Modify `apps/api/app/services/transfer_planner.py` and `apps/api/app/services/tour_planner.py` to:

- pass propulsion config through candidate planning
- attach burn-corrected trajectories to winning plans

Modify `apps/api/app/api/routes_missions.py` to:

- parse propulsion config for both mission and tour flows

- [ ] **Step 4: Re-run the integration tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd apps/api && uv run --group dev pytest -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/api/routes_missions.py apps/api/app/services/maneuver_planner.py apps/api/app/services/mission_service.py apps/api/app/services/tour_planner.py apps/api/app/services/transfer_planner.py apps/api/tests
git commit -m "feat: add automatic finite-thrust correction planning"
```

## Chunk 4: Frontend Propulsion And Maneuver UI

### Task 7: Add frontend propulsion and maneuver result types

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing API client test**

```tsx
it("parses maneuver events and propulsion metrics from mission results", async () => {
  const result = await propagateMission(...)
  expect(result.maneuverEvents?.[0].type).toBe("TCM")
  expect(result.finalMassKg).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run the frontend API tests to verify they fail**

Run: `cd apps/web && npm test -- --run src/lib/api.test.ts`
Expected: FAIL because the frontend types and client omit propulsion fields.

- [ ] **Step 3: Add minimal types**

Extend `apps/web/src/features/mission/types.ts` with:

- `PropulsionConfig`
- `ManeuverEvent`
- `finalMassKg`
- `totalPropellantUsedKg`
- `massKg` on trajectory samples if the backend exposes it

Update `apps/web/src/lib/api.ts` to preserve the new fields without reshaping them away.

- [ ] **Step 4: Re-run the frontend API tests**

Run: `cd apps/web && npm test -- --run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "test: add frontend propulsion result coverage"
```

### Task 8: Show propulsion metrics in the summary panel

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`

- [ ] **Step 1: Write the failing summary test**

```tsx
it("renders propellant usage and final mass", () => {
  render(<MissionSummary result={resultWithManeuvers} language="zh" />)
  expect(screen.getByText("推进剂消耗")).toBeInTheDocument()
  expect(screen.getByText("最终质量")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the summary test to verify it fails**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionSummary.test.tsx`
Expected: FAIL because the summary has no propulsion metrics.

- [ ] **Step 3: Implement minimal summary rendering**

Add localized labels for:

- maneuver count
- propellant used
- final mass
- active maneuver or no maneuvers

Render the new metrics only when the result includes propulsion data.

- [ ] **Step 4: Re-run the summary test**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionSummary.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/components/MissionSummary.tsx apps/web/src/features/mission/components/MissionSummary.test.tsx apps/web/src/lib/i18n.ts
git commit -m "feat: add propulsion metrics to mission summary"
```

### Task 9: Render maneuver markers and playback HUD state in the scene

**Files:**
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing scene test**

```tsx
it("renders maneuver markers and highlights active burn windows during playback", async () => {
  render(<App />)
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }))
  expect(await screen.findByText("机动事件")).toBeInTheDocument()
  expect(await screen.findByText("TCM")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the scene test to verify it fails**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: FAIL because the scene does not display maneuver markers or burn HUD state.

- [ ] **Step 3: Implement minimal maneuver visualization**

Update `apps/web/src/features/scene/components/SolarSystemScene.tsx` to:

- render distinct markers for maneuver events
- display current active maneuver metadata when playback enters a burn window
- optionally surface current mass and burn duration inside the right-side HUD

Update `apps/web/src/App.tsx` to pass the burn-aware mission result into the scene.

Update `apps/web/src/styles.css` to style:

- maneuver markers
- burn status pill
- maneuver detail panel if needed

- [ ] **Step 4: Re-run the scene test**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd apps/web && npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/styles.css apps/web/src/lib/i18n.ts
git commit -m "feat: add finite-thrust maneuver playback ui"
```

## Chunk 5: Documentation And Final Verification

### Task 10: Update docs and verify end-to-end behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-19-finite-thrust-maneuver-design.md`
- Modify: `docs/superpowers/plans/2026-03-19-finite-thrust-maneuver-implementation-plan.md`

- [ ] **Step 1: Update the README with propulsion usage**

Document:

- the new `propulsionConfig` request shape
- how automatic TCM/DSM/arrival corrections behave
- what fields to expect in the response

- [ ] **Step 2: Run backend and frontend verification**

Run: `cd apps/api && uv run --group dev pytest -v`
Expected: PASS

Run: `cd apps/web && npm test -- --run`
Expected: PASS

- [ ] **Step 3: Smoke-test the UI locally**

Run:

```bash
cd apps/api && uv run uvicorn app.main:app --reload
cd apps/web && npm run dev
```

Verify manually:

- a normal mission still works without propulsion config
- a propulsion-enabled mission shows maneuver events
- mission summary shows fuel and mass
- scene playback highlights burn windows

- [ ] **Step 4: Commit final documentation and verification updates**

```bash
git add README.md docs/superpowers/plans/2026-03-19-finite-thrust-maneuver-implementation-plan.md
git commit -m "docs: add finite-thrust maneuver usage notes"
```
