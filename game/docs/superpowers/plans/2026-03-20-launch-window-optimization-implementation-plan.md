# Launch Window Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add realistic launch-window search for both single-target missions and multi-planet tours, make recommended-window planning the default UI path, and keep manual launch-date override available.

**Architecture:** Add a dedicated backend launch-window search layer in front of the existing transfer and tour planners, then add a new `/missions/launch-window` API that returns a recommended date, a window range, and ranked candidate dates. Update the mission form to request launch-window recommendations first, let the user keep the recommendation, pick another date inside the window, or switch to manual mode, then submit the chosen `launchEpoch` to the existing execution endpoints.

**Tech Stack:** FastAPI, Pydantic, NumPy/SciPy-based transfer planning, Vitest, React, TypeScript

---

## File Map

### Backend

- Create: `apps/api/app/services/launch_window_search.py`
  Purpose: search candidate launch dates, evaluate them, refine minima, and build launch-window responses.
- Create: `apps/api/tests/unit/test_launch_window_search.py`
  Purpose: unit-test adaptive search horizons, scoring, and window construction.
- Modify: `apps/api/app/schemas/mission.py`
  Purpose: add request/response models for launch-window planning.
- Modify: `apps/api/app/api/routes_missions.py`
  Purpose: expose `POST /missions/launch-window`.
- Modify: `apps/api/app/services/transfer_planner.py`
  Purpose: expose enough structured data for single-target launch-window scoring without changing propagation behavior.
- Modify: `apps/api/app/services/tour_planner.py`
  Purpose: expose enough structured data for tour launch-window scoring and candidate summaries.
- Modify: `apps/api/tests/api/test_missions_propagate.py`
  Purpose: keep existing mission execution expectations aligned once launch-window planning is introduced.
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
  Purpose: keep existing tour execution coverage aligned with final launch-date handoff.
- Create: `apps/api/tests/api/test_missions_launch_window.py`
  Purpose: API coverage for single-target and tour launch-window results.

### Frontend

- Modify: `apps/web/src/features/mission/types.ts`
  Purpose: add launch-window request/response and planning-mode types.
- Modify: `apps/web/src/lib/api.ts`
  Purpose: add `fetchLaunchWindow(...)`.
- Create: `apps/web/src/lib/api.test.ts` updates
  Purpose: verify launch-window API request/response handling.
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
  Purpose: add recommended/window/manual launch planning modes and integrate launch-window lookup.
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
  Purpose: cover the new planning modes and final `launchEpoch` handoff.
- Modify: `apps/web/src/App.tsx`
  Purpose: support the launch-window lookup flow before propagation/tour execution.
- Modify: `apps/web/src/App.test.tsx`
  Purpose: cover the end-to-end launch-window-first flow.
- Modify: `apps/web/src/lib/i18n.ts`
  Purpose: add copy for launch-window planning, recommendations, warnings, and manual override labels.

## Chunk 1: Backend Search Foundations

### Task 1: Add Launch-Window Search Models

**Files:**
- Modify: `apps/api/app/schemas/mission.py`
- Test: `apps/api/tests/api/test_missions_launch_window.py`

- [ ] **Step 1: Write the failing API schema test**

```python
def test_launch_window_endpoint_accepts_trajectory_request_shape(client) -> None:
    response = client.post(
        "/missions/launch-window",
        json={
            "missionType": "trajectory",
            "departureBody": "earth",
            "targetBody": "mars",
            "earliestLaunchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code != 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_launch_window.py::test_launch_window_endpoint_accepts_trajectory_request_shape`

Expected: FAIL because the endpoint or request model does not exist yet.

- [ ] **Step 3: Add minimal launch-window request/response models**

```python
class LaunchWindowRequest(BaseModel):
    missionType: Literal["trajectory", "tour"]
    departureBody: str = Field(min_length=1)
    targetBody: Optional[str] = None
    requiredVisitBodies: Optional[List[str]] = None
    earliestLaunchEpoch: Optional[str] = None
    propulsionConfig: Optional[PropulsionConfig] = None


class LaunchWindowCandidate(BaseModel):
    launchEpoch: str
    score: float
    deltaVKmPerS: float
    flightTimeSeconds: float
```

