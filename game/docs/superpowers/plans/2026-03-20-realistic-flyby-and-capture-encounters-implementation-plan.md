# Realistic Flyby And Capture Encounters Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the simulator so flybys and target capture are emitted as physically interpretable encounter segments with explicit local geometry, events, and samples that the frontend can render directly.

**Architecture:** Keep the existing heliocentric mission pipeline and segment-first mission assembly, but insert a shared encounter-geometry layer plus dedicated encounter planners for flyby and capture. Backend mission results should emit authoritative encounter segments in planet-centered frames, and the frontend should prefer those segments for scene, HUD, and timeline behavior while preserving fallback compatibility.

**Tech Stack:** FastAPI, Pydantic, NumPy, pytest, React, TypeScript, Three.js, Vitest, React Testing Library

---

## Planned File Structure

### Backend

- Create: `apps/api/app/services/encounter_geometry.py`
- Create: `apps/api/tests/unit/test_encounter_geometry.py`
- Modify: `apps/api/app/services/flyby_planner.py`
- Modify: `apps/api/tests/unit/test_flyby_planner.py`
- Modify: `apps/api/app/services/arrival_capture_planner.py`
- Modify: `apps/api/tests/unit/test_arrival_capture_planner.py`
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`

### Frontend

- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/features/scene/lib/mission-timeline.ts`
- Modify: `apps/web/src/App.test.tsx`

## Chunk 1: Shared Encounter Geometry

### Task 1: Add failing unit tests for encounter geometry derivation

**Files:**
- Create: `apps/api/tests/unit/test_encounter_geometry.py`
- Create: `apps/api/app/services/encounter_geometry.py`
- Test: `apps/api/tests/unit/test_encounter_geometry.py`

- [ ] **Step 1: Write failing tests for flyby and capture encounter geometry**

```python
def test_build_encounter_geometry_returns_body_relative_v_infinity() -> None:
    geometry = build_encounter_geometry(
        body_id="jupiter",
        encounter_epoch="2027-03-01T12:00:00.000Z",
        body_position_km=(778_500_000.0, 0.0, 0.0),
        body_velocity_km_per_s=(0.0, 13.1, 0.0),
        probe_position_km=(778_650_000.0, 12_000.0, 0.0),
        probe_velocity_km_per_s=(0.0, 19.2, 0.0),
        periapsis_altitude_km=75_000.0,
    )

    assert geometry.body_id == "jupiter"
    assert geometry.incoming_v_infinity_km_per_s > 0
    assert geometry.periapsis_altitude_km == 75_000.0
    assert geometry.sphere_of_influence_radius_km > geometry.periapsis_radius_km
```

```python
def test_build_capture_geometry_marks_capture_encounter_type() -> None:
    geometry = build_encounter_geometry(
        body_id="mars",
        encounter_epoch="2026-01-04T00:00:00Z",
        body_position_km=(-159_300_000.0, 188_100_000.0, 7_650_000.0),
        body_velocity_km_per_s=(-17.2, -13.2, 0.15),
        probe_position_km=(-159_295_000.0, 188_098_000.0, 7_649_000.0),
        probe_velocity_km_per_s=(-18.4, -11.7, -0.35),
        periapsis_altitude_km=350.0,
        encounter_type="capture",
    )

    assert geometry.encounter_type == "capture"
    assert geometry.reference_frame == "mars-centered-inertial"
```

- [ ] **Step 2: Run the focused geometry tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_encounter_geometry.py`
Expected: FAIL because `encounter_geometry.py` does not exist yet.

- [ ] **Step 3: Implement the minimal encounter geometry helper**

Create `apps/api/app/services/encounter_geometry.py` with:

- `EncounterGeometry` dataclass
- `build_encounter_geometry(...)`
- lightweight helpers for body-relative state, `vInfinity`, periapsis radius, and SOI radius lookup

The first implementation should:

- derive body-relative velocity by subtracting body velocity from probe velocity
- compute `incoming_v_infinity_km_per_s` from that relative vector
- derive periapsis radius from body radius plus periapsis altitude
- keep all outputs deterministic and planner-friendly

- [ ] **Step 4: Re-run the focused geometry tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_encounter_geometry.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/encounter_geometry.py apps/api/tests/unit/test_encounter_geometry.py
git commit -m "feat: add shared encounter geometry builder"
```

## Chunk 2: Flyby Encounter Segments

### Task 2: Upgrade flyby planner tests to require explicit encounter segments

**Files:**
- Modify: `apps/api/tests/unit/test_flyby_planner.py`
- Modify: `apps/api/app/services/flyby_planner.py`
- Test: `apps/api/tests/unit/test_flyby_planner.py`

- [ ] **Step 1: Replace the current coarse flyby expectations with encounter-segment assertions**

Add failing expectations such as:

```python
assert segment.segment_type == "flybyEncounter"
assert segment.samples
assert segment.initial_state["referenceFrame"] == "jupiter-centered-inertial"
assert segment.metadata["incomingVInfinityKmPerS"] > 0
assert segment.metadata["outgoingVInfinityKmPerS"] > 0
assert segment.events[0]["type"] == "sphereOfInfluenceEntry"
assert segment.events[-1]["type"] == "sphereOfInfluenceExit"
```

