# Mission Phase Timeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-generated mission phase timeline for single-target missions, gravity-assist missions, and tour candidates, then render the current phase, next event, and segmented phase timeline in the existing playback UI.

**Architecture:** Build the feature as an event-driven layer on top of the current astrodynamics outputs rather than adding a parallel mission engine. Extract normalized mission events from existing mission/tour results, convert them into non-overlapping mission phases, return a `missionTimeline` object through current API responses, and drive a lightweight playback HUD plus segmented timeline from that object in the frontend.

**Tech Stack:** FastAPI, Pydantic, NumPy, pytest, React, TypeScript, Vite, Vitest, React Testing Library, Three.js

---

## Planned File Structure

### Backend

- Modify: `apps/api/app/schemas/mission.py`
- Create: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Create: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`

### Frontend

- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Create: `apps/web/src/features/scene/lib/mission-timeline.ts`
- Create: `apps/web/src/features/scene/lib/mission-timeline.test.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`

## Chunk 1: Backend Timeline Domain

### Task 1: Add schema coverage for mission timeline

**Files:**
- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Write the failing API assertions for `missionTimeline`**

```python
def test_propagate_returns_mission_timeline() -> None:
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
    assert "missionTimeline" in data
    assert "events" in data["missionTimeline"]
    assert "phases" in data["missionTimeline"]
```

- [ ] **Step 2: Run the focused API tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py`
Expected: FAIL because `missionTimeline` is not defined in the response shape.

- [ ] **Step 3: Add minimal response schemas**

Extend `apps/api/app/schemas/mission.py` with:

- `MissionTimelineEvent`
- `MissionPhase`
- `MissionTimeline`

Add `missionTimeline` to:

- mission propagation responses
- tour candidate responses

- [ ] **Step 4: Re-run the focused API tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py`
Expected: FAIL on missing behavior rather than missing schema fields.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/mission.py apps/api/tests/api/test_missions_propagate.py apps/api/tests/api/test_missions_plan_tour.py
git commit -m "test: add mission timeline schema coverage"
```

### Task 2: Build the mission timeline extractor tests first

**Files:**
- Create: `apps/api/app/services/mission_timeline.py`
- Create: `apps/api/tests/unit/test_mission_timeline.py`
- Test: `apps/api/tests/unit/test_mission_timeline.py`

- [ ] **Step 1: Write failing extractor and phase-builder tests**

```python
def test_build_timeline_includes_launch_escape_and_arrival() -> None:
    timeline = build_mission_timeline(
        launch_epoch="2026-01-01T00:00:00Z",
        samples=[...],
        closest_approach={...},
        maneuver_events=[],
        flyby_events=[],
        visit_events=[],
        target_body="mars",
    )

    phase_types = [phase["type"] for phase in timeline["phases"]]
    assert "launch" in phase_types
    assert "earthEscape" in phase_types
    assert "targetApproach" in phase_types
    assert "arrivalPass" in phase_types
```

- [ ] **Step 2: Run the timeline unit tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_timeline.py`
Expected: FAIL because the timeline service does not exist.

- [ ] **Step 3: Implement the minimal timeline builder**

Create `apps/api/app/services/mission_timeline.py` with:

- `build_mission_timeline(...)`
- helper functions for:
  - launch event creation
  - Earth escape estimation
  - maneuver event normalization
  - flyby event normalization
  - target approach window derivation
  - arrival/science/downlink heuristic windows
  - non-overlapping phase normalization

Keep the first version deterministic and rule-based.

- [ ] **Step 4: Re-run the timeline tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_timeline.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_timeline.py apps/api/tests/unit/test_mission_timeline.py
git commit -m "feat: add mission timeline builder"
```

## Chunk 2: Backend Integration

### Task 3: Attach mission timelines to single-mission results

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`

- [ ] **Step 1: Write failing service assertions**

```python
def test_mission_service_attaches_timeline() -> None:
    service = MissionService(...)
    result = service.propagate(...)

    assert result.mission_timeline is not None
    assert result.to_dict()["missionTimeline"]["phases"]
```

- [ ] **Step 2: Run the focused backend tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: FAIL because mission results do not yet carry a timeline.

- [ ] **Step 3: Implement timeline attachment in mission propagation**

Modify `apps/api/app/services/mission_service.py` to:

- add `mission_timeline` to `MissionPropagationResult`
- call `build_mission_timeline(...)` after closest approach, maneuver events, flyby events, and visit events are known
- serialize `missionTimeline` in `to_dict()`

Use the same code path for:

- plain auto-transfer missions
- gravity-assist missions
- finite-thrust missions

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_service.py apps/api/tests/unit/test_mission_service.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: add mission timelines to propagated missions"
```

### Task 4: Attach mission timelines to tour candidates

**Files:**
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Test: `apps/api/tests/unit/test_tour_planner.py`

- [ ] **Step 1: Write failing tour assertions**