- [ ] **Step 4: Run test to verify the schema is now accepted**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_launch_window.py::test_launch_window_endpoint_accepts_trajectory_request_shape`

Expected: PASS or move from request-shape failure to missing route behavior, depending on implementation order.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/mission.py apps/api/tests/api/test_missions_launch_window.py
git commit -m "feat: add launch window request models"
```

### Task 2: Add Search Service Skeleton

**Files:**
- Create: `apps/api/app/services/launch_window_search.py`
- Test: `apps/api/tests/unit/test_launch_window_search.py`

- [ ] **Step 1: Write the failing unit test for adaptive search horizon**

```python
def test_launch_window_search_uses_shorter_horizon_for_inner_planets(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)

    horizon_days = service._search_horizon_days(mission_type="trajectory", target_body="mars")

    assert horizon_days == 730
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py::test_launch_window_search_uses_shorter_horizon_for_inner_planets`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal service skeleton**

```python
class LaunchWindowSearchService:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris

    def _search_horizon_days(self, *, mission_type: str, target_body: str | None) -> int:
        if mission_type == "tour":
            return 5 * 365
        if target_body in {"mercury", "venus", "mars"}:
            return 2 * 365
        return 5 * 365
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py::test_launch_window_search_uses_shorter_horizon_for_inner_planets`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/launch_window_search.py apps/api/tests/unit/test_launch_window_search.py
git commit -m "feat: add launch window search service skeleton"
```

## Chunk 2: Single-Target Launch-Window Planning

### Task 3: Implement Single-Target Candidate Evaluation

**Files:**
- Modify: `apps/api/app/services/launch_window_search.py`
- Modify: `apps/api/app/services/transfer_planner.py`
- Test: `apps/api/tests/unit/test_launch_window_search.py`

- [ ] **Step 1: Write the failing single-target result test**

```python
def test_launch_window_search_returns_ranked_single_target_candidates(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)

    result = service.search_trajectory_window(
        departure_body="earth",
        target_body="mars",
        earliest_launch_epoch="2026-01-01T00:00:00Z",
    )

    assert result.recommended_launch_epoch.endswith("Z")
    assert result.window_start_epoch <= result.recommended_launch_epoch <= result.window_end_epoch
    assert len(result.candidate_launches) >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py::test_launch_window_search_returns_ranked_single_target_candidates`

Expected: FAIL because search execution is not implemented yet.

- [ ] **Step 3: Implement minimal single-target search**

```python
def search_trajectory_window(...):
    candidate_epochs = self._coarse_candidate_epochs(...)
    candidates = [self._evaluate_trajectory_candidate(...) for epoch in candidate_epochs]
    viable = [candidate for candidate in candidates if candidate is not None]
    best = min(viable, key=lambda candidate: candidate.score)
    return self._build_window_result(best, viable)
```

Use `TransferPlanner.plan_auto_transfer(...)` as the scoring source rather than adding a second transfer solver.

- [ ] **Step 4: Run the focused test and then the unit file**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py::test_launch_window_search_returns_ranked_single_target_candidates tests/unit/test_launch_window_search.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/launch_window_search.py apps/api/app/services/transfer_planner.py apps/api/tests/unit/test_launch_window_search.py
git commit -m "feat: add single-target launch window search"
```

### Task 4: Expose `/missions/launch-window` For Trajectory Missions

**Files:**
- Modify: `apps/api/app/api/routes_missions.py`
- Modify: `apps/api/tests/api/test_missions_launch_window.py`

- [ ] **Step 1: Write the failing trajectory API test**

