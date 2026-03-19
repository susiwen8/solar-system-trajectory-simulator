# Mission Dynamics Realism Phase B Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the simulator's midcourse mission flow so cruise maneuvers and gravity assists become real mission segments with meaningful physics, shared mass accounting, and minimal textual UI support.

**Architecture:** Keep the existing mission APIs, but move midcourse behavior into segment-owned planners. Introduce a dedicated `CruisePlanner` for planner-owned `heliocentricCruise` segments, add a `FlybyPlanner` that converts ranked assist outputs into standardized `gravityAssistFlyby` segments, and reuse the current timeline/summary UI by feeding it richer segment metadata instead of building new views.

**Tech Stack:** FastAPI, Pydantic, NumPy, pytest, React, TypeScript, Vitest, React Testing Library

---

## Planned File Structure

### Backend

- Create: `apps/api/app/services/cruise_planner.py`
- Create: `apps/api/app/services/flyby_planner.py`
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/app/services/gravity_assist_search.py`
- Modify: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/app/schemas/mission.py`
- Create: `apps/api/tests/unit/test_cruise_planner.py`
- Create: `apps/api/tests/unit/test_flyby_planner.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`

### Frontend

- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

## Chunk 1: Cruise Segment Ownership

### Task 1: Add failing cruise-planner tests

**Files:**
- Create: `apps/api/tests/unit/test_cruise_planner.py`
- Test: `apps/api/tests/unit/test_cruise_planner.py`

- [ ] **Step 1: Write failing tests for planner-owned cruise output**

```python
def test_cruise_planner_builds_segment_with_mass_summary() -> None:
    planner = CruisePlanner()
    segment = planner.plan_segment(
        launch_epoch="2026-01-01T00:00:00Z",
        start_epoch="2026-01-01T06:00:00Z",
        target_body="mars",
        samples=[...],
        maneuver_events=[...],
    )

    assert segment.segment_type == "heliocentricCruise"
    assert segment.mass_summary["massBeforeKg"] == 1800.0
    assert segment.mass_summary["massAfterKg"] < 1800.0
    assert segment.metadata["maneuverCount"] == 2
```

- [ ] **Step 2: Run the focused planner test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_cruise_planner.py`
Expected: FAIL because `CruisePlanner` does not exist.

- [ ] **Step 3: Implement minimal `CruisePlanner`**

Create `apps/api/app/services/cruise_planner.py` with:

- `CruisePlanner`
- `CruisePlan` dataclass
- `plan_segment(...)`

The first implementation should:

- accept existing mission samples rather than replacing the propagator
- emit a standard `heliocentricCruise` segment
- compute `mass_summary` from maneuver events when present
- attach metadata for maneuver count, target body, total delta-v, and closest-approach estimate

- [ ] **Step 4: Re-run the focused planner test**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_cruise_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/cruise_planner.py apps/api/tests/unit/test_cruise_planner.py
git commit -m "feat: add planner-owned cruise segment"
```

### Task 2: Integrate `CruisePlanner` into mission propagation

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Write failing service/API assertions for cruise segment metadata**

Add assertions such as:

```python
cruise_segment = next(segment for segment in result.segments if segment["segmentType"] == "heliocentricCruise")
assert cruise_segment["metadata"]["maneuverCount"] >= 0
assert "massSummary" in cruise_segment
```

For propulsion-enabled propagation:

```python
assert cruise_segment["massSummary"]["massAfterKg"] == result.final_mass_kg
```

- [ ] **Step 2: Run the focused service/API tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: FAIL on missing cruise-segment ownership or mass summary fields.

- [ ] **Step 3: Replace synthetic cruise assembly with `CruisePlanner`**

Modify `MissionService` and `mission_segments.py` so that:

- the cruise segment is built by `CruisePlanner`
- segment metadata and mass summaries are serialized
- top-level `finalMassKg` and `totalPropellantUsedKg` stay intact

- [ ] **Step 4: Re-run the focused service/API tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_service.py apps/api/app/services/mission_segments.py apps/api/tests/unit/test_mission_service.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: integrate cruise planner into mission propagation"
```

## Chunk 2: Cruise Timeline And Segment Metadata

### Task 3: Add cruise-maneuver timeline coverage

**Files:**
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Test: `apps/api/tests/unit/test_mission_timeline.py`

- [ ] **Step 1: Add a failing timeline test for cruise maneuver phases**

```python
def test_build_timeline_includes_cruise_maneuver_phase() -> None:
    timeline = build_mission_timeline(..., maneuver_events=[...], segment_events=[...])
    assert any(phase["type"] == "maneuverExecution" for phase in timeline["phases"])
```

- [ ] **Step 2: Run the focused timeline test to verify it fails when needed**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_timeline.py::test_build_timeline_includes_cruise_maneuver_phase`
Expected: FAIL if timeline still misses the intended segment-aware phase/event behavior.

- [ ] **Step 3: Make the minimal timeline update**

