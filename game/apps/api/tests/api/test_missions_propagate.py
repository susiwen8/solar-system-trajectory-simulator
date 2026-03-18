from fastapi.testclient import TestClient

from app.main import app


def test_propagate_returns_samples_and_metrics() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {
                "stateVector": {
                    "positionKm": [149597870.7, 0.0, 0.0],
                    "velocityKmPerSec": [0.0, 29.78, 0.0]
                }
            },
            "durationSeconds": 259200,
            "outputStepSeconds": 21600,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["samples"]) > 10
    assert "closestApproach" in data
