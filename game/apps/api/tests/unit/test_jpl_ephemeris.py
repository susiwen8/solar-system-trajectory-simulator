from pathlib import Path

from app.core.ephemeris.jpl import JPLFileEphemeris


def test_jpl_ephemeris_interpolates_between_known_epochs() -> None:
    data_path = Path(__file__).resolve().parents[1] / "data/ephemeris/jpl_reference.json"
    ephemeris = JPLFileEphemeris(data_path)

    state = ephemeris.get_body_state("earth", "2026-01-01T12:00:00Z")

    assert state.position_km[0] == (-24_856_124.0 + -27_419_840.0) / 2.0
    assert state.velocity_km_per_s[1] == (-5.127 + -5.643) / 2.0
