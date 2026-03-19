# Mission Dynamics Realism Phase A Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add realistic Earth departure modeling by introducing a parking-orbit segment, an Earth-escape segment, and a clean handoff into the existing heliocentric mission flow.

**Architecture:** Keep `POST /missions/propagate` as the public entry point, but internally split Earth departure into staged planners instead of starting directly from a heliocentric transfer state. Build a small segment model for Phase A only, thread it through mission responses as `segments`, and reuse the existing mission timeline UI to visualize launch, parking orbit, and Earth escape transitions.

**Tech Stack:** FastAPI, Pydantic, NumPy, SciPy, pytest, React, TypeScript, Vite, Vitest, React Testing Library

---

## Planned File Structure

### Backend

- Modify: `apps/api/app/schemas/mission.py`
- Create: `apps/api/app/services/parking_orbit_planner.py`
- Create: `apps/api/app/services/earth_escape_planner.py`
- Create: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Create: `apps/api/tests/unit/test_parking_orbit_planner.py`
- Create: `apps/api/tests/unit/test_earth_escape_planner.py`
- Create: `apps/api/tests/unit/test_mission_segments.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`

### Frontend

- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/App.test.tsx`

## Chunk 1: Backend Departure Domain

### Task 1: Add request and response schema coverage for mission segments

**Files:**
- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Write the failing API assertions for Phase A segment output**

```python
def test_propagate_returns_launch_and_escape_segments() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {"launchFromBody": {"mode": "autoTransfer"}},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "segments" in data
    segment_types = [segment["segmentType"] for segment in data["segments"]]
    assert "launchParkingOrbit" in segment_types
    assert "earthEscape" in segment_types
    assert "heliocentricCruise" in segment_types
```

- [ ] **Step 2: Run the focused API test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py::test_propagate_returns_launch_and_escape_segments`
Expected: FAIL because mission responses do not yet include `segments`.

- [ ] **Step 3: Add minimal schema types**

Extend `apps/api/app/schemas/mission.py` with:

- `LaunchProfile`
- `ParkingOrbitSummary`
- `MissionSegmentBoundaryState`
- `MissionSegment`

Add optional fields to `MissionRequest`:

- `launchProfile`

Add optional fields to propagation responses:

- `segments`

Keep defaults backward-compatible by letting missing `launchProfile` map to a default Earth parking-orbit profile internally.

- [ ] **Step 4: Re-run the focused API test**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py::test_propagate_returns_launch_and_escape_segments`
Expected: FAIL on missing segment behavior rather than missing response shape.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/mission.py apps/api/tests/api/test_missions_propagate.py
git commit -m "test: add phase-a segment schema coverage"
```

### Task 2: Add parking-orbit planner tests first

**Files:**
- Create: `apps/api/app/services/parking_orbit_planner.py`
- Create: `apps/api/tests/unit/test_parking_orbit_planner.py`
- Test: `apps/api/tests/unit/test_parking_orbit_planner.py`

- [ ] **Step 1: Write the failing parking-orbit planner tests**

```python
def test_plan_default_parking_orbit_returns_bound_earth_orbit() -> None:
    planner = ParkingOrbitPlanner()
    result = planner.plan_default_parking_orbit(
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert result.segment_type == "launchParkingOrbit"
    assert result.orbit_summary["isBound"] is True
    assert result.orbit_summary["periapsisKm"] > 6_378.1
    assert result.final_state["referenceBodyId"] == "earth"
```

- [ ] **Step 2: Run the parking-orbit tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_parking_orbit_planner.py`
Expected: FAIL because `ParkingOrbitPlanner` does not exist.

- [ ] **Step 3: Implement the minimal planner**

Create `apps/api/app/services/parking_orbit_planner.py` with:

- `ParkingOrbitPlanner`
- `plan_default_parking_orbit(...)`
- a small result dataclass with:
  - `segment_type`
  - `start_epoch`
  - `end_epoch`
  - `samples`
  - `orbit_summary`
  - `initial_state`
  - `final_state`
  - `events`

Use a simple circular or near-circular post-insertion orbit around Earth. Do not model ascent. Keep the first version deterministic.

- [ ] **Step 4: Re-run the parking-orbit tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_parking_orbit_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/parking_orbit_planner.py apps/api/tests/unit/test_parking_orbit_planner.py
git commit -m "feat: add parking orbit planner"
```

### Task 3: Add Earth-escape planner tests first

**Files:**
- Create: `apps/api/app/services/earth_escape_planner.py`
- Create: `apps/api/tests/unit/test_earth_escape_planner.py`
- Test: `apps/api/tests/unit/test_earth_escape_planner.py`

- [ ] **Step 1: Write the failing Earth-escape planner tests**

