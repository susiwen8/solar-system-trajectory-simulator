import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Union

from app.core.ephemeris.base import BodyState, MAJOR_BODY_IDS


class JPLFileEphemeris:
    def __init__(self, data_path: Union[str, Path]) -> None:
        self.data_path = Path(data_path)
        self._dataset = json.loads(self.data_path.read_text())
        self._sample_times = self._build_sample_times()

    @property
    def source_name(self) -> str:
        return str(self._dataset.get("metadata", {}).get("source", "jpl-horizons-file"))

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        if body_id not in self._dataset["bodies"]:
            raise KeyError(body_id)

        body_record = self._dataset["bodies"][body_id]
        sample = self._interpolate_sample(body_id, _parse_epoch(epoch))
        return BodyState(
            body_id=body_id,
            epoch=epoch,
            position_km=tuple(sample["positionKm"]),
            velocity_km_per_s=tuple(sample["velocityKmPerSec"]),
            mu_km3_per_s2=body_record["muKm3PerS2"],
            source_name=self.source_name,
        )

    def get_all_body_states(self, epoch: str) -> list[BodyState]:
        return [
            self.get_body_state(body_id, epoch)
            for body_id in MAJOR_BODY_IDS
            if body_id in self._dataset["bodies"]
        ]

    def _build_sample_times(self) -> Dict[str, List[Tuple[datetime, str]]]:
        sample_times: Dict[str, List[Tuple[datetime, str]]] = {}
        for body_id, body_record in self._dataset["bodies"].items():
            sample_times[body_id] = sorted(
                (_parse_epoch(sample_epoch), sample_epoch) for sample_epoch in body_record["samples"]
            )
        return sample_times

    def _interpolate_sample(self, body_id: str, requested_time: datetime) -> Dict[str, List[float]]:
        body_record = self._dataset["bodies"][body_id]
        samples = body_record["samples"]
        sample_times = self._sample_times[body_id]

        for sample_time, sample_epoch in sample_times:
            if sample_time == requested_time:
                return samples[sample_epoch]

        if requested_time < sample_times[0][0] or requested_time > sample_times[-1][0]:
            raise KeyError(f"Epoch {requested_time.isoformat()} is outside JPL ephemeris range for {body_id}")

        for index in range(1, len(sample_times)):
            previous_time, previous_epoch = sample_times[index - 1]
            next_time, next_epoch = sample_times[index]
            if previous_time <= requested_time <= next_time:
                interval_seconds = (next_time - previous_time).total_seconds()
                ratio = (requested_time - previous_time).total_seconds() / interval_seconds
                previous_sample = samples[previous_epoch]
                next_sample = samples[next_epoch]
                return {
                    "positionKm": _interpolate_vector(previous_sample["positionKm"], next_sample["positionKm"], ratio),
                    "velocityKmPerSec": _interpolate_vector(
                        previous_sample["velocityKmPerSec"],
                        next_sample["velocityKmPerSec"],
                        ratio,
                    ),
                }

        raise KeyError(f"Unable to interpolate epoch {requested_time.isoformat()} for {body_id}")


def _parse_epoch(epoch: str) -> datetime:
    return datetime.fromisoformat(epoch.replace("Z", "+00:00")).astimezone(timezone.utc)


def _interpolate_vector(start: List[float], end: List[float], ratio: float) -> List[float]:
    return [start[index] + (end[index] - start[index]) * ratio for index in range(3)]
