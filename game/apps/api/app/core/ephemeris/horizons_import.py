import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Mapping

from app.core.constants import SOLAR_SYSTEM_MU_KM3_PER_S2

BODY_NAME_ALIASES = {
    "mercury": "mercury",
    "venus": "venus",
    "earth": "earth",
    "mars": "mars",
    "jupiter": "jupiter",
    "saturn": "saturn",
    "uranus": "uranus",
    "neptune": "neptune",
    "sun": "sun",
}


def parse_horizons_vector_csv(contents: str) -> Dict[str, Dict[str, list[float]]]:
    lines = contents.splitlines()
    try:
        start_index = next(index for index, line in enumerate(lines) if line.strip() == "$$SOE") + 1
        end_index = next(index for index, line in enumerate(lines) if line.strip() == "$$EOE")
    except StopIteration as error:
        raise ValueError("Horizons export is missing $$SOE/$$EOE markers") from error

    samples: Dict[str, Dict[str, list[float]]] = {}
    for raw_line in lines[start_index:end_index]:
        line = raw_line.strip()
        if not line:
            continue
        row = next(csv.reader([line], skipinitialspace=True))
        if len(row) < 8:
            continue
        if not row[0][0].isdigit():
            continue

        epoch = _parse_horizons_epoch(row[1])
        samples[epoch] = {
            "positionKm": [float(row[2]), float(row[3]), float(row[4])],
            "velocityKmPerSec": [float(row[5]), float(row[6]), float(row[7])],
        }

    if not samples:
        raise ValueError("No Horizons vector samples were parsed from the export")
    return samples


def infer_body_id_from_horizons_text(contents: str) -> str:
    for line in contents.splitlines():
        if "Target body name:" not in line:
            continue
        name_part = line.split(":", 1)[1].strip()
        canonical_name = name_part.split("(")[0].strip().lower()
        if canonical_name in BODY_NAME_ALIASES:
            return BODY_NAME_ALIASES[canonical_name]
    raise ValueError("Unable to infer body id from Horizons export header")


def build_horizons_dataset(
    *,
    inputs: Mapping[str, Path],
    output_path: Path,
    source_name: str = "jpl-horizons-import",
) -> None:
    dataset = {
        "metadata": {
            "source": source_name,
        },
        "bodies": {},
    }

    for body_id, path in inputs.items():
        contents = Path(path).read_text()
        dataset["bodies"][body_id] = {
            "muKm3PerS2": SOLAR_SYSTEM_MU_KM3_PER_S2[body_id],
            "samples": parse_horizons_vector_csv(contents),
        }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, indent=2))


def resolve_input_map(input_args: Iterable[str]) -> Dict[str, Path]:
    resolved_inputs: Dict[str, Path] = {}
    for input_arg in input_args:
        if "=" in input_arg:
            body_id, raw_path = input_arg.split("=", 1)
            resolved_inputs[body_id] = Path(raw_path).expanduser()
            continue

        path = Path(input_arg).expanduser()
        body_id = infer_body_id_from_horizons_text(path.read_text())
        resolved_inputs[body_id] = path
    return resolved_inputs


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert JPL Horizons VECTORS CSV exports into the simulator ephemeris JSON format."
    )
    parser.add_argument(
        "--input",
        action="append",
        default=[],
        metavar="BODY=PATH",
        help="Body id and Horizons export path, for example earth=./earth.csv",
    )
    parser.add_argument("--output", required=True, help="Path to the output ephemeris JSON file")
    parser.add_argument(
        "--source-name",
        default="jpl-horizons-import",
        help="Metadata source label written into the output file",
    )
    args = parser.parse_args()

    if not args.input:
        raise SystemExit("At least one --input BODY=PATH entry is required")

    build_horizons_dataset(
        inputs=resolve_input_map(args.input),
        output_path=Path(args.output).expanduser(),
        source_name=args.source_name,
    )


def _parse_horizons_epoch(value: str) -> str:
    parsed = datetime.strptime(value.strip(), "A.D. %Y-%b-%d %H:%M:%S.%f")
    return parsed.replace(tzinfo=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


if __name__ == "__main__":
    main()
