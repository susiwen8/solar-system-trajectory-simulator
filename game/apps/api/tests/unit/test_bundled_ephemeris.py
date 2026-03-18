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


def test_bundled_ephemeris_interpolates_between_known_epochs() -> None:
    data_path = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"
    ephemeris = BundledEphemeris(data_path)

    state = ephemeris.get_body_state("earth", "2026-01-01T06:00:00.000Z")

    assert state.epoch == "2026-01-01T06:00:00.000Z"
    assert state.position_km[0] == -25500603.2
    assert state.position_km[1] == 144826218.8
