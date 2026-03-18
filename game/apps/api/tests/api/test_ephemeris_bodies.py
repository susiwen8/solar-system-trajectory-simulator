from fastapi.testclient import TestClient

from app.main import app


def test_ephemeris_bodies_returns_major_planet_states() -> None:
    client = TestClient(app)
    response = client.get("/ephemeris/bodies", params={"epoch": "2026-01-01T00:00:00Z"})

    assert response.status_code == 200
    data = response.json()
    assert any(body["bodyId"] == "earth" for body in data["bodies"])
    assert any(body["bodyId"] == "mars" for body in data["bodies"])
