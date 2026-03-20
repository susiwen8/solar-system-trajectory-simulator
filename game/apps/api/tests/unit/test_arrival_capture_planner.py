from app.services.arrival_capture_planner import ArrivalCapturePlanner


def test_arrival_capture_planner_builds_bound_capture_segment() -> None:
    planner = ArrivalCapturePlanner()

    plan = planner.plan_capture(
        body_id="mars",
        arrival_epoch="2026-01-04T00:00:00Z",
        heliocentric_sample={
            "positionKm": [227_900_000.0, 0.0, 0.0],
            "velocityKmPerSec": [0.0, 3.4, 0.0],
        },
        orbit_summary={
            "isBound": True,
            "periapsisKm": 4_200.0,
            "apoapsisKm": 7_200.0,
            "inclinationDeg": 25.0,
        },
    )

    assert [segment.segment_type for segment in plan.segments] == [
        "arrivalHyperbolicApproach",
        "orbitInsertionBurn",
        "parkingOrbit",
    ]
    assert plan.segments[0].initial_state["referenceBodyId"] == "mars"
    assert any(event["type"] == "hyperbolicPeriapsis" for event in plan.segments[0].events)
    assert any(event["type"] == "orbitInsertionBurnStart" for event in plan.segments[1].events)
    assert any(event["type"] == "captureEstablished" for event in plan.segments[2].events)
    assert plan.segments[2].orbit_summary["isBound"] is True
    assert len(plan.segments[2].samples) >= 12
