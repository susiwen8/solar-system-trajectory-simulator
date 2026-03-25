from dataclasses import dataclass
from pathlib import Path

from app.data.ephemeris_cache import EphemerisCache


@dataclass(frozen=True)
class EphemerisResult:
    records: list[dict]
    source: str


class EphemerisService:
    def __init__(self, cache_dir: Path, client) -> None:
        self.client = client
        self.cache = EphemerisCache(cache_dir)

    def get_vectors(
        self,
        body_id: str,
        start_time: str,
        stop_time: str,
        step_size: str,
    ) -> EphemerisResult:
        cache_key = self._build_cache_key(body_id, start_time, stop_time, step_size)
        cached_records = self.cache.load(cache_key)
        if cached_records is not None:
            return EphemerisResult(records=cached_records, source="cache")

        try:
            records = self.client.fetch_vectors(body_id, start_time, stop_time, step_size)
        except Exception:
            fallback_records = self.cache.load(cache_key)
            if fallback_records is not None:
                return EphemerisResult(records=fallback_records, source="cache")
            raise

        self.cache.save(cache_key, records)
        return EphemerisResult(records=records, source="remote")

    @staticmethod
    def _build_cache_key(
        body_id: str,
        start_time: str,
        stop_time: str,
        step_size: str,
    ) -> str:
        key = f"{body_id}-{start_time}-{stop_time}-{step_size}"
        return "".join(character if character.isalnum() else "_" for character in key)
