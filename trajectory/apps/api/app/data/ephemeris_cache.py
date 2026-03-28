import json
from pathlib import Path


class EphemerisCache:
    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def load(self, cache_key: str) -> list[dict] | None:
        cache_path = self.cache_dir / f"{cache_key}.json"
        if not cache_path.exists():
            return None

        return json.loads(cache_path.read_text())

    def save(self, cache_key: str, records: list[dict]) -> None:
        cache_path = self.cache_dir / f"{cache_key}.json"
        cache_path.write_text(json.dumps(records))

