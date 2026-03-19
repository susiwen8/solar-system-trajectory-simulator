import os
from pathlib import Path
from typing import Optional

from app.core.ephemeris.bundled import BundledEphemeris
from app.core.ephemeris.composite import CompositeEphemeris
from app.core.ephemeris.jpl import JPLFileEphemeris


def create_ephemeris(bundle_path: Path, jpl_path: Optional[Path] = None):
    resolved_jpl_path = jpl_path or _configured_jpl_path()
    bundled = BundledEphemeris(bundle_path)
    if resolved_jpl_path is None or not resolved_jpl_path.exists():
        return bundled
    return CompositeEphemeris(JPLFileEphemeris(resolved_jpl_path), bundled)


def _configured_jpl_path() -> Optional[Path]:
    configured = os.getenv("SOLAR_SYSTEM_JPL_EPHEMERIS_PATH")
    return Path(configured).expanduser() if configured else None
