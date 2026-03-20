from pathlib import Path

from app.core.ephemeris.factory import create_ephemeris
from app.schemas.mission import PropulsionConfig
from app.services.tour_planner import MissionTourPlanner


DATA_PATH = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"


def build_planner() -> MissionTourPlanner:
    return MissionTourPlanner(create_ephemeris(DATA_PATH))


def test_tour_planner_covers_all_required_visits() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert candidates
    assert set(candidates[0].visit_order) == {"venus", "jupiter", "saturn"}
    assert candidates[0].full_sequence_bodies[0] == "earth"
    assert candidates[0].mission_timeline is not None
    assert candidates[0].mission_timeline["events"]


def test_tour_planner_can_choose_non_input_visit_order() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("saturn", "venus", "jupiter"),
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert candidates
    assert tuple(candidates[0].visit_order) != ("saturn", "venus", "jupiter")


def test_tour_planner_respects_assist_limit_per_leg() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        launch_epoch="2026-01-01T00:00:00Z",
        max_assist_bodies_per_leg=1,
    )

    assert candidates
    for leg in candidates[0].legs:
        assert len(leg.assist_bodies) <= 1


def test_tour_planner_carries_maneuver_events_into_candidates() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        launch_epoch="2026-01-01T00:00:00Z",
        propulsion_config=PropulsionConfig(
            initialMassKg=1800.0,
            propellantMassKg=420.0,
            maxThrustN=0.8,
            ispSeconds=3200.0,
        ),
    )

    assert candidates
    assert candidates[0].maneuver_events is not None
    assert candidates[0].mission_timeline is not None


def test_tour_planner_adds_flyby_segments_to_candidates() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert candidates
    candidate_with_flyby = next(candidate for candidate in candidates if candidate.flyby_events)
    assert candidate_with_flyby.segments is not None
    assert any(segment["segmentType"] == "flybyEncounter" for segment in candidate_with_flyby.segments)
