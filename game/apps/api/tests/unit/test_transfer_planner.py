import numpy as np

from app.services.transfer_planner import TransferPlanner


def test_transfer_planner_solves_a_transfer_that_arrives_close_to_mars(bundled_ephemeris) -> None:
    plan = TransferPlanner(ephemeris=bundled_ephemeris).plan_auto_transfer(
        departure_body="earth",
        target_body="mars",
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert plan.duration_seconds > 100 * 24 * 3600
    assert plan.miss_distance_km < 2_000_000


def test_transfer_planner_starts_auto_transfer_near_earth_sphere_of_influence(bundled_ephemeris) -> None:
    planner = TransferPlanner(ephemeris=bundled_ephemeris)
    plan = planner.plan_auto_transfer(
        departure_body="earth",
        target_body="mars",
        launch_epoch="2026-01-01T00:00:00Z",
    )
    earth_state = bundled_ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    departure_offset_km = float(
        np.linalg.norm(plan.initial_state[:3] - np.array(earth_state.position_km, dtype=float))
    )

    assert 500_000.0 < departure_offset_km < 1_500_000.0
