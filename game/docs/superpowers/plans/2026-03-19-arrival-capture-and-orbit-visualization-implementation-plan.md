# Arrival Capture And Orbit Visualization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make target arrival look like orbital capture instead of collision by first adding a synthesized captured-orbit visualization, then upgrading mission results to emit real post-capture samples and events.

**Architecture:** Keep the existing heliocentric transfer pipeline intact for cruise, but add a focused scene helper that can detect bound arrival and synthesize a local orbit around the target body. Then add an `ArrivalCapturePlanner` in the API layer so the backend can emit explicit `arrivalCapture` / `parkingOrbit` segment samples and events, and update the scene to prefer those real samples over the synthetic fallback.

**Tech Stack:** FastAPI, Pydantic, NumPy, pytest, React, TypeScript, Three.js, Vitest, React Testing Library

---

## Planned File Structure

### Backend

- Create: `apps/api/app/services/arrival_capture_planner.py`
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/app/schemas/mission.py`
- Create: `apps/api/tests/unit/test_arrival_capture_planner.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`

### Frontend

- Create: `apps/web/src/features/scene/lib/arrival-capture.ts`
- Create: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/App.test.tsx`

## Chunk 1: Synthetic Arrival Orbit In The Scene

### Task 1: Add failing frontend tests for bound-arrival detection and orbit geometry

**Files:**
- Create: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Create: `apps/web/src/features/scene/lib/arrival-capture.ts`
- Test: `apps/web/src/features/scene/lib/arrival-capture.test.ts`

- [ ] **Step 1: Write failing helper tests for synthetic capture orbit generation**

```ts
it("builds a captured orbit model from a bound parking-orbit segment", () => {
  const model = buildArrivalCaptureModel({
    result: {
      closestApproach: { bodyId: "mars", distanceKm: 1200, epochSeconds: 86400 },
      segments: [
        {
          segmentType: "parkingOrbit",
          orbitSummary: { isBound: true, periapsisKm: 4200, apoapsisKm: 7200, inclinationDeg: 25 },
          metadata: { bodyId: "mars" },
        },
      ],
    } as TrajectoryResult,
  });

  expect(model).not.toBeNull();
  expect(model?.bodyId).toBe("mars");
  expect(model?.pathPoints.length).toBeGreaterThan(30);
});

it("returns null for flyby-only arrivals", () => {
  const model = buildArrivalCaptureModel({
    result: {
      closestApproach: { bodyId: "jupiter", distanceKm: 1500, epochSeconds: 86400 },
      segments: [
        {
          segmentType: "gravityAssistFlyby",
          orbitSummary: null,
          metadata: { bodyId: "jupiter" },
        },
      ],
    } as TrajectoryResult,
  });

  expect(model).toBeNull();
});
```

- [ ] **Step 2: Run the focused helper test to verify it fails**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts`
Expected: FAIL because the arrival-capture helper does not exist yet.

- [ ] **Step 3: Implement the minimal arrival-capture scene helper**

Create `apps/web/src/features/scene/lib/arrival-capture.ts` with:

- `buildArrivalCaptureModel(result)`
- `findArrivalCaptureSegment(segments)`
- `buildSyntheticOrbitPath({ periapsisKm, apoapsisKm, inclinationDeg, bodyId })`

The first implementation should:

- treat `parkingOrbit` or arrival-related segments with `orbitSummary.isBound === true` as capture candidates
- derive a local ellipse from `periapsisKm` and `apoapsisKm`
- fall back to a conservative circularized orbit when only a bound closest-approach hint is available
- return `null` for flyby-only or miss-distance cases

- [ ] **Step 4: Re-run the focused helper test**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/lib/arrival-capture.ts apps/web/src/features/scene/lib/arrival-capture.test.ts
git commit -m "feat: add synthetic arrival capture orbit helper"
```

### Task 2: Integrate synthetic capture orbit into the 3D scene

**Files:**
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add failing UI assertions for captured-orbit rendering**

Add assertions such as:

```ts
expect(await screen.findByTestId("arrival-capture-orbit")).toBeInTheDocument();
expect(screen.queryByTestId("arrival-capture-orbit")).not.toBeNull();
```

For a flyby candidate case, add:

```ts
expect(screen.queryByTestId("arrival-capture-orbit")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused app tests to verify they fail**

Run: `cd apps/web && npm test -- src/App.test.tsx`
Expected: FAIL because the scene does not render any capture-orbit overlay yet.

- [ ] **Step 3: Draw the synthetic capture orbit in `SolarSystemScene`**

Update `SolarSystemScene.tsx` so that:

- mission-scene assembly calls `buildArrivalCaptureModel(result)`
- a new Three.js line is added around the target body when capture data exists
- the transfer line presentation stops at the final heliocentric approach sample instead of visually passing through the body center in bound-arrival cases
- the synthetic orbit is tagged with a stable test id or equivalent queryable marker

Keep this phase minimal:

- no new HUD text
- no new CSS layout work
- no flyby behavior changes

- [ ] **Step 4: Re-run the focused app tests**

Run: `cd apps/web && npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/App.test.tsx
git commit -m "feat: render synthetic arrival capture orbit"
```

## Chunk 2: Real Arrival Capture Segments In Mission Results

### Task 3: Add failing backend tests for arrival-capture planner output

**Files:**
- Create: `apps/api/tests/unit/test_arrival_capture_planner.py`
- Create: `apps/api/app/services/arrival_capture_planner.py`
- Test: `apps/api/tests/unit/test_arrival_capture_planner.py`

- [ ] **Step 1: Write failing planner tests for explicit capture segments**

```python
def test_arrival_capture_planner_builds_bound_capture_segment() -> None:
    planner = ArrivalCapturePlanner()
    plan = planner.plan_capture(
        body_id="mars",
        arrival_epoch="2026-01-04T00:00:00Z",
        heliocentric_sample={"positionKm": [0, 0, 0], "velocityKmPerSec": [0, 3.4, 0]},
        orbit_summary={"isBound": True, "periapsisKm": 4200.0, "apoapsisKm": 7200.0, "inclinationDeg": 25.0},
    )

    assert plan.segment_type == "arrivalCapture"
    assert plan.orbit_summary["isBound"] is True
    assert len(plan.samples) >= 12
    assert any(event["type"] == "orbitInsertionBurn" for event in plan.events)
