from math import atan2, cos, pi, radians, sin, sqrt
from typing import Dict, Tuple

from app.core.constants import SOLAR_SYSTEM_MU_KM3_PER_S2
from app.core.ephemeris.base import BodyState
from app.core.units import julian_centuries_since_j2000

AU_IN_KM = 149_597_870.7

PLANETARY_ELEMENTS = {
    "mercury": {
        "a": (0.38709927, 0.00000037),
        "e": (0.20563593, 0.00001906),
        "i_deg": (7.00497902, -0.00594749),
        "L_deg": (252.25032350, 149_472.67411175),
        "peri_deg": (77.45779628, 0.16047689),
        "node_deg": (48.33076593, -0.12534081),
    },
    "venus": {
        "a": (0.72333566, 0.00000390),
        "e": (0.00677672, -0.00004107),
        "i_deg": (3.39467605, -0.00078890),
        "L_deg": (181.97909950, 58_517.81538729),
        "peri_deg": (131.60246718, 0.00268329),
        "node_deg": (76.67984255, -0.27769418),
    },
    "earth": {
        "a": (1.00000261, 0.00000562),
        "e": (0.01671123, -0.00004392),
        "i_deg": (-0.00001531, -0.01294668),
        "L_deg": (100.46457166, 35_999.37244981),
        "peri_deg": (102.93768193, 0.32327364),
        "node_deg": (0.0, 0.0),
    },
    "mars": {
        "a": (1.52371034, 0.00001847),
        "e": (0.09339410, 0.00007882),
        "i_deg": (1.84969142, -0.00813131),
        "L_deg": (-4.55343205, 19_140.30268499),
        "peri_deg": (-23.94362959, 0.44441088),
        "node_deg": (49.55953891, -0.29257343),
    },
    "jupiter": {
        "a": (5.20288700, -0.00011607),
        "e": (0.04838624, -0.00013253),
        "i_deg": (1.30439695, -0.00183714),
        "L_deg": (34.39644051, 3_034.74612775),
        "peri_deg": (14.72847983, 0.21252668),
        "node_deg": (100.47390909, 0.20469106),
    },
    "saturn": {
        "a": (9.53667594, -0.00125060),
        "e": (0.05386179, -0.00050991),
        "i_deg": (2.48599187, 0.00193609),
        "L_deg": (49.95424423, 1_222.49362201),
        "peri_deg": (92.59887831, -0.41897216),
        "node_deg": (113.66242448, -0.28867794),
    },
    "uranus": {
        "a": (19.18916464, -0.00196176),
        "e": (0.04725744, -0.00004397),
        "i_deg": (0.77263783, -0.00242939),
        "L_deg": (313.23810451, 428.48202785),
        "peri_deg": (170.95427630, 0.40805281),
        "node_deg": (74.01692503, 0.04240589),
    },
    "neptune": {
        "a": (30.06992276, 0.00026291),
        "e": (0.00859048, 0.00005105),
        "i_deg": (1.77004347, 0.00035372),
        "L_deg": (-55.12002969, 218.45945325),
        "peri_deg": (44.96476227, -0.32241464),
        "node_deg": (131.78422574, -0.00508664),
    },
}


def keplerian_body_state(body_id: str, epoch: str) -> BodyState:
    if body_id == "sun":
        return BodyState(
            body_id="sun",
            epoch=epoch,
            position_km=(0.0, 0.0, 0.0),
            velocity_km_per_s=(0.0, 0.0, 0.0),
            mu_km3_per_s2=SOLAR_SYSTEM_MU_KM3_PER_S2["sun"],
            source_name="keplerian-elements",
        )

    elements = PLANETARY_ELEMENTS[body_id]
    position_au = _position_au(elements, epoch)
    velocity_au_per_day = _velocity_au_per_day(elements, epoch)
    return BodyState(
        body_id=body_id,
        epoch=epoch,
        position_km=tuple(component * AU_IN_KM for component in position_au),
        velocity_km_per_s=tuple(component * AU_IN_KM / 86_400.0 for component in velocity_au_per_day),
        mu_km3_per_s2=SOLAR_SYSTEM_MU_KM3_PER_S2[body_id],
        source_name="keplerian-elements",
    )


def _position_au(elements: Dict[str, Tuple[float, float]], epoch: str) -> Tuple[float, float, float]:
    T = julian_centuries_since_j2000(epoch)
    a = _element_value(elements["a"], T)
    e = _element_value(elements["e"], T)
    inclination = radians(_normalize_angle(_element_value(elements["i_deg"], T)))
    mean_longitude = _normalize_angle(_element_value(elements["L_deg"], T))
    longitude_of_perihelion = _normalize_angle(_element_value(elements["peri_deg"], T))
    ascending_node = _normalize_angle(_element_value(elements["node_deg"], T))
    argument_of_perihelion = _normalize_angle(longitude_of_perihelion - ascending_node)
    mean_anomaly = _normalize_angle(mean_longitude - longitude_of_perihelion)
    eccentric_anomaly = _solve_kepler(radians(mean_anomaly), e)

    x_prime = a * (cos(eccentric_anomaly) - e)
    y_prime = a * sqrt(1.0 - e * e) * sin(eccentric_anomaly)

    omega = radians(argument_of_perihelion)
    node = radians(ascending_node)
    cos_i = cos(inclination)
    sin_i = sin(inclination)
    cos_node = cos(node)
    sin_node = sin(node)
    cos_omega = cos(omega)
    sin_omega = sin(omega)

    x_ecl = (cos_omega * cos_node - sin_omega * sin_node * cos_i) * x_prime + (
        -sin_omega * cos_node - cos_omega * sin_node * cos_i
    ) * y_prime
    y_ecl = (cos_omega * sin_node + sin_omega * cos_node * cos_i) * x_prime + (
        -sin_omega * sin_node + cos_omega * cos_node * cos_i
    ) * y_prime
    z_ecl = (sin_omega * sin_i) * x_prime + (cos_omega * sin_i) * y_prime

    return (x_ecl, y_ecl, z_ecl)


def _velocity_au_per_day(elements: Dict[str, Tuple[float, float]], epoch: str) -> Tuple[float, float, float]:
    delta_days = 0.0005
    before = _position_au(elements, _offset_epoch_days(epoch, -delta_days))
    after = _position_au(elements, _offset_epoch_days(epoch, delta_days))
    return tuple((after[index] - before[index]) / (2.0 * delta_days) for index in range(3))


def _offset_epoch_days(epoch: str, delta_days: float) -> str:
    from datetime import datetime, timedelta, timezone

    instant = datetime.fromisoformat(epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = instant + timedelta(days=delta_days)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _element_value(coefficients: Tuple[float, float], centuries_since_j2000: float) -> float:
    return coefficients[0] + coefficients[1] * centuries_since_j2000


def _normalize_angle(angle_degrees: float) -> float:
    normalized = angle_degrees % 360.0
    if normalized > 180.0:
        normalized -= 360.0
    return normalized


def _solve_kepler(mean_anomaly_radians: float, eccentricity: float) -> float:
    estimate = mean_anomaly_radians
    for _ in range(12):
        delta = (estimate - eccentricity * sin(estimate) - mean_anomaly_radians) / (
            1.0 - eccentricity * cos(estimate)
        )
        estimate -= delta
        if abs(delta) < 1e-12:
            break
    return estimate
