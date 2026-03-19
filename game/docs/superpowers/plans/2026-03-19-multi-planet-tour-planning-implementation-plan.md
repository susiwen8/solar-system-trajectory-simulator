# Multi-Planet Tour Planning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-planet tour planner that accepts a required visit set, automatically chooses visit order, inserts optional assist flybys, and returns ranked mission-tour candidates that the existing UI can display.

**Architecture:** Extend the current gravity-assist stack with a dedicated tour-planning service that enumerates visit-order permutations, expands each required leg with optional assist bodies, assembles full-mission candidates, and exposes them through a new API endpoint. Keep single-target propagation intact, and add a focused frontend flow for required-visit input and candidate switching without replacing the current trajectory scene.

**Tech Stack:** FastAPI, Pydantic, NumPy/SciPy, existing Lambert/flyby solver stack, React, TypeScript, Vite, Vitest

---

## Chunk 1: Backend Tour Domain

### Task 1: Add tour request and response schema tests

**Files:**
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Create: `apps/api/tests/api/test_missions_plan_tour.py`
- Test: `apps/api/tests/api/test_missions_plan_tour.py`

- [ ] **Step 1: Write the failing API test for tour planning**

```python
def test_plan_tour_returns_ranked_candidates() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter", "saturn"],
            "launchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["candidates"]
    assert data["candidates"][0]["visitOrder"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_plan_tour.py`
Expected: FAIL with missing route or schema mismatch.

- [ ] **Step 3: Add minimal request/response models**

Modify `apps/api/app/schemas/mission.py` to add:

- `MissionTourRequest`
- `MissionTourCandidate`
- `MissionTourLeg`
- `VisitEvent`

- [ ] **Step 4: Run the schema/API test again**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_plan_tour.py`
Expected: still FAIL, but now on missing implementation rather than schema parsing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/mission.py apps/api/tests/api/test_missions_plan_tour.py
git commit -m "test: add multi-planet tour api coverage"
```

### Task 2: Add visit-order and full-tour backend unit tests

**Files:**
- Create: `apps/api/tests/unit/test_tour_planner.py`
- Test: `apps/api/tests/unit/test_tour_planner.py`

- [ ] **Step 1: Write the failing planner tests**

```python
def test_tour_planner_covers_all_required_visits() -> None:
    planner = build_planner()
    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        launch_epoch="2026-01-01T00:00:00Z",
    )
    assert candidates
    assert set(candidates[0].visit_order) == {"venus", "jupiter", "saturn"}


def test_tour_planner_can_choose_non_input_visit_order() -> None:
    planner = build_planner()
    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("saturn", "venus", "jupiter"),
        launch_epoch="2026-01-01T00:00:00Z",
    )
    assert tuple(candidates[0].visit_order) != ("saturn", "venus", "jupiter")
```

- [ ] **Step 2: Run the planner tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py`
Expected: FAIL with planner module not found.

- [ ] **Step 3: Create the planner file skeleton**

Create `apps/api/app/services/tour_planner.py` with:

- `VisitEvent`
- `TourLeg`
- `MissionTourCandidate`
- `MissionTourPlanner`

- [ ] **Step 4: Re-run the tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py`
Expected: FAIL on missing behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/tour_planner.py apps/api/tests/unit/test_tour_planner.py
git commit -m "test: add multi-planet tour planner coverage"
```

## Chunk 2: Backend Tour Search

### Task 3: Implement visit-order enumeration and leg expansion

**Files:**
- Modify: `apps/api/app/services/tour_planner.py`
- Reuse: `apps/api/app/services/gravity_assist_search.py`
- Test: `apps/api/tests/unit/test_tour_planner.py`

- [ ] **Step 1: Implement failing behavior minimally**

Add methods to `MissionTourPlanner`:

- `_generate_visit_orders(...)`
- `_expand_leg_candidates(...)`
- `_assemble_candidates(...)`

Use the existing `GravityAssistSearchService` for each required leg first, keeping direct and assist-expanded paths.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py`
Expected: PASS for required-visit coverage and backend-selected ordering.