```

- [ ] **Step 2: Run the focused planner tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_arrival_capture_planner.py`
Expected: FAIL because `ArrivalCapturePlanner` does not exist yet.

- [ ] **Step 3: Implement the minimal `ArrivalCapturePlanner`**

Create `apps/api/app/services/arrival_capture_planner.py` with:

- `ArrivalCapturePlanner`
- `ArrivalCapturePlan` dataclass
- `plan_capture(...)`

The first implementation should:

- accept a target body id, arrival epoch, and bound orbit summary
- generate a local target-centered sample set for the first capture orbit
- emit `arrivalCapture` events including `orbitInsertionBurn` and `captureEstablished`
- preserve `orbitSummary` on the returned segment

- [ ] **Step 4: Re-run the focused planner tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_arrival_capture_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/arrival_capture_planner.py apps/api/tests/unit/test_arrival_capture_planner.py
git commit -m "feat: add arrival capture planner"
```

### Task 4: Thread explicit capture segments through mission propagation and timeline

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/app/schemas/mission.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`
- Test: `apps/api/tests/unit/test_mission_timeline.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Add failing integration assertions for arrival capture**

Add assertions such as:

```python
assert any(segment["segmentType"] == "arrivalCapture" for segment in result["segments"])
capture_segment = next(segment for segment in result["segments"] if segment["segmentType"] == "arrivalCapture")
assert capture_segment["orbitSummary"]["isBound"] is True
assert capture_segment["samples"]
assert any(event["type"] == "captureEstablished" for event in result["missionTimeline"]["events"])
```

- [ ] **Step 2: Run the focused backend integration tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: FAIL because arrival missions do not emit explicit capture segments or events yet.

- [ ] **Step 3: Integrate `ArrivalCapturePlanner` into mission assembly**

Update the backend so that:

- arrival missions with bound `orbitSummary` append an `arrivalCapture` segment after cruise
- segment serialization includes the target-centered reference frame and capture samples
- timeline generation adds `orbitInsertionBurn` / `captureEstablished` events
- schemas accept the new segment/event shape without loosening unrelated contracts

Keep the initial backend scope narrow:

- only emit real capture samples for bound-arrival missions
- do not attempt atmospheric entry, landing, or multi-orbit operational planning

- [ ] **Step 4: Re-run the focused backend integration tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/arrival_capture_planner.py apps/api/app/services/mission_service.py apps/api/app/services/mission_segments.py apps/api/app/services/mission_timeline.py apps/api/app/schemas/mission.py apps/api/tests/unit/test_arrival_capture_planner.py apps/api/tests/unit/test_mission_service.py apps/api/tests/unit/test_mission_timeline.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: emit explicit arrival capture mission segments"
```

## Chunk 3: Prefer Real Capture Samples And Verify End-to-End Behavior

### Task 5: Update the scene to prefer real capture samples over synthetic fallback

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add failing frontend assertions for real-sample preference**

Add helper and UI assertions such as:

```ts
it("prefers explicit arrival-capture samples over a synthetic orbit fallback", () => {
  const model = buildArrivalCaptureModel(resultWithArrivalCaptureSamples);
  expect(model?.source).toBe("segment-samples");
});
```

And in app tests:

```ts
expect(await screen.findByTestId("arrival-capture-orbit")).toHaveAttribute("data-source", "segment-samples");
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts src/App.test.tsx`
Expected: FAIL because the scene still only knows how to synthesize capture paths.

- [ ] **Step 3: Teach the scene helper to consume real capture samples**

Update the frontend so that:

- `MissionSegment` typing recognizes explicit `arrivalCapture` samples and target-centered reference frames
- `buildArrivalCaptureModel(...)` prefers real segment samples when present
- `SolarSystemScene` renders the real path for capture orbit display and falls back to the synthetic ellipse only when needed

- [ ] **Step 4: Re-run the focused frontend tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/features/scene/lib/arrival-capture.ts apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/App.test.tsx
git commit -m "feat: prefer real arrival capture samples in scene playback"
```

### Task 6: Run full verification and handoff checks

**Files:**
- Verify only

- [ ] **Step 1: Run focused frontend verification**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts src/App.test.tsx`
Expected: PASS with existing jsdom canvas warnings still non-blocking.

- [ ] **Step 2: Run focused backend verification**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_arrival_capture_planner.py tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 3: Sanity-check the diff**

Run: `git diff --stat`
Expected: only the planned arrival-capture scene, planner, schema, and test files changed.

- [ ] **Step 4: Commit any final polish**

```bash
git add apps/api/app/services/arrival_capture_planner.py apps/api/app/services/mission_service.py apps/api/app/services/mission_segments.py apps/api/app/services/mission_timeline.py apps/api/app/schemas/mission.py apps/api/tests/unit/test_arrival_capture_planner.py apps/api/tests/unit/test_mission_service.py apps/api/tests/unit/test_mission_timeline.py apps/api/tests/api/test_missions_propagate.py apps/web/src/features/scene/lib/arrival-capture.ts apps/web/src/features/scene/lib/arrival-capture.test.ts apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/features/mission/types.ts apps/web/src/App.test.tsx
git commit -m "feat: add arrival capture orbit playback"
```
