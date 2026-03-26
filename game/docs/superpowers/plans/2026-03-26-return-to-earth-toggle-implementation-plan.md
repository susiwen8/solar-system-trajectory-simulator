# Return To Earth Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mission-form toggle that lets users choose whether a selected planet mission ends at the last visit body or returns to Earth through a real solved final leg.

**Architecture:** Keep the current one-way trajectory flow untouched for the common single-destination case, and route every return-enabled mission through the existing tour-planning pipeline. Thread a new `returnToDeparture` flag through frontend form state, launch-window requests, tour request schemas, and the tour planner so the final `... -> Earth` leg affects ranking, samples, and UI summaries.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, FastAPI, Pydantic, pytest, existing mission-planning services

---

## Planned File Structure

### Frontend

- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

### Backend

- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Modify: `apps/api/app/services/launch_window_search.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Modify: `apps/api/tests/api/test_missions_launch_window.py`
- Modify: `apps/api/tests/unit/test_launch_window_search.py`
- Modify: `apps/api/tests/unit/test_tour_planner.py`

## Chunk 1: Frontend Toggle And Request Routing

### Task 1: Add failing form tests for the return-to-Earth toggle

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Add focused tests that assert:

```tsx
it("renders the return-to-earth toggle disabled by default", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByLabelText("返回地球")).not.toBeChecked();
});

