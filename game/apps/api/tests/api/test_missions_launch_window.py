from fastapi.testclient import TestClient

from app.main import app


def test_launch_window_endpoint_accepts_trajectory_request_shape() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/launch-window",
        json={
            "missionType": "trajectory",
            "departureBody": "earth",
            "targetBody": "mars",
            "earliestLaunchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code != 422


def test_launch_window_returns_trajectory_window_payload() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/launch-window",
        json={
            "missionType": "trajectory",
            "departureBody": "earth",
            "targetBody": "mars",
            "earliestLaunchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "recommendedLaunchEpoch" in payload
    assert "candidateLaunches" in payload
    assert payload["candidateLaunches"][0]["targetBody"] == "mars"


def test_launch_window_returns_tour_window_payload() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/launch-window",
        json={
            "missionType": "tour",
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter", "saturn"],
            "earliestLaunchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "recommendedLaunchEpoch" in payload
    assert payload["candidateLaunches"][0]["visitOrder"] == ["venus", "jupiter", "saturn"]
