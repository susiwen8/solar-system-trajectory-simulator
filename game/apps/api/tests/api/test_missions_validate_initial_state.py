from fastapi.testclient import TestClient

from app.main import app


def test_validate_initial_state_rejects_missing_velocity() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/validate-initial-state",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-10-15T00:00:00Z",
            "initialState": {"stateVector": {"positionKm": [1.0, 2.0, 3.0]}},
            "durationSeconds": 86400,
            "outputStepSeconds": 3600,
        },
    )

    assert response.status_code == 422


def test_validate_initial_state_accepts_complete_state_vector() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/validate-initial-state",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-10-15T00:00:00Z",
            "initialState": {
                "stateVector": {
                    "positionKm": [149597870.7, 0.0, 0.0],
                    "velocityKmPerSec": [0.0, 29.78, 0.0]
                }
            },
            "durationSeconds": 86400,
            "outputStepSeconds": 3600,
        },
    )

    assert response.status_code == 204
