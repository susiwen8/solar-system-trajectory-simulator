from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TrajectorySettings:
    cache_dir: Path = Path(".cache/ephemeris")
    horizons_base_url: str = "https://ssd-api.jpl.nasa.gov/horizons.api"

