import numpy as np

from app.core.ephemeris.base import BodyState
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


def test_auto_transfer_without_propulsion_keeps_six_element_state_vector(bundled_ephemeris) -> None:
    plan = TransferPlanner(ephemeris=bundled_ephemeris).plan_auto_transfer(
        departure_body="earth",
        target_body="mars",
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert plan.initial_state.shape == (6,)


def test_transfer_planner_reuses_ephemeris_batches_during_short_propagation() -> None:
    class RecordingEphemeris:
        def __init__(self) -> None:
            self.batch_epochs: list[str] = []

        @property
        def source_name(self) -> str:
            return "recording"

        def get_body_state(self, body_id: str, epoch: str) -> BodyState:
            raise AssertionError("Short propagation path should only use batch body-state queries")

        def get_all_body_states(self, epoch: str) -> list[BodyState]:
            self.batch_epochs.append(epoch)
            return [
                BodyState("sun", epoch, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 132_712_440_018.0),
                BodyState("earth", epoch, (149_597_870.7, 0.0, 0.0), (0.0, 29.78, 0.0), 398_600.435_436),
                BodyState("mars", epoch, (227_900_000.0, 0.0, 0.0), (0.0, 24.0, 0.0), 42_828.375_816),
            ]

    planner = TransferPlanner(ephemeris=RecordingEphemeris())
    planner._propagate_to_epoch(
        np.array([149_597_870.7, 0.0, 0.0, 0.0, 29.78, 0.0], dtype=float),
        3 * 24 * 3600.0,
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert len(set(planner.ephemeris.batch_epochs)) <= 13


def test_plan_auto_transfer_limits_full_propagation_passes(bundled_ephemeris) -> None:
    planner = TransferPlanner(ephemeris=bundled_ephemeris)
    original = planner._propagate_to_epoch
    call_count = 0

    def counting_propagation(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return original(*args, **kwargs)

    planner._propagate_to_epoch = counting_propagation  # type: ignore[method-assign]

    planner.plan_auto_transfer(
        departure_body="earth",
        target_body="mars",
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert call_count <= 12
