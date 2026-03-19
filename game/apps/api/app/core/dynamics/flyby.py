from dataclasses import dataclass
from math import asin, degrees, sin
from typing import Dict

import numpy as np

from app.core.constants import PLANETARY_BODY_RADII_KM, SOLAR_SYSTEM_MU_KM3_PER_S2

SAFETY_ALTITUDE_KM = {
    "mercury": 500.0,
    "venus": 1_000.0,
    "earth": 500.0,
    "mars": 500.0,
    "jupiter": 50_000.0,
    "saturn": 60_000.0,
    "uranus": 25_000.0,
    "neptune": 25_000.0,
}


@dataclass(frozen=True)
class FlybyConstraintResult:
    body_id: str
    feasible: bool
    turn_angle_deg: float
    periapsis_radius_km: float
    periapsis_altitude_km: float
    inbound_v_infinity_km_per_s: float
    outbound_v_infinity_km_per_s: float
    warnings: tuple[str, ...] = ()


def evaluate_unpowered_flyby(
    body_id: str,
    inbound_velocity_km_per_s: np.ndarray,
    outbound_velocity_km_per_s: np.ndarray,
    body_velocity_km_per_s: np.ndarray,
) -> FlybyConstraintResult:
    inbound_v_infinity = np.array(inbound_velocity_km_per_s, dtype=float) - np.array(body_velocity_km_per_s, dtype=float)
    outbound_v_infinity = np.array(outbound_velocity_km_per_s, dtype=float) - np.array(body_velocity_km_per_s, dtype=float)
    inbound_speed = float(np.linalg.norm(inbound_v_infinity))
    outbound_speed = float(np.linalg.norm(outbound_v_infinity))

    warnings = []
    if inbound_speed <= 1e-9 or outbound_speed <= 1e-9:
        return FlybyConstraintResult(
            body_id=body_id,
            feasible=False,
            turn_angle_deg=0.0,
            periapsis_radius_km=float("inf"),
            periapsis_altitude_km=float("inf"),
            inbound_v_infinity_km_per_s=inbound_speed,
            outbound_v_infinity_km_per_s=outbound_speed,
            warnings=("Degenerate flyby excess velocity",),
        )

    speed_mismatch_ratio = abs(inbound_speed - outbound_speed) / max(inbound_speed, outbound_speed)
    if speed_mismatch_ratio > 0.2:
        warnings.append("Unpowered flyby requires matched incoming and outgoing excess speed")

    cosine_turn = float(
        np.clip(np.dot(inbound_v_infinity, outbound_v_infinity) / (inbound_speed * outbound_speed), -1.0, 1.0)
    )
    turn_angle_deg = degrees(np.arccos(cosine_turn))
    turn_angle_rad = np.radians(turn_angle_deg)
    mean_v_infinity_speed = 0.5 * (inbound_speed + outbound_speed)

    if turn_angle_rad <= 1e-9:
        required_periapsis_radius_km = float("inf")
    else:
        sine_half_turn = sin(turn_angle_rad / 2.0)
        if sine_half_turn <= 1e-9:
            required_periapsis_radius_km = float("inf")
        else:
            required_periapsis_radius_km = (
                SOLAR_SYSTEM_MU_KM3_PER_S2[body_id] / (mean_v_infinity_speed**2)
            ) * ((1.0 / sine_half_turn) - 1.0)

    minimum_periapsis_radius_km = PLANETARY_BODY_RADII_KM[body_id] + SAFETY_ALTITUDE_KM.get(body_id, 1_000.0)
    periapsis_altitude_km = required_periapsis_radius_km - PLANETARY_BODY_RADII_KM[body_id]
    feasible = required_periapsis_radius_km >= minimum_periapsis_radius_km

    return FlybyConstraintResult(
        body_id=body_id,
        feasible=feasible,
        turn_angle_deg=turn_angle_deg,
        periapsis_radius_km=required_periapsis_radius_km,
        periapsis_altitude_km=periapsis_altitude_km,
        inbound_v_infinity_km_per_s=inbound_speed,
        outbound_v_infinity_km_per_s=outbound_speed,
        warnings=tuple(warnings),
    )
