from pathlib import Path
from types import MethodType, SimpleNamespace

import numpy as np

from app.core.ephemeris.base import BodyState, MAJOR_BODY_IDS
from app.core.ephemeris.factory import create_ephemeris
from app.schemas.mission import NavigationConfig, PropulsionConfig
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


def test_tour_planner_appends_earth_return_leg_when_enabled() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("mars",),
        launch_epoch="2026-01-01T00:00:00Z",
        return_to_departure=True,
    )

    assert candidates
    candidate = candidates[0]
    assert candidate.visit_order == ("mars",)
    assert candidate.full_sequence_bodies[0] == "earth"
    assert candidate.full_sequence_bodies[-1] == "earth"
    assert candidate.legs[-1].end_body == "earth"
    assert candidate.closest_approach["bodyId"] == "earth"
    assert candidate.visit_events[-1].body_id == "earth"


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


def test_tour_planner_adds_final_arrival_capture_segments() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("mars", "jupiter"),
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert candidates
    final_candidate = candidates[0]
    assert final_candidate.segments is not None
    segment_types = [segment["segmentType"] for segment in final_candidate.segments]
    assert "arrivalHyperbolicApproach" in segment_types
    assert "orbitInsertionBurn" in segment_types
    assert "parkingOrbit" in segment_types


def test_tour_planner_applies_navigation_overlay_to_candidates() -> None:
    planner = build_planner()

    candidates = planner.plan_tour(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter"),
        launch_epoch="2026-01-01T00:00:00Z",
        navigation_config=NavigationConfig.model_validate(
            {
                "enabled": True,
                "randomSeed": 4,
                "injectionDispersion": {
                    "positionSigmaKm": 25.0,
                    "velocitySigmaKmPerS": 0.02,
                },
                "correctionPolicy": {
                    "maxTcmCount": 2,
                    "predictedMissThresholdKm": 500.0,
                    "positionDeviationThresholdKm": 10.0,
                    "velocityDeviationThresholdKmPerS": 0.001,
                    "checkpointStepSeconds": 86_400.0,
                    "maxCorrectionDeltaVKmPerS": 0.02,
                },
            }
        ),
    )

    assert candidates
    assert candidates[0].navigation_telemetry is not None
    assert candidates[0].navigation_telemetry["dispersedSamples"]
    assert candidates[0].samples == candidates[0].navigation_telemetry["dispersedSamples"]


def test_tour_estimates_use_lightweight_gravity_assist_search() -> None:
    planner = build_planner()

    def fail_full_search(self, **kwargs):
        raise AssertionError("estimate_tour_candidates should not call full gravity-assist search")

    def lightweight_search(
        self,
        *,
        departure_body: str,
        target_body: str,
        launch_epoch: str,
        max_flybys: int = 3,
        candidate_limit: int = 5,
        sequence_budget: int = 36,
    ):
        del launch_epoch, max_flybys, candidate_limit, sequence_budget
        return [
            SimpleNamespace(
                sequence_bodies=(departure_body, target_body),
                total_flight_time_seconds=120.0 * 86_400.0,
                delta_v_km_per_s=3.2,
                flyby_events=(),
            )
        ]

    planner.gravity_assist_search.search = MethodType(fail_full_search, planner.gravity_assist_search)
    planner.gravity_assist_search.search_estimates = MethodType(lightweight_search, planner.gravity_assist_search)

    candidates = planner.estimate_tour_candidates(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter"),
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert candidates
    assert candidates[0].visit_order


def test_tour_planner_acceleration_fn_reuses_nearby_ephemeris_batches() -> None:
    class CountingEphemeris:
        def __init__(self) -> None:
            self.calls: list[str] = []

        def get_all_body_states(self, epoch: str):
            self.calls.append(epoch)
            return [
                BodyState(
                    body_id=body_id,
                    epoch=epoch,
                    position_km=(float(index + 1), 0.0, 0.0),
                    velocity_km_per_s=(0.0, 0.0, 0.0),
                    mu_km3_per_s2=1.0,
                    source_name="test",
                )
                for index, body_id in enumerate(MAJOR_BODY_IDS)
            ]

    ephemeris = CountingEphemeris()
    planner = MissionTourPlanner(ephemeris)
    acceleration_fn = planner._build_acceleration_fn("2026-01-01T00:00:00Z")
    probe_position = np.array((0.0, 1.0, 0.0), dtype=float)

    for offset_seconds in (10.0, 20.0, 30.0, 40.0, 50.0):
        acceleration_fn(offset_seconds, probe_position)

    assert len(ephemeris.calls) == 2
