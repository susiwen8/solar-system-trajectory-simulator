from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass(frozen=True)
class DispersionResult:
    state_vector: np.ndarray
    position_offset_km: np.ndarray
    velocity_offset_km_per_s: np.ndarray
    seed_used: Optional[int]


def apply_navigation_dispersion(
    nominal_state: np.ndarray,
    *,
    position_sigma_km: float,
    velocity_sigma_km_per_s: float,
    seed: Optional[int],
) -> DispersionResult:
    nominal = np.array(nominal_state, dtype=float, copy=True)
    if nominal.shape[0] < 6:
        raise ValueError("nominal_state must contain position and velocity components")

    rng = np.random.default_rng(seed)
    position_offset_km = rng.normal(loc=0.0, scale=position_sigma_km, size=3)
    velocity_offset_km_per_s = rng.normal(loc=0.0, scale=velocity_sigma_km_per_s, size=3)
    dispersed_state = nominal.copy()
    dispersed_state[:3] += position_offset_km
    dispersed_state[3:6] += velocity_offset_km_per_s

    return DispersionResult(
        state_vector=dispersed_state,
        position_offset_km=position_offset_km,
        velocity_offset_km_per_s=velocity_offset_km_per_s,
        seed_used=seed,
    )
