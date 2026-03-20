from pathlib import Path

import pytest

from app.core.ephemeris.cache_store import EphemerisCacheStore
from app.core.ephemeris.online import OnlineCachedEphemeris


class StubHorizonsClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str, str]] = []

    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        self.calls.append((body_id, start_epoch, stop_epoch, step_size))
        return {
            "2026-01-01T00:00:00Z": {
                "positionKm": [1.0, 2.0, 3.0],
                "velocityKmPerSec": [4.0, 5.0, 6.0],
            }
        }


class FailingHorizonsClient:
    def __init__(self) -> None:
        self.calls = 0

    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        self.calls += 1
        raise RuntimeError("network unavailable")


def test_online_ephemeris_uses_cached_body_before_fetching(tmp_path: Path) -> None:
    store = EphemerisCacheStore(tmp_path)
    store.write_body_samples(
        body_id="earth",
        mu_km3_per_s2=398600.435436,
        source_name="jpl-horizons-online-cache",
        samples={
            "2026-01-01T00:00:00Z": {
                "positionKm": [7.0, 8.0, 9.0],
                "velocityKmPerSec": [1.0, 2.0, 3.0],
            }
        },
    )
    client = StubHorizonsClient()
    ephemeris = OnlineCachedEphemeris(cache_root=tmp_path, client=client)

    state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    assert state.position_km[0] == 7.0
    assert client.calls == []


def test_online_ephemeris_fetches_and_caches_missing_body_epoch(tmp_path: Path) -> None:
    client = StubHorizonsClient()
    ephemeris = OnlineCachedEphemeris(cache_root=tmp_path, client=client)

    state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    assert state.position_km[0] == 1.0
    assert client.calls
    assert (tmp_path / "earth.json").exists()


def test_online_ephemeris_raises_key_error_when_fetch_fails(tmp_path: Path) -> None:
    ephemeris = OnlineCachedEphemeris(cache_root=tmp_path, client=FailingHorizonsClient())

    with pytest.raises(KeyError):
        ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")


def test_online_ephemeris_stops_retrying_after_online_failure(tmp_path: Path) -> None:
    client = FailingHorizonsClient()
    ephemeris = OnlineCachedEphemeris(cache_root=tmp_path, client=client)

    with pytest.raises(KeyError):
        ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")
    with pytest.raises(KeyError):
        ephemeris.get_body_state("mars", "2026-01-02T00:00:00Z")

    assert client.calls == 1


def test_online_ephemeris_keeps_serving_cached_bodies_after_online_failure(tmp_path: Path) -> None:
    client = FailingHorizonsClient()
    store = EphemerisCacheStore(tmp_path)
    store.write_body_samples(
        body_id="earth",
        mu_km3_per_s2=398600.435436,
        source_name="jpl-horizons-online-cache",
        samples={
            "2026-01-01T00:00:00Z": {
                "positionKm": [7.0, 8.0, 9.0],
                "velocityKmPerSec": [1.0, 2.0, 3.0],
            }
        },
    )
    ephemeris = OnlineCachedEphemeris(cache_root=tmp_path, client=client)

    with pytest.raises(KeyError):
        ephemeris.get_body_state("mars", "2026-01-01T00:00:00Z")

    state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    assert state.position_km[0] == 7.0
