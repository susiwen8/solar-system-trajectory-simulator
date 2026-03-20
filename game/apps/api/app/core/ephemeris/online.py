from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.constants import SOLAR_SYSTEM_MU_KM3_PER_S2
from app.core.ephemeris.base import BodyState, MAJOR_BODY_IDS
from app.core.ephemeris.cache_store import EphemerisCacheStore
from app.core.ephemeris.horizons_client import BODY_COMMAND_IDS
from app.core.ephemeris.jpl import JPLFileEphemeris


class OnlineCachedEphemeris:
    def __init__(self, *, cache_root: Path, client: Any) -> None:
        self.cache_store = EphemerisCacheStore(cache_root)
        self.client = client

    @property
    def source_name(self) -> str:
        return "jpl-horizons-online-cache"

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        if body_id not in BODY_COMMAND_IDS:
            raise KeyError(body_id)

        path = self.cache_store.body_path(body_id)
        try:
            return self._read_cached_state(path, body_id, epoch)
        except KeyError:
            pass

        try:
            samples = self.client.fetch_vectors(
                body_id=body_id,
                start_epoch=_offset_epoch_hours(epoch, -24),
                stop_epoch=_offset_epoch_hours(epoch, 24),
                step_size="12h",
            )
        except Exception as error:
            raise KeyError(f"Unable to resolve {body_id} at {epoch} from online cache") from error

        self.cache_store.write_body_samples(
            body_id=body_id,
            mu_km3_per_s2=SOLAR_SYSTEM_MU_KM3_PER_S2[body_id],
            source_name=self.source_name,
            samples=samples,
        )
        return self._read_cached_state(path, body_id, epoch)

    def get_all_body_states(self, epoch: str) -> list[BodyState]:
        return [self.get_body_state(body_id, epoch) for body_id in MAJOR_BODY_IDS]

    def _read_cached_state(self, path: Path, body_id: str, epoch: str) -> BodyState:
        if not path.exists():
            raise KeyError(body_id)
        return JPLFileEphemeris(path).get_body_state(body_id, epoch)


def _offset_epoch_hours(epoch: str, hours: int) -> str:
    instant = datetime.fromisoformat(epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = instant + timedelta(hours=hours)
    return shifted.isoformat(timespec="seconds").replace("+00:00", "Z")
