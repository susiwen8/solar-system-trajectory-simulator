from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np


@dataclass(frozen=True)
class StateDeviation:
    position_deviation_km: float
    velocity_deviation_km_per_s: float


def compute_state_deviation(
    *,
    nominal_state: Sequence[float],
    actual_state: Sequence[float],
) -> StateDeviation:
    nominal = np.array(nominal_state, dtype=float)
    actual = np.array(actual_state, dtype=float)
    if nominal.shape[0] < 6 or actual.shape[0] < 6:
        raise ValueError("state vectors must contain six components")

    position_deviation_km = float(np.linalg.norm(actual[:3] - nominal[:3]))
    velocity_deviation_km_per_s = float(np.linalg.norm(actual[3:6] - nominal[3:6]))
    return StateDeviation(
        position_deviation_km=position_deviation_km,
        velocity_deviation_km_per_s=velocity_deviation_km_per_s,
    )


def summarize_predicted_miss(
    *,
    sample_positions_km: Sequence[Sequence[float]],
    body_positions_km: Sequence[Sequence[float]],
) -> float:
    if not sample_positions_km or not body_positions_km:
        return float("inf")

    sample_vectors = np.array(sample_positions_km, dtype=float)
    body_vectors = np.array(body_positions_km, dtype=float)
    sample_count = min(len(sample_vectors), len(body_vectors))
    if sample_count == 0:
        return float("inf")

    miss_distances = np.linalg.norm(sample_vectors[:sample_count] - body_vectors[:sample_count], axis=1)
    return float(np.min(miss_distances))


def classify_breach_reason(
    *,
    predicted_miss_km: float,
    predicted_miss_threshold_km: float,
    position_deviation_km: float,
    position_threshold_km: float,
    velocity_deviation_km_per_s: float,
    velocity_threshold_km_per_s: float,
) -> Optional[str]:
    predicted_miss_breach = predicted_miss_km > predicted_miss_threshold_km
    state_breach = (
        position_deviation_km > position_threshold_km
        or velocity_deviation_km_per_s > velocity_threshold_km_per_s
    )
    if predicted_miss_breach and state_breach:
        return "both"
    if predicted_miss_breach:
        return "predictedMiss"
    if state_breach:
        return "stateDeviation"
    return None
