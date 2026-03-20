import json
from pathlib import Path


class EphemerisCacheStore:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def read_body_dataset(self, body_id: str) -> dict:
        path = self._body_path(body_id)
        if not path.exists():
            raise KeyError(body_id)
        return json.loads(path.read_text())

    def write_body_samples(
        self,
        *,
        body_id: str,
        mu_km3_per_s2: float,
        source_name: str,
        samples: dict[str, dict[str, list[float]]],
    ) -> None:
        existing_samples: dict[str, dict[str, list[float]]] = {}
        path = self._body_path(body_id)
        if path.exists():
            existing_samples = self.read_body_dataset(body_id)["samples"]

        merged_samples = dict(sorted((existing_samples | samples).items()))
        dataset = {
            "metadata": {
                "source": source_name,
            },
            "body": body_id,
            "muKm3PerS2": mu_km3_per_s2,
            "samples": merged_samples,
        }

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(dataset, indent=2))

    def _body_path(self, body_id: str) -> Path:
        return self.root / f"{body_id}.json"
