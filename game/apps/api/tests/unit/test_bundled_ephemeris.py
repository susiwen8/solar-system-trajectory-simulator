from pathlib import Path

from app.core.ephemeris.bundled import BundledEphemeris


def test_bundled_ephemeris_returns_earth_state() -> None:
    data_path = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"
    ephemeris = BundledEphemeris(data_path)
    state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    assert state.body_id == "earth"
    assert len(state.position_km) == 3
    assert len(state.velocity_km_per_s) == 3
    assert state.mu_km3_per_s2 > 0