```python
def test_plan_earth_escape_returns_heliocentric_boundary_state() -> None:
    parking_result = ParkingOrbitPlanner().plan_default_parking_orbit(
        launch_epoch="2026-01-01T00:00:00Z",
    )
    planner = EarthEscapePlanner(ephemeris=bundled_ephemeris)

    result = planner.plan_escape(
        launch_epoch="2026-01-01T00:00:00Z",
        parking_final_state=parking_result.final_state,
        target_body="mars",
    )

    assert result.segment_type == "earthEscape"
    assert result.final_state["referenceFrame"] == "heliocentric-inertial"
    assert result.events[-1]["type"] == "earthSoiExit"
```

- [ ] **Step 2: Run the Earth-escape tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_earth_escape_planner.py`
Expected: FAIL because `EarthEscapePlanner` does not exist.

- [ ] **Step 3: Implement the minimal planner**

Create `apps/api/app/services/earth_escape_planner.py` with:

- `EarthEscapePlanner`
- `plan_escape(...)`
- a deterministic SOI exit estimate based on:
  - Earth-centered parking orbit boundary state
  - current Earth heliocentric state
  - transfer-planner departure target

For Phase A, solve this by:

- deriving a heliocentric departure target from the existing `TransferPlanner`
- producing an Earth-centered escape event and a heliocentric boundary state
- keeping the first implementation patched-conic and explicit about approximations

- [ ] **Step 4: Re-run the Earth-escape tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_earth_escape_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/earth_escape_planner.py apps/api/tests/unit/test_earth_escape_planner.py
git commit -m "feat: add earth escape planner"
```

## Chunk 2: Backend Integration

### Task 4: Add a shared mission-segment serializer

**Files:**
- Create: `apps/api/app/services/mission_segments.py`
- Create: `apps/api/tests/unit/test_mission_segments.py`
- Test: `apps/api/tests/unit/test_mission_segments.py`

- [ ] **Step 1: Write the failing serialization tests**

```python
def test_merge_segment_samples_offsets_epochs_monotonically() -> None:
    merged = merge_segment_samples(
        [
            {"segmentType": "launchParkingOrbit", "samples": [{"epochSeconds": 0.0}]},
            {"segmentType": "earthEscape", "samples": [{"epochSeconds": 10.0}]},
        ]
    )

    assert merged[0]["epochSeconds"] == 0.0
    assert merged[-1]["epochSeconds"] >= merged[0]["epochSeconds"]
```

- [ ] **Step 2: Run the segment tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_segments.py`
Expected: FAIL because the mission-segment helpers do not exist.

- [ ] **Step 3: Implement the serializer helpers**

Create `apps/api/app/services/mission_segments.py` with:

- `segment_to_dict(...)`
- `merge_segment_samples(...)`
- `merge_segment_events(...)`
- `build_segment_boundary_state(...)`

Keep this file focused on formatting and assembly, not physics.

- [ ] **Step 4: Re-run the segment tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_segments.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_segments.py apps/api/tests/unit/test_mission_segments.py
git commit -m "feat: add mission segment assembly helpers"
```

### Task 5: Integrate Phase A planners into mission propagation

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`

- [ ] **Step 1: Write the failing service assertions for staged departure**

```python
def test_mission_service_builds_staged_departure_segments(bundled_ephemeris) -> None:
    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    assert result.segments is not None
    assert [segment["segmentType"] for segment in result.segments][:2] == [
        "launchParkingOrbit",
        "earthEscape",
    ]
```

- [ ] **Step 2: Run the focused service tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: FAIL because `MissionService` still produces a single direct mission path.

- [ ] **Step 3: Implement staged Earth departure**

Modify `apps/api/app/services/mission_service.py` to:

- instantiate `ParkingOrbitPlanner` and `EarthEscapePlanner`
- use staged departure only for `launchFromBody.autoTransfer`
- keep explicit state-vector mode working as-is for now
- derive the heliocentric cruise initial state from the Earth-escape segment boundary state
- attach `segments` to `MissionPropagationResult`
- merge segment events into `missionTimeline`

Do not implement cruise or arrival planner refactors yet. Phase A should stop at the Earth-to-heliocentric handoff plus the existing cruise logic.

- [ ] **Step 4: Re-run the focused service tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_service.py apps/api/tests/unit/test_mission_service.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: add staged earth departure to mission propagation"
```

### Task 6: Extend mission timeline generation with Phase A segment events

**Files:**
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`

- [ ] **Step 1: Write the failing timeline assertions**

```python
def test_phase_a_timeline_includes_parking_orbit_and_earth_escape(bundled_ephemeris) -> None:
    result = MissionService(ephemeris=bundled_ephemeris).propagate(sample_auto_transfer_request())

    phase_types = [phase["type"] for phase in result.mission_timeline["phases"]]
    assert "launchParkingOrbit" in phase_types
    assert "earthEscape" in phase_types