- [ ] **Step 2: Run the focused flyby planner tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_flyby_planner.py`
Expected: FAIL because the planner still emits `gravityAssistFlyby` without local encounter samples.

- [ ] **Step 3: Implement the minimal flyby encounter planner upgrade**

Update `apps/api/app/services/flyby_planner.py` so that it:

- consumes `EncounterGeometry`
- emits `flybyEncounter` as the segment type
- produces a small set of local planet-centered samples across SOI entry, periapsis, and SOI exit
- renames flyby events to encounter events
- preserves `turnAngleDeg`, `bPlaneLike`, and `vInfinity` metadata

- [ ] **Step 4: Re-run the focused flyby planner tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_flyby_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/flyby_planner.py apps/api/tests/unit/test_flyby_planner.py apps/api/app/services/encounter_geometry.py
git commit -m "feat: emit explicit flyby encounter segments"
```

### Task 3: Thread flyby encounter segments into mission assembly and timeline

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`
- Test: `apps/api/tests/unit/test_mission_timeline.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Add failing integration assertions for flyby encounter segment wiring**

Add expectations such as:

```python
flyby_segment = next(segment for segment in result["segments"] if segment["segmentType"] == "flybyEncounter")
assert flyby_segment["samples"]
assert flyby_segment["referenceFrame"] == "jupiter-centered-inertial"
assert any(event["type"] == "sphereOfInfluenceEntry" for event in result["missionTimeline"]["events"])
```

- [ ] **Step 2: Run the focused flyby integration tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: FAIL because mission assembly still expects `gravityAssistFlyby`.

- [ ] **Step 3: Integrate the new flyby encounter segments**

Update mission assembly so that:

- flyby candidates are converted into `flybyEncounter` segments
- timeline generation recognizes SOI entry / periapsis / SOI exit event types
- compatibility `flybyEvents` continue to be produced from the encounter segment metadata

- [ ] **Step 4: Re-run the focused flyby integration tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_service.py apps/api/app/services/mission_timeline.py apps/api/tests/unit/test_mission_service.py apps/api/tests/unit/test_mission_timeline.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: integrate flyby encounter segments"
```

## Chunk 3: Arrival Capture Encounter Chain

### Task 4: Upgrade arrival capture planner tests to require approach, burn, and parking outputs

**Files:**
- Modify: `apps/api/tests/unit/test_arrival_capture_planner.py`
- Modify: `apps/api/app/services/arrival_capture_planner.py`
- Test: `apps/api/tests/unit/test_arrival_capture_planner.py`

- [ ] **Step 1: Add failing planner tests for multi-segment arrival capture output**

Add expectations such as:

```python
plan = planner.plan_capture(...)

assert [segment.segment_type for segment in plan.segments] == [
    "arrivalHyperbolicApproach",
    "orbitInsertionBurn",
    "parkingOrbit",
]
assert any(event["type"] == "hyperbolicPeriapsis" for event in plan.segments[0].events)
assert any(event["type"] == "orbitInsertionBurnStart" for event in plan.segments[1].events)
assert plan.segments[2].orbit_summary["isBound"] is True
```

- [ ] **Step 2: Run the focused arrival planner tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_arrival_capture_planner.py`
Expected: FAIL because the planner currently returns a single `arrivalCapture` segment.

- [ ] **Step 3: Implement the minimal multi-segment arrival capture planner**

Update `apps/api/app/services/arrival_capture_planner.py` so that it:

- consumes `EncounterGeometry`
- returns an `ArrivalCapturePlan` that owns `segments`
- builds `arrivalHyperbolicApproach`, `orbitInsertionBurn`, and `parkingOrbit`
- emits insertion delta-v metadata and explicit capture events
- keeps the post-burn parking orbit samples target-centered and bound

- [ ] **Step 4: Re-run the focused arrival planner tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_arrival_capture_planner.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/arrival_capture_planner.py apps/api/tests/unit/test_arrival_capture_planner.py apps/api/app/services/encounter_geometry.py
git commit -m "feat: split arrival capture into encounter segments"
```

### Task 5: Integrate arrival encounter segments into mission assembly and timeline

**Files:**
- Modify: `apps/api/app/services/mission_service.py`
- Modify: `apps/api/app/services/mission_segments.py`
- Modify: `apps/api/app/services/mission_timeline.py`
- Modify: `apps/api/tests/unit/test_mission_service.py`
- Modify: `apps/api/tests/unit/test_mission_timeline.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Test: `apps/api/tests/unit/test_mission_service.py`
- Test: `apps/api/tests/unit/test_mission_timeline.py`
- Test: `apps/api/tests/api/test_missions_propagate.py`

- [ ] **Step 1: Add failing integration assertions for arrival encounter segment sequence**

Add expectations such as:

```python
segment_types = [segment["segmentType"] for segment in result["segments"]]
assert "arrivalHyperbolicApproach" in segment_types
assert "orbitInsertionBurn" in segment_types
assert "parkingOrbit" in segment_types
assert any(event["type"] == "captureEstablished" for event in result["missionTimeline"]["events"])
```