Ensure cruise maneuver phases and their relation to cruise segments are preserved without breaking Phase A departure events.

- [ ] **Step 4: Re-run the focused timeline test**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_timeline.py::test_build_timeline_includes_cruise_maneuver_phase`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_timeline.py apps/api/tests/unit/test_mission_timeline.py
git commit -m "feat: extend mission timeline for cruise segment coverage"
```

## Chunk 3: Flyby Segment Standardization

### Task 4: Add failing flyby-planner tests

**Files:**
- Create: `apps/api/tests/unit/test_flyby_planner.py`
- Create: `apps/api/app/services/flyby_planner.py`
- Test: `apps/api/tests/unit/test_flyby_planner.py`

- [ ] **Step 1: Write failing tests for flyby segment geometry output**

```python
def test_flyby_planner_builds_geometry_rich_segment() -> None:
    planner = FlybyPlanner()
    segment = planner.plan_segment(candidate_event=..., inbound_epoch=..., outbound_epoch=...)

    assert segment.segment_type == "gravityAssistFlyby"
    assert segment.metadata["turnAngleDeg"] > 0
    assert "bPlaneLike" in segment.metadata
```

- [ ] **Step 2: Run the focused planner test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_flyby_planner.py`
Expected: FAIL because `FlybyPlanner` does not exist.

- [ ] **Step 3: Implement minimal `FlybyPlanner`**

Create `apps/api/app/services/flyby_planner.py` with:

- `FlybyPlanner`
- `FlybyPlan` dataclass
- `plan_segment(...)`

The first implementation should:

- wrap existing flyby event geometry into a standard segment
- emit approach/periapsis/departure events
- include lightweight `bPlaneLike` metadata

- [ ] **Step 4: Re-run the focused planner test**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_flyby_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/flyby_planner.py apps/api/tests/unit/test_flyby_planner.py
git commit -m "feat: add flyby planner"
```

### Task 5: Thread flyby segments through tour candidates

**Files:**
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/app/services/gravity_assist_search.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Modify: `apps/api/app/schemas/mission.py`
- Test: `apps/api/tests/unit/test_tour_planner.py`
- Test: `apps/api/tests/api/test_missions_plan_tour.py`

- [ ] **Step 1: Add failing tour/API assertions for flyby segments**

Add assertions such as:

```python
assert candidate["segments"]
assert any(segment["segmentType"] == "gravityAssistFlyby" for segment in candidate["segments"])
```

- [ ] **Step 2: Run the focused tour/API tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py`
Expected: FAIL on missing candidate segment data.

- [ ] **Step 3: Integrate `FlybyPlanner` into tour assembly**

Modify the tour stack so that:

- `MissionTourCandidate` can carry `segments`
- flyby events remain available as compatibility fields
- flyby geometry is also available through standardized `gravityAssistFlyby` segments

- [ ] **Step 4: Re-run the focused tour/API tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/tour_planner.py apps/api/app/services/gravity_assist_search.py apps/api/app/schemas/mission.py apps/api/tests/unit/test_tour_planner.py apps/api/tests/api/test_missions_plan_tour.py
git commit -m "feat: add flyby segments to tour results"
```

## Chunk 4: Frontend Textual Integration

### Task 6: Add frontend support for cruise mass and flyby segment metadata

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests for cruise/flyby text**

Add assertions such as:

```tsx
expect(await screen.findByText(/Flyby Geometry/i)).toBeInTheDocument();
expect(await screen.findByText(/Turn Angle/i)).toBeInTheDocument();
expect(await screen.findByText(/Maneuver Count/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/mission/components/MissionSummary.test.tsx src/App.test.tsx`
Expected: FAIL because the new textual details are not rendered yet.

- [ ] **Step 3: Implement minimal textual rendering**

Extend the frontend types and components so the UI can show:

- cruise segment labels and maneuver totals
- segment mass summaries
- flyby body and geometry text

Do not add a new visualization mode.

- [ ] **Step 4: Re-run the focused frontend tests**

Run: `cd apps/web && npm test -- src/features/mission/components/MissionSummary.test.tsx src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/features/mission/components/MissionSummary.tsx apps/web/src/features/mission/components/MissionSummary.test.tsx apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/lib/i18n.ts apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat: render phase-b cruise and flyby mission data"
```

## Chunk 5: Verification

### Task 7: Run full Phase B verification

**Files:**
- Modify: `README.md` if verification reveals documentation gaps

- [ ] **Step 1: Run the backend suite**

Run: `cd apps/api && uv run --group dev pytest -v`
Expected: PASS.

- [ ] **Step 2: Run the frontend suite**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: Spot-check docs if any API shape changed materially**

Run: `rg "segments|flyby|cruise|propellant" README.md`
Expected: matches are present or no change is needed.

- [ ] **Step 4: Commit any verification/doc fixups**

```bash
git add README.md
git commit -m "test: verify phase-b cruise and flyby realism flow"
```
