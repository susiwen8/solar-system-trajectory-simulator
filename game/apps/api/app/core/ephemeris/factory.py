import os
from pathlib import Path
from typing import Optional

from app.core.ephemeris.bundled import BundledEphemeris
from app.core.ephemeris.composite import CompositeEphemeris
from app.core.ephemeris.horizons_client import HorizonsApiClient
from app.core.ephemeris.jpl import JPLFileEphemeris
from app.core.ephemeris.online import OnlineCachedEphemeris


def create_ephemeris(bundle_path: Path, jpl_path: Optional[Path] = None):
    resolved_jpl_path = jpl_path or _configured_jpl_path()
    bundled = BundledEphemeris(bundle_path)
    fallback = bundled
    if resolved_jpl_path is not None and resolved_jpl_path.exists():
        fallback = CompositeEphemeris(JPLFileEphemeris(resolved_jpl_path), bundled)

    if not _online_enabled():
        return fallback

    try:
        online = OnlineCachedEphemeris(
            cache_root=_configured_cache_dir(bundle_path),
            client=_build_online_client(),
        )
    except Exception:
        return fallback
    return CompositeEphemeris(online, fallback)


def _configured_jpl_path() -> Optional[Path]:
    configured = os.getenv("SOLAR_SYSTEM_JPL_EPHEMERIS_PATH")
    return Path(configured).expanduser() if configured else None


def _configured_cache_dir(bundle_path: Path) -> Path:
    configured = os.getenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR")
    if configured:
        return Path(configured).expanduser()
    return bundle_path.parent / "cache"


def _online_enabled() -> bool:
    return os.getenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "").strip().lower() in {"1", "true", "yes", "on"}


def _build_online_client() -> HorizonsApiClient:
    return HorizonsApiClient()
