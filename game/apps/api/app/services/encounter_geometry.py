from dataclasses import dataclass
from math import sqrt
from typing import Literal, Tuple

import numpy as np

from app.core.constants import PLANETARY_BODY_RADII_KM, SOLAR_SYSTEM_MU_KM3_PER_S2

EncounterType = Literal["flyby", "capture"]

SOLAR_MU_KM3_PER_S2 = SOLAR_SYSTEM_MU_KM3_PER_S2["sun"]


@dataclass(frozen=True)
class EncounterGeometry:
    body_id: str
    encounter_epoch: str
    encounter_type: EncounterType
    reference_frame: str
    body_relative_position_km: Tuple[float, float, float]
    body_relative_velocity_km_per_s: Tuple[float, float, float]
    incoming_v_infinity_km_per_s: float
    periapsis_radius_km: float
    periapsis_altitude_km: float
    sphere_of_influence_radius_km: float


def build_encounter_geometry(
    *,
    body_id: str,
    encounter_epoch: str,
    body_position_km: Tuple[float, float, float],
    body_velocity_km_per_s: Tuple[float, float, float],
    probe_position_km: Tuple[float, float, float],
    probe_velocity_km_per_s: Tuple[float, float, float],
    periapsis_altitude_km: float,
    encounter_type: EncounterType = "flyby",
) -> EncounterGeometry:
    body_position = np.array(body_position_km, dtype=float)
    body_velocity = np.array(body_velocity_km_per_s, dtype=float)
    probe_position = np.array(probe_position_km, dtype=float)
    probe_velocity = np.array(probe_velocity_km_per_s, dtype=float)

    relative_position = probe_position - body_position
    relative_velocity = probe_velocity - body_velocity
    incoming_v_infinity_km_per_s = float(np.linalg.norm(relative_velocity))
    body_radius_km = PLANETARY_BODY_RADII_KM[body_id]
    periapsis_radius_km = body_radius_km + float(periapsis_altitude_km)
    heliocentric_radius_km = max(float(np.linalg.norm(body_position)), periapsis_radius_km)
    sphere_of_influence_radius_km = heliocentric_radius_km * (
        SOLAR_SYSTEM_MU_KM3_PER_S2[body_id] / SOLAR_MU_KM3_PER_S2
    ) ** (2.0 / 5.0)

    return EncounterGeometry(
        body_id=body_id,
        encounter_epoch=encounter_epoch,
        encounter_type=encounter_type,
        reference_frame=f"{body_id}-centered-inertial",
        body_relative_position_km=to_tuple(relative_position),
        body_relative_velocity_km_per_s=to_tuple(relative_velocity),
        incoming_v_infinity_km_per_s=incoming_v_infinity_km_per_s,
        periapsis_radius_km=periapsis_radius_km,
        periapsis_altitude_km=float(periapsis_altitude_km),
        sphere_of_influence_radius_km=max(sphere_of_influence_radius_km, periapsis_radius_km + sqrt(periapsis_radius_km)),
    )


def to_tuple(vector: np.ndarray) -> Tuple[float, float, float]:
    return (float(vector[0]), float(vector[1]), float(vector[2]))
