from pathlib import Path

from app.core.ephemeris.factory import create_ephemeris
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
