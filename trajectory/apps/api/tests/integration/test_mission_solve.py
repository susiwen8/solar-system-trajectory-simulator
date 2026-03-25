from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app
from app.routes.missions import get_mission_search_service
from app.mission.search import MissionSearchService
from tests.fixtures.body_states import BODY_STATE_FIXTURES


class StubEphemerisService:
    def get_vectors(self, body_id: str, *_args, **_kwargs):
        class Result:
            def __init__(self, records):
                self.records = records
                self.source = "stub"

        return Result(BODY_STATE_FIXTURES[body_id])


def create_stubbed_app() -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_mission_search_service] = lambda: MissionSearchService(
        ephemeris_service=StubEphemerisService()
    )
    return app


def test_mission_solve_returns_candidate_payload() -> None:
    client = TestClient(create_stubbed_app())

    response = client.post(
        "/api/missions/solve",
        json={
            "targets": ["mars", "jupiter"],
            "launch_window_start": "2030-01-01T00:00:00Z",
            "launch_window_end": "2030-03-01T00:00:00Z",
            "max_duration_days": 3000,
            "min_leg_duration_days": 90,
            "max_leg_duration_days": 1200,
            "time_weight": 0.6,
            "allow_gravity_assists": True,
            "flyby_altitude_multiplier": 2.0,
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert len(payload["candidates"]) >= 1
    assert payload["candidates"][0]["summary"]["label"] in {
        "recommended",
        "time_efficient",
        "fuel_efficient",
    }


def test_mission_solve_returns_warnings_for_infeasible_search() -> None:
    client = TestClient(create_stubbed_app())

    response = client.post(
        "/api/missions/solve",
        json={
            "targets": ["mars"],
            "launch_window_start": "2030-01-01T00:00:00Z",
            "launch_window_end": "2030-01-02T00:00:00Z",
            "max_duration_days": 10,
            "min_leg_duration_days": 1,
            "max_leg_duration_days": 5,
            "time_weight": 0.6,
            "allow_gravity_assists": True,
            "flyby_altitude_multiplier": 2.0,
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["candidates"] == []
    assert len(payload["warnings"]) >= 1
