from app.services.cruise_planner import CruisePlanner


def test_cruise_planner_builds_segment_with_mass_summary() -> None:
    planner = CruisePlanner()

    segment = planner.plan_segment(
        launch_epoch="2026-01-01T00:00:00Z",
        start_epoch="2026-01-01T07:30:00.000Z",
        target_body="mars",
        samples=[
            {
                "epochSeconds": 0.0,
                "positionKm": [149_597_870.7, 0.0, 0.0],
                "velocityKmPerSec": [0.0, 32.7, 0.0],
                "massKg": 1800.0,
            },
            {
                "epochSeconds": 86_400.0,
                "positionKm": [149_100_000.0, 2_100_000.0, 0.0],
                "velocityKmPerSec": [-0.3, 32.1, 0.0],
                "massKg": 1795.2,
            },
        ],
        maneuver_events=[
            {
                "type": "TCM",
                "startEpoch": "2026-01-02T00:00:00.000Z",
                "durationSeconds": 7200.0,
                "thrustDirection": "prograde",
                "deltaVEstimateKmPerS": 0.0031,
                "propellantUsedKg": 2.4,
                "massBeforeKg": 1800.0,
                "massAfterKg": 1797.6,
            },
            {
                "type": "DSM",
                "startEpoch": "2026-01-10T00:00:00.000Z",
                "durationSeconds": 10800.0,
                "thrustDirection": "target-correction",
                "deltaVEstimateKmPerS": 0.0048,
                "propellantUsedKg": 2.4,
                "massBeforeKg": 1797.6,
                "massAfterKg": 1795.2,
            },
        ],
        warnings=[],
        closest_approach={"distanceKm": 8450000.0},
    )

    assert segment.segment_type == "heliocentricCruise"
    assert segment.mass_summary["massBeforeKg"] == 1800.0
    assert segment.mass_summary["massAfterKg"] == 1795.2
    assert segment.mass_summary["propellantUsedKg"] == 4.8
    assert segment.metadata["targetBody"] == "mars"
    assert segment.metadata["maneuverCount"] == 2
    assert segment.metadata["deltaVTotalKmPerS"] == 0.0079