```python
def test_tour_candidates_include_timeline() -> None:
    planner = MissionTourPlanner(...)
    candidates = planner.plan_tour(...)

    assert candidates[0].mission_timeline is not None
    assert candidates[0].to_dict()["missionTimeline"]["events"]
```

- [ ] **Step 2: Run the focused tour tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py`
Expected: FAIL because tour candidates do not yet expose mission timelines.

- [ ] **Step 3: Implement timeline support in tour planner**

Modify `apps/api/app/services/tour_planner.py` to:

- add `mission_timeline` to `MissionTourCandidate`
- build a timeline per candidate using:
  - candidate samples
  - candidate flyby events
  - candidate visit events
  - optional maneuver events
- serialize the timeline in `to_dict()`

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/tour_planner.py apps/api/tests/unit/test_tour_planner.py apps/api/tests/api/test_missions_plan_tour.py
git commit -m "feat: add mission timelines to tour candidates"
```

## Chunk 3: Frontend Timeline Presentation

### Task 5: Add frontend timeline types and utilities

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Create: `apps/web/src/features/scene/lib/mission-timeline.ts`
- Create: `apps/web/src/features/scene/lib/mission-timeline.test.ts`
- Test: `apps/web/src/features/scene/lib/mission-timeline.test.ts`

- [ ] **Step 1: Write failing utility tests**

```ts
it("finds the current phase and next event for a playback step", () => {
  const result = getMissionTimelineSnapshot(timeline, "2026-01-08T00:00:00Z");
  expect(result.currentPhase?.type).toBe("deepSpaceCruise");
  expect(result.nextEvent?.type).toBe("maneuver");
});
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `cd apps/web && npm test -- --run src/features/scene/lib/mission-timeline.test.ts`
Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Implement minimal mission timeline helpers**

Create `apps/web/src/features/scene/lib/mission-timeline.ts` with:

- `getMissionTimelineSnapshot(...)`
- `getTimelineProgress(...)`
- helper lookup for phase/event by current epoch

Extend `apps/web/src/features/mission/types.ts` with:

- `MissionTimelineEvent`
- `MissionPhase`
- `MissionTimeline`

- [ ] **Step 4: Re-run the focused frontend tests**

Run: `cd apps/web && npm test -- --run src/features/scene/lib/mission-timeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/features/scene/lib/mission-timeline.ts apps/web/src/features/scene/lib/mission-timeline.test.ts
git commit -m "feat: add mission timeline frontend utilities"
```

### Task 6: Render current phase and next event in the scene HUD

**Files:**
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing UI assertions**

```tsx
it("shows current phase and next event after propagation", async () => {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("当前阶段")).toBeInTheDocument();
  expect(screen.getByText("下一事件")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: FAIL because the HUD does not render mission phase information.

- [ ] **Step 3: Implement the mission phase HUD**

Modify `apps/web/src/features/scene/components/SolarSystemScene.tsx` to:

- read `result.missionTimeline`
- compute the current phase and next event from the playback epoch
- render:
  - current phase title
  - current phase description
  - next event title
  - time until next event

Add localized labels in `apps/web/src/lib/i18n.ts`.

Add layout styles in `apps/web/src/styles.css`.

- [ ] **Step 4: Re-run the focused UI test**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/lib/i18n.ts apps/web/src/App.test.tsx apps/web/src/styles.css
git commit -m "feat: add mission phase hud to scene"
```

## Chunk 4: Segmented Timeline And End-to-End Validation

### Task 7: Add segmented mission phase timeline to playback

**Files:**
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing segmented timeline assertions**

```tsx
it("renders mission phase timeline segments", async () => {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByTestId("mission-phase-timeline")).toBeInTheDocument();
  expect(screen.getAllByTestId(/mission-phase-segment-/).length).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: FAIL because the segmented timeline does not exist.

- [ ] **Step 3: Implement the segmented timeline**

Modify `apps/web/src/features/scene/components/SolarSystemScene.tsx` to:

- render a color-coded mission timeline bar
- highlight current phase progress
- keep the bar synchronized with playback

Use CSS-driven segments in `apps/web/src/styles.css`.

Only pass through data already present on `result.missionTimeline`; avoid adding a new API call.

- [ ] **Step 4: Re-run the focused UI test**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/App.tsx apps/web/src/styles.css apps/web/src/App.test.tsx
git commit -m "feat: add segmented mission timeline playback"
```

### Task 8: Run full validation and document expected behavior

**Files:**
- Modify: `README.md`
- Test: `apps/api/tests/unit/test_mission_timeline.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/api/test_missions_plan_tour.py`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add a short README section for mission phases**

Document:

- that responses now include `missionTimeline`
- what phase categories exist
- that the scene HUD and timeline use those fields

- [ ] **Step 2: Run the backend timeline tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_timeline.py tests/unit/test_mission_service.py tests/unit/test_tour_planner.py tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py`
Expected: PASS.

- [ ] **Step 3: Run the frontend timeline tests**

Run: `cd apps/web && npm test -- --run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md apps/api/tests apps/web/src
git commit -m "docs: add mission timeline usage notes"
```
