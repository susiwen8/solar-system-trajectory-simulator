import json
from pathlib import Path

from app.core.ephemeris.horizons_import import (
    build_horizons_dataset,
    infer_body_id_from_horizons_text,
    parse_horizons_vector_csv,
    resolve_input_map,
)


def test_parse_horizons_vector_csv_reads_state_samples() -> None:
    text = (
        Path(__file__).resolve().parents[1] / "data/ephemeris/horizons_earth_vectors.csv"
    ).read_text()

    samples = parse_horizons_vector_csv(text)

    assert samples["2026-01-01T00:00:00Z"]["positionKm"][0] == -24_856_124.0
    assert samples["2026-01-02T00:00:00Z"]["velocityKmPerSec"][1] == -5.643


def test_infer_body_id_from_horizons_header() -> None:
    text = (
        Path(__file__).resolve().parents[1] / "data/ephemeris/horizons_mars_vectors.csv"
    ).read_text()

    assert infer_body_id_from_horizons_text(text) == "mars"


def test_build_horizons_dataset_combines_multiple_body_exports(tmp_path: Path) -> None:
    earth_path = Path(__file__).resolve().parents[1] / "data/ephemeris/horizons_earth_vectors.csv"
    mars_path = Path(__file__).resolve().parents[1] / "data/ephemeris/horizons_mars_vectors.csv"
    output_path = tmp_path / "imported.json"

    build_horizons_dataset(
        inputs={
            "earth": earth_path,
            "mars": mars_path,
        },
        output_path=output_path,
        source_name="jpl-horizons-import",
    )

    dataset = json.loads(output_path.read_text())

    assert dataset["metadata"]["source"] == "jpl-horizons-import"
    assert dataset["bodies"]["earth"]["samples"]["2026-01-01T00:00:00Z"]["positionKm"][1] == 144_936_962.0
    assert dataset["bodies"]["mars"]["samples"]["2026-01-02T00:00:00Z"]["velocityKmPerSec"][2] == 0.16


def test_resolve_input_map_can_infer_body_ids_from_horizons_files() -> None:
    earth_path = Path(__file__).resolve().parents[1] / "data/ephemeris/horizons_earth_vectors.csv"
    mars_path = Path(__file__).resolve().parents[1] / "data/ephemeris/horizons_mars_vectors.csv"

    resolved = resolve_input_map([str(earth_path), str(mars_path)])

    assert resolved["earth"] == earth_path
    assert resolved["mars"] == mars_path
