from dataclasses import dataclass
from typing import Tuple

import numpy as np


STANDARD_GRAVITY_M_PER_S2 = 9.80665


@dataclass(frozen=True)
class BurnSegment:
    burn_type: str
    start_epoch_seconds: float
    duration_seconds: float
    thrust_newtons: float
    isp_seconds: float
    direction: Tuple[float, float, float]
    direction_label: str

    @property
    def end_epoch_seconds(self) -> float:
        return self.start_epoch_seconds + self.duration_seconds


def normalize_direction(direction: Tuple[float, float, float]) -> np.ndarray:
    vector = np.array(direction, dtype=float)
    magnitude = float(np.linalg.norm(vector))
    if magnitude <= 0:
        raise ValueError("direction must be non-zero")
    return vector / magnitude


def thrust_acceleration_km_per_s2(
    thrust_newtons: float,
    mass_kg: float,
    direction: Tuple[float, float, float],
) -> Tuple[float, float, float]:
    if mass_kg <= 0:
        raise ValueError("mass_kg must be positive")

    direction_unit = normalize_direction(direction)
    acceleration_m_per_s2 = thrust_newtons / mass_kg
    acceleration_km_per_s2 = acceleration_m_per_s2 / 1000.0
    acceleration = direction_unit * acceleration_km_per_s2
    return (float(acceleration[0]), float(acceleration[1]), float(acceleration[2]))


def burn_mass_flow_kg_per_s(thrust_newtons: float, isp_seconds: float) -> float:
    if thrust_newtons <= 0:
        raise ValueError("thrust_newtons must be positive")
    if isp_seconds <= 0:
        raise ValueError("isp_seconds must be positive")
    return thrust_newtons / (STANDARD_GRAVITY_M_PER_S2 * isp_seconds)


def is_burn_active(segment: BurnSegment, epoch_seconds: float) -> bool:
    return segment.start_epoch_seconds <= epoch_seconds <= segment.end_epoch_seconds
