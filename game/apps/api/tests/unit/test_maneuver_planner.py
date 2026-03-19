import pytest

from app.schemas.mission import PropulsionConfig
from app.services.maneuver_planner import ManeuverPlanner


def test_maneuver_planner_places_tcm_dsm_and_arrival_windows() -> None:
    planner = ManeuverPlanner()
    maneuvers = planner.plan_candidate_windows(
        samples=[
            {
                "epochSeconds": 0.0,
                "positionKm": [1.0, 0.0, 0.0],
                "velocityKmPerSec": [0.0, 10.0, 0.0],
            },
            {
                "epochSeconds": 4_000_000.0,
                "positionKm": [2.0, 0.0, 0.0],
                "velocityKmPerSec": [0.0, 10.0, 0.0],
            },
            {
                "epochSeconds": 8_000_000.0,
                "positionKm": [3.0, 0.0, 0.0],
                "velocityKmPerSec": [0.0, 10.0, 0.0],
            },
        ],
        closest_epoch_seconds=8_000_000.0,
        propulsion_config=PropulsionConfig(
            initialMassKg=1800.0,
            propellantMassKg=420.0,
            maxThrustN=0.8,
            ispSeconds=3200.0,
        ),
    )

    assert {maneuver.burn_type for maneuver in maneuvers} <= {"TCM", "DSM", "arrivalCorrection"}
    assert len(maneuvers) <= 3


def test_maneuver_planner_rejects_invalid_propulsion_config() -> None:
    planner = ManeuverPlanner()

    with pytest.raises(ValueError):
        planner.validate_propulsion_config(
            PropulsionConfig(
                initialMassKg=1000.0,
                propellantMassKg=999.0,
                maxThrustN=0.8,
                ispSeconds=3200.0,
            )
        )
