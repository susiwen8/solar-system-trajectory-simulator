from pathlib import Path

from app.core.ephemeris.composite import CompositeEphemeris
from app.core.ephemeris.factory import create_ephemeris


def test_factory_returns_bundled_ephemeris_without_jpl_override() -> None:
    bundle_path = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"

    ephemeris = create_ephemeris(bundle_path, jpl_path=None)

    assert ephemeris.source_name == "bundled-keplerian"


def test_factory_prefers_local_jpl_file_when_available() -> None:
    bundle_path = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"
    jpl_path = Path(__file__).resolve().parents[1] / "data/ephemeris/jpl_reference.json"

    ephemeris = create_ephemeris(bundle_path, jpl_path=jpl_path)

    assert isinstance(ephemeris, CompositeEphemeris)
    assert ephemeris.source_name == "jpl-horizons-file+fallback:bundled-keplerian"
    earth_state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")
    assert earth_state.position_km[0] == -24_856_124.0
