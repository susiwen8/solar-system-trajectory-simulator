from fastapi.testclient import TestClient

from app.main import app


class FailingHorizonsClient:
    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        raise RuntimeError("network unavailable")


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


def test_launch_window_falls_back_cleanly_when_online_jpl_is_unavailable(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "1")
    monkeypatch.setenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.core.ephemeris.factory._build_online_client",
        lambda: FailingHorizonsClient(),
    )

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
    assert payload["candidateLaunches"]
