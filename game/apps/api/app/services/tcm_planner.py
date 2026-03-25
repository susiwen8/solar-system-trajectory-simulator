from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from app.core.constants import STANDARD_GRAVITY_M_PER_S2
from app.schemas.mission import PropulsionConfig


@dataclass(frozen=True)
class TcmSolution:
    delta_v_vector_km_per_s: np.ndarray
    delta_v_km_per_s: float


def synthesize_tcm_delta_v(
    *,
    velocity_error_km_per_s: Sequence[float],
    position_error_km: Sequence[float],
    predicted_miss_km: float,
    max_delta_v_km_per_s: float,
) -> TcmSolution:
    velocity_error = np.array(velocity_error_km_per_s, dtype=float)
    position_error = np.array(position_error_km, dtype=float)

    correction = -velocity_error
    position_magnitude = float(np.linalg.norm(position_error))
    if position_magnitude > 0:
        miss_scale = min(max(predicted_miss_km, 0.0) / 1_000_000.0, 1.0)
        correction += -(position_error / position_magnitude) * miss_scale * max_delta_v_km_per_s

    correction_norm = float(np.linalg.norm(correction))
    if correction_norm > max_delta_v_km_per_s > 0:
        correction *= max_delta_v_km_per_s / correction_norm
        correction_norm = max_delta_v_km_per_s

    return TcmSolution(
        delta_v_vector_km_per_s=correction,
        delta_v_km_per_s=correction_norm,
    )


def compute_propellant_used_kg(
    *,
    delta_v_km_per_s: float,
    mass_kg: float,
    propulsion_config: Optional[PropulsionConfig],
) -> Optional[float]:
    if propulsion_config is None:
        return None
    if delta_v_km_per_s <= 0 or mass_kg <= 0:
        return 0.0

    exhaust_velocity_m_per_s = propulsion_config.ispSeconds * STANDARD_GRAVITY_M_PER_S2
    delta_v_m_per_s = delta_v_km_per_s * 1000.0
    final_mass_kg = mass_kg / np.exp(delta_v_m_per_s / exhaust_velocity_m_per_s)
    propellant_used_kg = mass_kg - final_mass_kg
    return float(min(propellant_used_kg, propulsion_config.propellantMassKg))
