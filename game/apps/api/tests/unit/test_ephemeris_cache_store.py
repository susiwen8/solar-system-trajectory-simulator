from pathlib import Path

from app.core.ephemeris.cache_store import EphemerisCacheStore


def test_cache_store_persists_and_reads_body_windows(tmp_path: Path) -> None:
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

    dataset = store.read_body_dataset("earth")

    assert dataset["samples"]["2026-01-01T00:00:00Z"]["positionKm"][0] == 1.0


def test_cache_store_merges_overlapping_samples(tmp_path: Path) -> None:
    store = EphemerisCacheStore(tmp_path)
    store.write_body_samples(
        body_id="mars",
        mu_km3_per_s2=42828.375816,
        source_name="jpl-horizons-online-cache",
        samples={
            "2026-01-01T00:00:00Z": {
                "positionKm": [1.0, 0.0, 0.0],
                "velocityKmPerSec": [0.0, 1.0, 0.0],
            }
        },
    )
    store.write_body_samples(
        body_id="mars",
        mu_km3_per_s2=42828.375816,
        source_name="jpl-horizons-online-cache",
        samples={
            "2026-01-02T00:00:00Z": {
                "positionKm": [2.0, 0.0, 0.0],
                "velocityKmPerSec": [0.0, 1.0, 0.0],
            }
        },
    )

    dataset = store.read_body_dataset("mars")

    assert len(dataset["samples"]) == 2
