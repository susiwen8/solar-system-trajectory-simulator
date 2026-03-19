from app.services.arrival_capture_planner import ArrivalCapturePlanner


def test_arrival_capture_planner_builds_bound_capture_segment() -> None:
    planner = ArrivalCapturePlanner()

    segment = planner.plan_capture(
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

    assert segment.segment_type == "arrivalCapture"
    assert segment.orbit_summary["isBound"] is True
    assert len(segment.samples) >= 12
    assert segment.initial_state["referenceBodyId"] == "mars"
    assert any(event["type"] == "orbitInsertionBurn" for event in segment.events)
    assert any(event["type"] == "captureEstablished" for event in segment.events)