it("submits a tour request when one body is selected and return-to-earth is enabled", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="en" loading={false} />);

  await userEvent.click(screen.getByLabelText("Return to Earth"));
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "tour",
      request: expect.objectContaining({
        departureBody: "earth",
        requiredVisitBodies: ["mars"],
        returnToDeparture: true,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL because the form has no return-to-Earth toggle and single-body submissions always map to `trajectory`.

- [ ] **Step 3: Implement the minimal form and type changes**

Update:

- `apps/web/src/features/mission/components/MissionForm.tsx`
- `apps/web/src/features/mission/types.ts`
- `apps/web/src/lib/i18n.ts`

Add:

- `returnToDeparture` state defaulting to `false`
- toggle UI near the visit selector
- `returnToDeparture?: boolean` on `MissionTourRequest` and `LaunchWindowRequest`
- submit branching so `selectedBodies.length === 1 && !returnToDeparture` stays `trajectory`, otherwise uses `tour`

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/apps/web/src/features/mission/components/MissionForm.tsx game/apps/web/src/features/mission/components/MissionForm.test.tsx game/apps/web/src/features/mission/types.ts game/apps/web/src/lib/i18n.ts
git commit -m "feat: add return-to-earth mission toggle"
```

### Task 2: Add failing app-level tests for launch-window and request payload routing

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/mission/types.ts`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Add app-level tests that verify:

```tsx
it("includes returnToDeparture in launch-window and tour requests", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(createJsonResponse(tourResult));

  render(<App />);
  await userEvent.click(screen.getByLabelText("返回地球"));
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(fetchSpy).toHaveBeenNthCalledWith(
    2,
    "/missions/launch-window",
    expect.objectContaining({
      body: expect.stringContaining('"returnToDeparture":true'),
    }),
  );
  expect(fetchSpy).toHaveBeenNthCalledWith(
    3,
    "/missions/plan-tour",
    expect.objectContaining({
      body: expect.stringContaining('"returnToDeparture":true'),
    }),
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: FAIL because `buildLaunchWindowRequest` and tour submission do not include the new flag.

- [ ] **Step 3: Implement the minimal app-level routing changes**

Update `apps/web/src/App.tsx` so that:

- `buildLaunchWindowRequest` forwards `returnToDeparture` for tour submissions
- return-enabled single-destination submissions go through `planMissionTour`
- existing one-way single-destination requests stay on `propagateMission`

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/apps/web/src/App.tsx game/apps/web/src/App.test.tsx game/apps/web/src/features/mission/types.ts
git commit -m "feat: wire return-to-earth requests through app submission flow"
```

## Chunk 2: Backend Request Plumbing And Window Search

### Task 3: Add failing backend tests for schema and launch-window support

**Files:**
- Modify: `apps/api/tests/unit/test_launch_window_search.py`
- Modify: `apps/api/tests/api/test_missions_launch_window.py`
- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Modify: `apps/api/app/services/launch_window_search.py`
- Test: `apps/api/tests/unit/test_launch_window_search.py`
- Test: `apps/api/tests/api/test_missions_launch_window.py`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```python
def test_launch_window_search_forwards_return_to_departure_flag(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)
    recorded: list[bool] = []

    class StubTourPlanner:
        def estimate_tour_candidates(self, *, return_to_departure, **kwargs):
            recorded.append(return_to_departure)
            return [Estimate(...)]

    service.tour_planner = StubTourPlanner()
    service.search_tour_window(
        departure_body="earth",
        required_visit_bodies=("mars",),
        earliest_launch_epoch="2026-01-01T00:00:00Z",
        return_to_departure=True,
    )

    assert recorded == [True]
```

Also add an API test posting `{"returnToDeparture": true}` to `/missions/launch-window` and asserting a `200` response.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_launch_window_search.py tests/api/test_missions_launch_window.py -q`
Expected: FAIL because the request schema and service methods do not accept `returnToDeparture`.

- [ ] **Step 3: Implement the minimal request-plumbing changes**

Update:

- `apps/api/app/schemas/mission.py`
- `apps/api/app/api/routes_missions.py`
- `apps/api/app/services/launch_window_search.py`

Add `returnToDeparture: bool = False` to the tour-oriented request models and thread it through `search_tour_window()` and `estimate_tour_candidates()`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_launch_window_search.py tests/api/test_missions_launch_window.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/apps/api/app/schemas/mission.py game/apps/api/app/api/routes_missions.py game/apps/api/app/services/launch_window_search.py game/apps/api/tests/unit/test_launch_window_search.py game/apps/api/tests/api/test_missions_launch_window.py
git commit -m "feat: add return-to-earth launch-window support"
```

## Chunk 3: Tour Planner Return Leg

### Task 4: Add failing tour-planner tests for the final Earth return leg

**Files:**
- Modify: `apps/api/tests/unit/test_tour_planner.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Modify: `apps/api/app/services/tour_planner.py`
- Test: `apps/api/tests/unit/test_tour_planner.py`
- Test: `apps/api/tests/api/test_missions_plan_tour.py`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```python
def test_tour_planner_appends_earth_return_leg_when_enabled() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("mars",),
        launch_epoch="2026-01-01T00:00:00Z",
        return_to_departure=True,
    )

    assert candidates
    assert candidates[0].visit_order == ("mars",)
    assert candidates[0].full_sequence_bodies[-1] == "earth"
    assert candidates[0].legs[-1].end_body == "earth"
    assert candidates[0].closest_approach["bodyId"] == "earth"
```

Add an API test that posts `returnToDeparture: true` to `/missions/plan-tour` and asserts the returned candidate ends at Earth.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/api && uv run pytest tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py -q`
Expected: FAIL because the planner has no `return_to_departure` input and does not assemble a final Earth leg.

- [ ] **Step 3: Implement the minimal tour-planner changes**

Update `apps/api/app/services/tour_planner.py` to:

- accept `return_to_departure: bool = False` on both planning and estimate paths
- build a planning target list that appends `departure_body` only when return is enabled
- preserve `visit_order` as selected-body-only
- permit the explicit final Earth return even when repeated flybys are otherwise disallowed
- emit the final Earth arrival through `visit_events`, `closest_approach`, `mission_timeline`, `full_sequence_bodies`, and `legs`

Thread the flag through `routes_missions.py` and `launch_window_search.py` if the test requires the route layer to be updated at the same time.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/api && uv run pytest tests/unit/test_tour_planner.py tests/api/test_missions_plan_tour.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/apps/api/app/services/tour_planner.py game/apps/api/app/api/routes_missions.py game/apps/api/tests/unit/test_tour_planner.py game/apps/api/tests/api/test_missions_plan_tour.py
git commit -m "feat: plan optional return-to-earth tour legs"
```

## Chunk 4: Result Presentation And End-To-End Verification

### Task 5: Add failing UI tests for closed-loop route presentation

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/features/mission/components/MissionSummary.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```tsx
it("shows the full closed-loop route when the mission returns to Earth", () => {
  render(
    <MissionSummary
      result={{
        ...result,
        closestApproach: { bodyId: "earth", distanceKm: 1200, epochSeconds: 900000 },
        visitOrder: ["mars"],
        fullSequenceBodies: ["earth", "mars", "earth"],
      }}
      language="en"
    />,
  );

  expect(screen.getByText(/Earth -> Mars -> Earth/i)).toBeInTheDocument();
});
```

Add an app-level test that a return-enabled tour response displays a route ending at Earth in the candidate or summary area.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionSummary.test.tsx src/App.test.tsx`
Expected: FAIL because the summary currently prefers `visitOrder` and hides the return leg.

- [ ] **Step 3: Implement the minimal display changes**

Update:

- `apps/web/src/features/mission/components/MissionSummary.tsx`
- `apps/web/src/App.tsx`

So that:

- return-enabled missions show the closed loop in the primary route text
- candidate cards continue to show `visitOrder` separately but also surface the full sequence when it differs
- one-way missions preserve current display behavior

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionSummary.test.tsx src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/apps/web/src/features/mission/components/MissionSummary.tsx game/apps/web/src/features/mission/components/MissionSummary.test.tsx game/apps/web/src/App.tsx game/apps/web/src/App.test.tsx
git commit -m "feat: display closed-loop return-to-earth missions"
```

### Task 6: Run full verification before completion

**Files:**
- Modify: any files touched above if verification reveals regressions

- [ ] **Step 1: Run the backend test suite for touched areas**

Run: `cd apps/api && uv run pytest tests/unit/test_tour_planner.py tests/unit/test_launch_window_search.py tests/api/test_missions_plan_tour.py tests/api/test_missions_launch_window.py -q`
Expected: PASS.

- [ ] **Step 2: Run the frontend test suite for touched areas**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx src/features/mission/components/MissionSummary.test.tsx src/App.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the broader web test suite if touched code paths warrant it**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 4: Run the broader API test suite if touched planner behavior warrants it**

Run: `cd apps/api && uv run pytest tests/unit/test_tour_planner.py tests/unit/test_launch_window_search.py tests/api/test_missions_plan_tour.py tests/api/test_missions_launch_window.py tests/unit/test_mission_timeline.py -q`
Expected: PASS.

- [ ] **Step 5: Commit the final verification or cleanup changes if needed**

```bash
git add game/apps/api/app game/apps/api/tests game/apps/web/src game/apps/web/package.json
git commit -m "test: verify return-to-earth mission flow"
```
