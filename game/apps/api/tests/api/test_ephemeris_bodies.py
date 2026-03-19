from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_ephemeris_bodies_returns_major_planet_states() -> None:
    client = TestClient(app)
    response = client.get("/ephemeris/bodies", params={"epoch": "2026-01-01T00:00:00Z"})

    assert response.status_code == 200
    data = response.json()
    assert any(body["bodyId"] == "earth" for body in data["bodies"])
    assert any(body["bodyId"] == "mars" for body in data["bodies"])
    assert data["ephemerisSource"] == "mixed"
    assert any(body["sourceName"] == "bundled-ephemeris" for body in data["bodies"])


def test_ephemeris_bodies_prefers_jpl_file_when_configured(monkeypatch) -> None:
    jpl_path = Path(__file__).resolve().parents[1] / "data/ephemeris/jpl_reference.json"
    monkeypatch.setenv("SOLAR_SYSTEM_JPL_EPHEMERIS_PATH", str(jpl_path))

    client = TestClient(app)
    response = client.get("/ephemeris/bodies", params={"epoch": "2026-01-01T00:00:00Z"})

    assert response.status_code == 200
    data = response.json()
    assert data["ephemerisSource"] == "mixed"
    earth = next(body for body in data["bodies"] if body["bodyId"] == "earth")
    assert earth["positionKm"][0] == -24_856_124.0
    assert earth["sourceName"] == "jpl-horizons-file"
