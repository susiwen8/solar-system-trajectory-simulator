from app.core.ephemeris.base import BodyState
from app.core.ephemeris.interpolated_cache import InterpolatedEphemerisCache


class RecordingEphemeris:
    def __init__(self) -> None:
        self.batch_epochs: list[str] = []

    @property
    def source_name(self) -> str:
        return "recording"

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        raise AssertionError("InterpolatedEphemerisCache should satisfy major-body lookups from cached batches")

    def get_all_body_states(self, epoch: str) -> list[BodyState]:
        self.batch_epochs.append(epoch)
        if epoch.endswith("00:00:00.000Z"):
            earth_position = (0.0, 0.0, 0.0)
        elif epoch.endswith("06:00:00.000Z"):
            earth_position = (60.0, 0.0, 0.0)
        elif epoch.endswith("12:00:00.000Z"):
            earth_position = (120.0, 0.0, 0.0)
        else:
            raise AssertionError(f"Unexpected epoch {epoch}")

        return [
            BodyState("sun", epoch, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 132_712_440_018.0),
            BodyState("earth", epoch, earth_position, (10.0, 0.0, 0.0), 398_600.435_436),
        ]


def test_interpolated_cache_reuses_batch_queries_within_one_step() -> None:
    cache = InterpolatedEphemerisCache(
        ephemeris=RecordingEphemeris(),
        base_epoch="2026-01-01T00:00:00Z",
        step_seconds=6 * 3600.0,
    )

    cache.get_all_body_states(1_000.0)
    cache.get_all_body_states(8_000.0)
    cache.get_all_body_states(25_000.0)

    assert cache.ephemeris.batch_epochs == [
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T06:00:00.000Z",
        "2026-01-01T12:00:00.000Z",
    ]


def test_interpolated_cache_interpolates_major_body_states_between_batches() -> None:
    cache = InterpolatedEphemerisCache(
        ephemeris=RecordingEphemeris(),
        base_epoch="2026-01-01T00:00:00Z",
        step_seconds=6 * 3600.0,
    )

    earth_state = cache.get_body_state("earth", 3 * 3600.0)

    assert earth_state.epoch == "2026-01-01T03:00:00.000Z"
    assert earth_state.position_km == (30.0, 0.0, 0.0)
    assert earth_state.velocity_km_per_s == (10.0, 0.0, 0.0)