```python
def test_launch_window_returns_trajectory_window_payload(client) -> None:
    response = client.post(
        "/missions/launch-window",
        json={
            "missionType": "trajectory",
            "departureBody": "earth",
            "targetBody": "mars",
            "earliestLaunchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert "recommendedLaunchEpoch" in payload
    assert "candidateLaunches" in payload
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_launch_window.py::test_launch_window_returns_trajectory_window_payload`

Expected: FAIL because the route is missing or incomplete.

- [ ] **Step 3: Add the route and wire the service**

```python
@router.post("/launch-window")
def launch_window(request: LaunchWindowRequest) -> dict:
    service = LaunchWindowSearchService(ephemeris=create_ephemeris(DATA_PATH))
    if request.missionType == "trajectory":
        return service.search_trajectory_window(...).to_dict()
    return service.search_tour_window(...).to_dict()
```

- [ ] **Step 4: Run the API test and impacted route tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_launch_window.py tests/api/test_missions_propagate.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/api/routes_missions.py apps/api/tests/api/test_missions_launch_window.py
git commit -m "feat: add trajectory launch window API"
```

## Chunk 3: Tour Launch-Window Planning

### Task 5: Implement Tour Candidate Evaluation

**Files:**
- Modify: `apps/api/app/services/launch_window_search.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/tests/unit/test_launch_window_search.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`

- [ ] **Step 1: Write the failing tour search unit test**

```python
def test_launch_window_search_returns_ranked_tour_candidates(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)

    result = service.search_tour_window(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        earliest_launch_epoch="2026-01-01T00:00:00Z",
    )

    assert result.candidate_launches
    assert result.candidate_launches[0]["visitOrder"] == ["venus", "jupiter", "saturn"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py::test_launch_window_search_returns_ranked_tour_candidates`

Expected: FAIL because tour-window execution is missing.

- [ ] **Step 3: Implement tour search using existing planner results**

```python
def _evaluate_tour_candidate(...):
    candidates = self.tour_planner.plan_tour(...)
    best = candidates[0] if candidates else None
    if best is None:
        return None
    return LaunchWindowCandidatePayload(
        launch_epoch=launch_epoch,
        score=best.score,
        delta_v_km_per_s=best.total_delta_v_km_per_s,
        flight_time_seconds=best.total_flight_time_seconds,
        visit_order=list(best.visit_order),
        full_sequence_bodies=list(best.full_sequence_bodies),
    )
```

- [ ] **Step 4: Run focused tour tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py tests/unit/test_tour_planner.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/launch_window_search.py apps/api/app/services/tour_planner.py apps/api/tests/unit/test_launch_window_search.py apps/api/tests/unit/test_tour_planner.py
git commit -m "feat: add tour launch window search"
```

### Task 6: Expose Tour Launch-Window API Coverage

**Files:**
- Modify: `apps/api/tests/api/test_missions_launch_window.py`
- Modify: `apps/api/app/api/routes_missions.py`

- [ ] **Step 1: Write the failing tour API test**

```python
def test_launch_window_returns_tour_window_payload(client) -> None:
    response = client.post(
        "/missions/launch-window",
        json={
            "missionType": "tour",
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter", "saturn"],
            "earliestLaunchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["candidateLaunches"][0]["visitOrder"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_launch_window.py::test_launch_window_returns_tour_window_payload`

Expected: FAIL until tour-mode response is fully wired.

- [ ] **Step 3: Finalize route branching and response fields**

```python
if request.missionType == "tour":
    return service.search_tour_window(
        departure_body=request.departureBody,
        required_visit_bodies=tuple(request.requiredVisitBodies or []),
        earliest_launch_epoch=request.earliestLaunchEpoch,
        propulsion_config=request.propulsionConfig,
    ).to_dict()
```

- [ ] **Step 4: Run the launch-window API suite**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_launch_window.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/api/routes_missions.py apps/api/tests/api/test_missions_launch_window.py
git commit -m "feat: add tour launch window API"
```

## Chunk 4: Frontend Launch Planning UX

### Task 7: Add Launch-Window Types And API Client

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing API client test**

```ts
it("fetches launch window recommendations", async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ recommendedLaunchEpoch: "2026-10-12T00:00:00Z", candidateLaunches: [] }), { status: 200 }),
  ) as unknown as typeof fetch;

  await fetchLaunchWindow({
    missionType: "trajectory",
    departureBody: "earth",
    targetBody: "mars",
  });

  expect(globalThis.fetch).toHaveBeenCalledWith("/missions/launch-window", expect.any(Object));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npm test -- src/lib/api.test.ts`

Expected: FAIL because `fetchLaunchWindow` and types do not exist yet.

- [ ] **Step 3: Add minimal types and API helper**

```ts
export type LaunchWindowRequest = { ... };
export type LaunchWindowResponse = { ... };

