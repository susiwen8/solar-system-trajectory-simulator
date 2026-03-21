from dataclasses import dataclass

import numpy as np

from app.astrodynamics.vector_math import safe_norm


@dataclass(frozen=True)
class FlybyResult:
    status: str
    required_turn_angle_deg: float
    max_turn_angle_deg: float


def classify_flyby(
    incoming_vinf_km_s: np.ndarray,
    outgoing_vinf_km_s: np.ndarray,
    mu_km3_s2: float,
    body_radius_km: float,
    min_altitude_km: float,
) -> FlybyResult:
    incoming_norm = safe_norm(incoming_vinf_km_s)
    outgoing_norm = safe_norm(outgoing_vinf_km_s)
    cosine = np.clip(
        np.dot(incoming_vinf_km_s, outgoing_vinf_km_s) / (incoming_norm * outgoing_norm),
        -1.0,
        1.0,
    )
    required_turn_angle_deg = float(np.degrees(np.arccos(cosine)))

    periapsis_km = body_radius_km + min_altitude_km
    representative_vinf = (incoming_norm + outgoing_norm) / 2.0
    max_turn_angle_rad = 2.0 * np.arcsin(
        1.0 / (1.0 + (periapsis_km * representative_vinf**2) / mu_km3_s2)
    )
    max_turn_angle_deg = float(np.degrees(max_turn_angle_rad))

    if required_turn_angle_deg > max_turn_angle_deg:
        status = "infeasible"
    elif required_turn_angle_deg > max_turn_angle_deg * 0.9:
        status = "near limit"
    else:
        status = "feasible"

    return FlybyResult(
        status=status,
        required_turn_angle_deg=required_turn_angle_deg,
        max_turn_angle_deg=max_turn_angle_deg,
    )
