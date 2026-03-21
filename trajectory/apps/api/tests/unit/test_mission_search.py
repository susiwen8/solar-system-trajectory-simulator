from app.mission.models import MissionRequest
from app.mission.scoring import score_candidate
from app.mission.search import MissionSearchService
from tests.fixtures.body_states import BODY_STATE_FIXTURES


class StubEphemerisService:
    def get_vectors(self, body_id: str, *_args, **_kwargs):
        class Result:
            def __init__(self, records):
                self.records = records
                self.source = "stub"

        return Result(BODY_STATE_FIXTURES[body_id])


def test_score_candidate_rewards_lower_time_and_delta_v() -> None:
    request = MissionRequest(
        targets=["mars"],
        launch_window_start="2030-01-01T00:00:00Z",
        launch_window_end="2030-03-01T00:00:00Z",
        max_duration_days=500,
        min_leg_duration_days=100,
        max_leg_duration_days=300,
        time_weight=0.4,
        allow_gravity_assists=True,
        flyby_altitude_multiplier=2.0,
    )

    fast_expensive = score_candidate(
        request,
        total_delta_v=9.0,
        total_duration_days=180.0,
        near_limit_count=0,
    )
    slow_cheap = score_candidate(
        request,
        total_delta_v=5.5,
        total_duration_days=260.0,
        near_limit_count=0,
    )

    assert fast_expensive > 0
    assert slow_cheap > 0
    assert fast_expensive != slow_cheap


def test_mission_request_rejects_empty_targets() -> None:
    try:
        MissionRequest(
            targets=[],
            launch_window_start="2030-01-01T00:00:00Z",
            launch_window_end="2030-03-01T00:00:00Z",
            max_duration_days=500,
            min_leg_duration_days=100,
            max_leg_duration_days=300,
            time_weight=0.4,
            allow_gravity_assists=True,
            flyby_altitude_multiplier=2.0,
        )
    except ValueError as error:
        assert "At least one target" in str(error)
    else:
        raise AssertionError("MissionRequest should reject empty targets")


def test_mission_request_rejects_reversed_launch_window() -> None:
    try:
        MissionRequest(
            targets=["mars"],
            launch_window_start="2030-03-01T00:00:00Z",
            launch_window_end="2030-01-01T00:00:00Z",
            max_duration_days=500,
            min_leg_duration_days=100,
            max_leg_duration_days=300,
            time_weight=0.4,
            allow_gravity_assists=True,
            flyby_altitude_multiplier=2.0,
        )
    except ValueError as error:
        assert "launch_window_end" in str(error)
    else:
        raise AssertionError("MissionRequest should reject reversed launch windows")


def test_search_service_returns_ranked_candidates_for_stubbed_earth_mars_transfer() -> None:
    service = MissionSearchService(ephemeris_service=StubEphemerisService())

    candidates = service.solve(
        targets=["mars"],
        launch_window_start="2030-01-01T00:00:00Z",
        launch_window_end="2030-02-01T00:00:00Z",
        max_duration_days=400,
        min_leg_duration_days=120,
        max_leg_duration_days=260,
        time_weight=0.5,
        allow_gravity_assists=True,
        flyby_altitude_multiplier=2.0,
    )

    assert len(candidates) >= 1
    assert candidates[0].legs[0].departure_body_id == "earth"
    assert candidates[0].legs[0].arrival_body_id == "mars"