- [ ] **Step 3: Add a new failing test for repeated assist limits**

```python
def test_tour_planner_respects_assist_limit_per_leg() -> None:
    ...
```

- [ ] **Step 4: Implement assist-limit enforcement**

Limit each required leg to direct, one-assist, and two-assist subpaths.

- [ ] **Step 5: Run focused tests again**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_tour_planner.py`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/services/tour_planner.py apps/api/tests/unit/test_tour_planner.py
git commit -m "feat: add tour visit-order and leg expansion search"
```

### Task 4: Implement tour scoring and API route

**Files:**
- Modify: `apps/api/app/services/tour_planner.py`
- Modify: `apps/api/app/api/routes_missions.py`
- Test: `apps/api/tests/api/test_missions_plan_tour.py`

- [ ] **Step 1: Add a failing test for score ordering**

```python
def test_plan_tour_returns_sorted_candidates() -> None:
    ...
    assert data["candidates"][0]["score"] <= data["candidates"][1]["score"]
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_plan_tour.py`
Expected: FAIL on missing implementation.

- [ ] **Step 3: Implement route and scoring**

Add `POST /missions/plan-tour` in `apps/api/app/api/routes_missions.py`.

Implement in `MissionTourPlanner`:

- full-mission assembly
- total delta-v aggregation
- total duration aggregation
- repeated-body penalty
- sorted top-N candidate output

- [ ] **Step 4: Run the API tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_plan_tour.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/api/routes_missions.py apps/api/app/services/tour_planner.py apps/api/tests/api/test_missions_plan_tour.py
git commit -m "feat: add multi-planet tour planning endpoint"
```

## Chunk 3: Frontend Tour UI

### Task 5: Add frontend tour types and API client coverage

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/features/mission/components/MissionTourForm.test.tsx` or extend existing tests
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing frontend test**

```tsx
it("submits a multi-planet tour request and renders candidate tours", async () => {
  ...
})
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `cd apps/web && npm test -- --run`
Expected: FAIL with missing tour request/result support.

- [ ] **Step 3: Add minimal types and API client**

Extend `types.ts` with:

- `MissionTourRequest`
- `MissionTourCandidate`
- `MissionTourLeg`
- `VisitEvent`

Add `planMissionTour()` in `apps/web/src/lib/api.ts`.

- [ ] **Step 4: Re-run frontend tests**

Run: `cd apps/web && npm test -- --run`
Expected: still FAIL on missing UI wiring.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/lib/api.ts apps/web/src/App.test.tsx
git commit -m "test: add frontend multi-planet tour flow coverage"
```

### Task 6: Add mission-tour input and candidate display

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Implement the new form controls**

Add:

- required visit planet multi-select or removable chip list
- allow assists toggle
- allow repeated flybys toggle
- max assists per leg control
- submit path for `/missions/plan-tour`

- [ ] **Step 2: Render tour candidates in the sidebar**

Show:

- visit order
- full sequence
- score
- total delta-v
- total flight time

- [ ] **Step 3: Update active scene result mapping**

Allow tour candidates to drive:

- trajectory samples
- flyby events
- visit events

- [ ] **Step 4: Run frontend tests**

Run: `cd apps/web && npm test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/lib/i18n.ts apps/web/src/styles.css
git commit -m "feat: add multi-planet tour planning ui"
```

## Chunk 4: Verification

### Task 7: Run full regression and browser verification

**Files:**
- Verify only

- [ ] **Step 1: Run backend tests**

Run: `make api-test`
Expected: all backend tests pass.

- [ ] **Step 2: Run frontend tests**

Run: `cd apps/web && npm test -- --run`
Expected: all frontend tests pass.

- [ ] **Step 3: Verify in browser**

Manual check in running app:

- configure required visits like `Venus, Jupiter, Saturn`
- submit a tour request
- confirm the backend-selected visit order is shown
- confirm candidates are ranked and switchable
- confirm the scene displays the selected candidate trajectory

- [ ] **Step 4: Commit any final polish**

```bash
git add apps/api apps/web
git commit -m "test: verify multi-planet tour planning flow"
```
