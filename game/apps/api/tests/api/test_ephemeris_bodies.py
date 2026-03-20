from pathlib import Path

from fastapi.testclient import TestClient

from app.core.ephemeris.cache_store import EphemerisCacheStore
from app.main import app


class FailingHorizonsClient:
    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        raise RuntimeError("network unavailable")


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


def test_ephemeris_bodies_uses_cached_online_data_and_falls_back(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "1")
    monkeypatch.setenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.core.ephemeris.factory._build_online_client",
        lambda: FailingHorizonsClient(),
    )
    store = EphemerisCacheStore(tmp_path)
    store.write_body_samples(
        body_id="earth",
        mu_km3_per_s2=398600.435436,
        source_name="jpl-horizons-online-cache",
        samples={
            "2026-01-01T00:00:00Z": {
                "positionKm": [1.0, 2.0, 3.0],
                "velocityKmPerSec": [4.0, 5.0, 6.0],
            }
        },
    )

    client = TestClient(app)
    response = client.get("/ephemeris/bodies", params={"epoch": "2026-01-01T00:00:00Z"})

    assert response.status_code == 200
    data = response.json()
    earth = next(body for body in data["bodies"] if body["bodyId"] == "earth")
    assert earth["sourceName"] == "jpl-horizons-online-cache"
    assert any(body["sourceName"] != "jpl-horizons-online-cache" for body in data["bodies"])