```

- [ ] **Step 2: Run the focused timeline tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: FAIL because the timeline builder does not yet understand Phase A segment events.

- [ ] **Step 3: Add Phase A segment event support**

Modify `apps/api/app/services/mission_timeline.py` to:

- accept segment events from mission propagation
- map parking-orbit and Earth-escape segment transitions into explicit phases
- ensure generated phases remain ordered and non-overlapping with cruise/approach phases

- [ ] **Step 4: Re-run the focused timeline tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_timeline.py apps/api/tests/unit/test_mission_service.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: add phase-a mission timeline integration"
```

## Chunk 3: Frontend Integration

### Task 7: Add frontend types and form controls for launch profile

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Write the failing form test**

```tsx
it("submits the default launch profile with auto transfer missions", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="en" loading={false} />);

  await userEvent.click(screen.getByRole("button", { name: /propagate/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining({
        launchProfile: expect.objectContaining({
          mode: "parkingOrbit",
        }),
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the focused form test to verify it fails**

Run: `cd apps/web && npm test -- --runInBand src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL because `launchProfile` is not in the request shape.

- [ ] **Step 3: Add the minimal frontend shape**

Modify:

- `apps/web/src/features/mission/types.ts` to add `LaunchProfile` and `MissionSegment`
- `apps/web/src/features/mission/components/MissionForm.tsx` to submit a default `launchProfile`
- `apps/web/src/lib/i18n.ts` to add labels for parking orbit and Earth escape

Do not add many user-facing knobs yet. Phase A should expose one default parking-orbit mode first.

- [ ] **Step 4: Re-run the focused form test**

Run: `cd apps/web && npm test -- --runInBand src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx apps/web/src/lib/i18n.ts
git commit -m "feat: add phase-a launch profile request shape"
```

### Task 8: Render Phase A segment information in summary and scene

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing app-level assertions**

```tsx
it("renders parking orbit and earth escape segment labels", async () => {
  render(<App />);
  // mock propagated result with `segments`
  expect(await screen.findByText(/Parking Orbit/i)).toBeInTheDocument();
  expect(await screen.findByText(/Earth Escape/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused app test to verify it fails**

Run: `cd apps/web && npm test -- --runInBand src/App.test.tsx`
Expected: FAIL because the app does not render segment-level mission data.

- [ ] **Step 3: Implement minimal Phase A rendering**

Modify:

- `apps/web/src/features/mission/components/MissionSummary.tsx` to show the first few segment labels and boundary epochs
- `apps/web/src/features/scene/components/SolarSystemScene.tsx` to show the current segment and key Earth departure event in the HUD

Keep the first version textual. Do not add new complex view modes in Phase A.

- [ ] **Step 4: Re-run the focused app test**

Run: `cd apps/web && npm test -- --runInBand src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/components/MissionSummary.tsx apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/App.test.tsx
git commit -m "feat: render phase-a segment data in the ui"
```

## Chunk 4: Verification And Documentation

### Task 9: Verify the full Phase A flow end to end

**Files:**
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add one end-to-end regression assertion per side**

Backend assertion:

```python
assert data["segments"][0]["segmentType"] == "launchParkingOrbit"
assert any(event["type"] == "earthSoiExit" for event in data["missionTimeline"]["events"])
```

Frontend assertion:

```tsx
expect(screen.getByText(/Earth Escape/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused regression tests to verify they fail before the final wiring**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py`
Expected: FAIL if any final response-field wiring is still missing.

Run: `cd apps/web && npm test -- --runInBand src/App.test.tsx`
Expected: FAIL if any final UI wiring is still missing.

- [ ] **Step 3: Fix the final response and rendering gaps**

Modify only the minimal files needed to make the Phase A mission path consistent.

- [ ] **Step 4: Run the full verification suite**

Run: `cd apps/api && uv run --group dev pytest -v`
Expected: PASS.

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/api/test_missions_propagate.py apps/web/src/App.test.tsx
git commit -m "test: verify phase-a mission dynamics realism flow"
```

### Task 10: Update developer documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the failing docs TODO note in the plan tracker**

Document in the working branch notes that README still assumes direct heliocentric departure and must be updated after Phase A lands.

- [ ] **Step 2: Update the README**

Add a short section describing:

- default parking-orbit departure
- Earth-escape segment
- new `segments` response field

- [ ] **Step 3: Verify the docs mention the new flow accurately**

Run: `rg "parking orbit|Earth escape|segments" README.md`
Expected: three matching documentation lines or sections.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe phase-a earth departure realism"
```
