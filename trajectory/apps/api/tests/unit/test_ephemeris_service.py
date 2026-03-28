from pathlib import Path

from app.services.ephemeris_service import EphemerisService


class StubClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = 0

    def fetch_vectors(self, *_, **__):
        self.calls += 1
        return self.payload


class FailingClient:
    def __init__(self) -> None:
        self.calls = 0

    def fetch_vectors(self, *_, **__):
        self.calls += 1
        raise RuntimeError("upstream unavailable")


def test_ephemeris_service_hits_remote_then_caches(tmp_path: Path) -> None:
    payload = [
        {
            "timestamp": "2030-01-01T00:00:00Z",
            "position_km": [1.0, 2.0, 3.0],
            "velocity_km_s": [0.1, 0.2, 0.3],
        }
    ]
    service = EphemerisService(cache_dir=tmp_path, client=StubClient(payload))

    first = service.get_vectors("earth", "2030-01-01", "2030-01-02", "1d")
    second = service.get_vectors("earth", "2030-01-01", "2030-01-02", "1d")

    assert first.records == second.records
    assert first.source == "remote"
    assert second.source == "cache"
    assert service.client.calls == 1


def test_ephemeris_service_uses_cached_vectors_when_remote_fails(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "timestamp": "2030-01-01T00:00:00Z",
            "position_km": [10.0, 20.0, 30.0],
            "velocity_km_s": [1.0, 2.0, 3.0],
        }
    ]
    primed_service = EphemerisService(cache_dir=tmp_path, client=StubClient(payload))
    primed_service.get_vectors("mars", "2030-01-01", "2030-01-02", "1d")

    fallback_service = EphemerisService(cache_dir=tmp_path, client=FailingClient())

    result = fallback_service.get_vectors("mars", "2030-01-01", "2030-01-02", "1d")

    assert result.records == payload
    assert result.source == "cache"
