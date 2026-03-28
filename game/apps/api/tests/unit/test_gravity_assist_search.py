from pathlib import Path
from types import MethodType, SimpleNamespace

from app.core.ephemeris.factory import create_ephemeris
from app.services import gravity_assist_search as gravity_assist_search_module
from app.services.gravity_assist_search import GravityAssistSearchService


DATA_PATH = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"


def build_service() -> GravityAssistSearchService:
    return GravityAssistSearchService(create_ephemeris(DATA_PATH))


def test_search_prefers_a_gravity_assist_plan_for_saturn() -> None:
    service = build_service()

    candidates = service.search(
        departure_body="earth",
        target_body="saturn",
        launch_epoch="2026-01-01T00:00:00Z",
        candidate_limit=5,
        sequence_budget=36,
    )

    assert candidates
    assert candidates[0].flyby_events
    assert "jupiter" in candidates[0].sequence_bodies


def test_generate_sequences_prunes_backtracking_outer_routes() -> None:
    service = build_service()

    sequences = service._generate_sequences(
        departure_body="earth",
        target_body="saturn",
        max_flybys=3,
        sequence_budget=120,
    )

    assert ("jupiter", "neptune", "venus") not in sequences
    assert ("jupiter", "uranus") not in sequences


def test_search_estimates_reuses_body_states_within_a_single_search() -> None:
    class CountingEphemeris:
        def __init__(self) -> None:
            self.calls = {}

        def get_body_state(self, body_id: str, epoch: str):
            key = (body_id, epoch)
            self.calls[key] = self.calls.get(key, 0) + 1
            return SimpleNamespace(
                position_km=(1.0, 0.0, 0.0),
                velocity_km_per_s=(0.0, 1.0, 0.0),
            )

    service = GravityAssistSearchService(CountingEphemeris())

    def duplicate_sequences(self, **kwargs):
        del kwargs
        return [tuple(), tuple()]

    def single_scale(self, assist_bodies):
        del assist_bodies
        return (1.0,)

    def fake_leg_plans(self, *, bodies, launch_epoch: str, global_scale: float):
        del bodies, global_scale
        return (
            SimpleNamespace(
                departure_body="earth",
                arrival_body="mars",
                departure_epoch=launch_epoch,
                arrival_epoch="2026-06-01T00:00:00Z",
                duration_seconds=120.0 * 86_400.0,
                departure_velocity_km_per_s=(0.0, 1.0, 0.0),
                arrival_velocity_km_per_s=(0.0, 1.0, 0.0),
            ),
        )

    service._generate_sequences = MethodType(duplicate_sequences, service)
    service._candidate_scales = MethodType(single_scale, service)
    service._build_leg_plans = MethodType(fake_leg_plans, service)

    candidates = service.search_estimates(
        departure_body="earth",
        target_body="mars",
        launch_epoch="2026-01-01T00:00:00Z",
        candidate_limit=2,
    )

    assert candidates
    assert service.ephemeris.calls[("earth", "2026-01-01T00:00:00Z")] == 1
    assert service.ephemeris.calls[("mars", "2026-06-01T00:00:00Z")] == 1


def test_search_estimates_reuses_identical_leg_lambert_solves(monkeypatch) -> None:
    class MinimalEphemeris:
        def get_body_state(self, body_id: str, epoch: str):
            del epoch
            position_map = {
                "earth": (1.0, 0.0, 0.0),
                "mars": (0.0, 1.0, 0.0),
            }
            return SimpleNamespace(
                position_km=position_map[body_id],
                velocity_km_per_s=(0.0, 1.0, 0.0),
            )

    service = GravityAssistSearchService(MinimalEphemeris())
    lambert_calls = 0

    def duplicate_sequences(self, **kwargs):
        del kwargs
        return [tuple(), tuple()]

    def single_scale(self, assist_bodies):
        del assist_bodies
        return (1.0,)

    def fake_lambert(**kwargs):
        nonlocal lambert_calls
        del kwargs
        lambert_calls += 1
        return SimpleNamespace(
            departure_velocity_km_per_s=(0.0, 1.0, 0.0),
            arrival_velocity_km_per_s=(0.0, 1.0, 0.0),
        )

    service._generate_sequences = MethodType(duplicate_sequences, service)
    service._candidate_scales = MethodType(single_scale, service)
    monkeypatch.setattr(gravity_assist_search_module, "solve_lambert_transfer", fake_lambert)

    candidates = service.search_estimates(
        departure_body="earth",
        target_body="mars",
        launch_epoch="2026-01-01T00:00:00Z",
        candidate_limit=2,
    )

    assert candidates
    assert lambert_calls == 1
