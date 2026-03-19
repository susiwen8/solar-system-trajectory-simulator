from app.services.mission_timeline import build_mission_timeline


def _sample(epoch_seconds: float) -> dict:
    return {
        "epochSeconds": epoch_seconds,
        "positionKm": [149_597_870.7 + epoch_seconds, 0.0, 0.0],
        "velocityKmPerSec": [0.0, 29.78, 0.0],
    }


def test_build_timeline_includes_launch_escape_and_arrival() -> None:
    timeline = build_mission_timeline(
        launch_epoch="2026-01-01T00:00:00Z",
        flight_time_seconds=20.0 * 24.0 * 3600.0,
        target_body="mars",
        samples=[_sample(0.0), _sample(10.0 * 24.0 * 3600.0), _sample(20.0 * 24.0 * 3600.0)],
        closest_approach={
            "bodyId": "mars",
            "epoch": "2026-01-21T00:00:00Z",
            "distanceKm": 1250.0,
            "epochSeconds": 20.0 * 24.0 * 3600.0,
        },
    )

    phase_types = [phase["type"] for phase in timeline["phases"]]

    assert "launch" in phase_types
    assert "earthEscape" in phase_types
    assert "targetApproach" in phase_types
    assert "arrivalPass" in phase_types
    assert timeline["events"]


def test_build_timeline_includes_maneuver_and_flyby_phases() -> None:
    timeline = build_mission_timeline(
        launch_epoch="2026-01-01T00:00:00Z",
        flight_time_seconds=40.0 * 24.0 * 3600.0,
        target_body="saturn",
        samples=[_sample(0.0), _sample(20.0 * 24.0 * 3600.0), _sample(40.0 * 24.0 * 3600.0)],
        closest_approach={
            "bodyId": "saturn",
            "epoch": "2026-02-10T00:00:00Z",
            "distanceKm": 12.0,
            "epochSeconds": 40.0 * 24.0 * 3600.0,
        },
        maneuver_events=[
            {
                "type": "DSM",
                "startEpoch": "2026-01-08T00:00:00Z",
                "durationSeconds": 7200.0,
            }
        ],
        flyby_events=[
            {
                "bodyId": "jupiter",
                "epoch": "2026-01-20T12:00:00Z",
            }
        ],
    )

    phase_types = [phase["type"] for phase in timeline["phases"]]

    assert "maneuverExecution" in phase_types
    assert "gravityAssistFlyby" in phase_types
    assert any(event["type"] == "flyby" for event in timeline["events"])


def test_build_timeline_preserves_segment_boundary_events() -> None:
    timeline = build_mission_timeline(
        launch_epoch="2026-01-01T00:00:00Z",
        flight_time_seconds=12.0 * 3600.0,
        target_body="mars",
        samples=[_sample(0.0), _sample(6.0 * 3600.0), _sample(12.0 * 3600.0)],
        closest_approach={
            "bodyId": "mars",
            "epoch": "2026-01-01T12:00:00Z",
            "distanceKm": 10_000.0,
            "epochSeconds": 12.0 * 3600.0,
        },
        segment_events=[
            {
                "type": "launchParkingOrbitEnd",
                "epoch": "2026-01-01T01:30:00Z",
                "title": "Parking Orbit Complete",
                "description": "Complete the initial parking orbit coast.",
                "relatedBody": "earth",
            },
            {
                "type": "earthSoiExit",
                "epoch": "2026-01-01T07:30:00Z",
                "title": "Earth SOI Exit",
                "description": "Transition from Earth departure into heliocentric cruise.",
                "relatedBody": "earth",
            },
        ],
    )

    assert any(event["type"] == "earthSoiExit" for event in timeline["events"])
