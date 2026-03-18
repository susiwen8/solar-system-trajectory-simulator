import json
from pathlib import Path
from typing import Union

from app.core.ephemeris.base import BodyState


class BundledEphemeris:
    def __init__(self, data_path: Union[str, Path]) -> None:
        self.data_path = Path(data_path)
        self._dataset = json.loads(self.data_path.read_text())

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        body_record = self._dataset["bodies"][body_id]
        sample = body_record["samples"][epoch]
        return BodyState(
            body_id=body_id,
            epoch=epoch,
            position_km=tuple(sample["positionKm"]),
            velocity_km_per_s=tuple(sample["velocityKmPerSec"]),
            mu_km3_per_s2=body_record["muKm3PerS2"],
        )