export async function fetchLaunchWindow(request: LaunchWindowRequest): Promise<LaunchWindowResponse> {
  const response = await fetch(createApiUrl("/missions/launch-window"), { ... });
  if (!response.ok) throw new Error(`Launch window request failed with status ${response.status}`);
  return (await response.json()) as LaunchWindowResponse;
}
```

- [ ] **Step 4: Run the API client tests**

Run: `cd apps/web && npm test -- src/lib/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat: add launch window frontend API client"
```

### Task 8: Add Recommended / Window / Manual Planning Modes

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing MissionForm test for default mode**

```ts
it("defaults to recommended launch window mode", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByLabelText("发射方案")).toHaveValue("recommendedWindow");
});
```

- [ ] **Step 2: Run the focused form test to verify it fails**

Run: `cd apps/web && npm test -- src/features/mission/components/MissionForm.test.tsx`

Expected: FAIL because launch-planning modes are not present.

- [ ] **Step 3: Add planning mode state and launch-window display**

```ts
const [launchPlanningMode, setLaunchPlanningMode] = useState<"recommendedWindow" | "windowSelect" | "manual">("recommendedWindow");
const [launchWindowResult, setLaunchWindowResult] = useState<LaunchWindowResponse | null>(null);
```

Add UI for:

- recommended window summary
- best launch date
- date picker/input inside the window
- manual override mode

- [ ] **Step 4: Update App submit flow to request the launch window first**

```ts
const launchWindow = await fetchLaunchWindow(buildLaunchWindowRequest(...));
const effectiveLaunchEpoch = resolveEffectiveLaunchEpoch(launchPlanningMode, launchWindow, manualLaunchEpoch, selectedWindowEpoch);
```

Only after that should the app call:

- `propagateMission(...)`
- `planMissionTour(...)`

- [ ] **Step 5: Run impacted frontend tests**

Run: `cd apps/web && npm test -- src/features/mission/components/MissionForm.test.tsx src/App.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx apps/web/src/lib/i18n.ts apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat: add launch window planning UI"
```

## Chunk 5: Integration Verification

### Task 9: Verify End-To-End Behavior And Preserve Existing Flows

**Files:**
- Modify: only if test failures demand small compatibility fixes
- Test: `apps/api/tests/api/test_missions_launch_window.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/api/test_missions_plan_tour.py`
- Test: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Test: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Run focused backend launch-window suite**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_launch_window_search.py tests/api/test_missions_launch_window.py`

Expected: PASS

- [ ] **Step 2: Run impacted backend regression suite**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py tests/unit/test_transfer_planner.py tests/unit/test_tour_planner.py`

Expected: PASS

- [ ] **Step 3: Run focused frontend suite**

Run: `cd apps/web && npm test -- src/features/mission/components/MissionForm.test.tsx src/lib/api.test.ts src/App.test.tsx`

Expected: PASS

- [ ] **Step 4: Run full frontend suite**

Run: `cd apps/web && npm test`

Expected: PASS

- [ ] **Step 5: Run full backend suite**

Run: `cd apps/api && uv run --group dev pytest`

Expected: PASS

- [ ] **Step 6: Final commit**

```bash
git add apps/api apps/web
git commit -m "feat: add launch window optimization workflow"
```