- [ ] **Step 2: Run the focused arrival integration tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: FAIL because the arrival encounter chain is not yet assembled into results.

- [ ] **Step 3: Integrate arrival encounter segments and compatibility mirrors**

Update mission assembly and segment merging so that:

- arrival encounters splice multiple local segments into the mission chain
- `merge_segment_samples(...)` continues to behave sensibly when local frames appear
- `closestApproach`, compatibility capture fields, and timeline events are derived from the richer chain

- [ ] **Step 4: Re-run the focused arrival integration tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/mission_service.py apps/api/app/services/mission_segments.py apps/api/app/services/mission_timeline.py apps/api/tests/unit/test_mission_service.py apps/api/tests/unit/test_mission_timeline.py apps/api/tests/api/test_missions_propagate.py
git commit -m "feat: integrate arrival encounter segment chain"
```

## Chunk 4: Frontend Encounter Consumption

### Task 6: Extend scene and type tests to prefer explicit encounter segments

**Files:**
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.ts`
- Modify: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/features/scene/lib/arrival-capture.test.ts`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add failing frontend tests for new encounter segment names**

Add expectations such as:

```ts
expect(findArrivalCaptureSegment(result.segments ?? [], "mars")?.segmentType).toBe("parkingOrbit");
expect(screen.getByTestId("arrival-capture-orbit")).toHaveAttribute("data-source", "segment-samples");
```

For richer result fixtures, include:

```ts
expect(result.segments?.some((segment) => segment.segmentType === "arrivalHyperbolicApproach")).toBe(true);
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts src/App.test.tsx`
Expected: FAIL because the frontend types and helpers do not yet recognize the new encounter chain fully.

- [ ] **Step 3: Update frontend types and arrival-capture helpers**

Modify the frontend so that:

- `MissionSegmentMetadata` can describe new encounter fields such as `encounterType`, `sphereOfInfluenceRadiusKm`, and `insertionDeltaVKmPerS`
- `arrival-capture.ts` prefers `parkingOrbit` samples from the new chain and ignores flyby encounter segments
- fixtures and parsing logic recognize `flybyEncounter`, `arrivalHyperbolicApproach`, and `orbitInsertionBurn`

- [ ] **Step 4: Re-run the focused frontend tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/types.ts apps/web/src/features/scene/lib/arrival-capture.ts apps/web/src/features/scene/lib/arrival-capture.test.ts apps/web/src/App.test.tsx
git commit -m "feat: consume realistic arrival encounter segments"
```

### Task 7: Make timeline and scene UI speak encounter-phase language

**Files:**
- Modify: `apps/web/src/features/scene/components/SolarSystemScene.tsx`
- Modify: `apps/web/src/features/scene/lib/mission-timeline.ts`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add failing UI assertions for encounter-phase playback**

Add expectations such as:

```ts
expect(screen.getByText(/capture/i)).toBeInTheDocument();
expect(screen.getByText(/插入点火|orbit insertion/i)).toBeInTheDocument();
```

For flyby fixtures:

```ts
expect(screen.getByText(/SOI|sphere of influence/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused app tests to verify they fail**

Run: `cd apps/web && npm test -- src/App.test.tsx`
Expected: FAIL because the current scene and timeline still describe encounters in coarse terms.

- [ ] **Step 3: Update scene and timeline consumption**

Modify the frontend so that:

- mission timeline snapshot logic and UI can surface the explicit encounter events
- `SolarSystemScene` identifies encounter segments and exposes current phase labels such as SOI entry, periapsis, insertion burn, and capture
- the scene remains fallback-compatible when older results omit the new encounter chain

- [ ] **Step 4: Re-run the focused app tests**

Run: `cd apps/web && npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scene/components/SolarSystemScene.tsx apps/web/src/features/scene/lib/mission-timeline.ts apps/web/src/App.test.tsx
git commit -m "feat: surface encounter phases in scene playback"
```

## Chunk 5: Verification

### Task 8: Run focused and broad verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused backend encounter tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_encounter_geometry.py tests/unit/test_flyby_planner.py tests/unit/test_arrival_capture_planner.py tests/unit/test_mission_service.py tests/unit/test_mission_timeline.py tests/api/test_missions_propagate.py`
Expected: PASS.

- [ ] **Step 2: Run the focused frontend encounter tests**

Run: `cd apps/web && npm test -- src/features/scene/lib/arrival-capture.test.ts src/App.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the broader regression suites**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_missions_plan_tour.py`
Expected: PASS.

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 4: Sanity-check the diff**

Run: `git diff --stat`
Expected: only the planned encounter-model, timeline, type, and scene changes.

- [ ] **Step 5: Commit final verification polish if needed**

```bash
git add apps/api apps/web
git commit -m "test: verify realistic encounter modeling"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-20-realistic-flyby-and-capture-encounters-implementation-plan.md`. Because you asked me to execute, the next step is to start Chunk 1 with failing encounter-geometry tests.
