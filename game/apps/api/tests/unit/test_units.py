from app.core.units import seconds_since_j2000


def test_seconds_since_j2000_for_reference_epoch() -> None:
    assert seconds_since_j2000("2000-01-01T12:00:00Z") == 0.0
