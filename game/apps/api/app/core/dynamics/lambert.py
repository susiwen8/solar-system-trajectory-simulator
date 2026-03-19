from dataclasses import dataclass
from math import acos, cos, cosh, pi, sin, sinh, sqrt
from typing import Optional

import numpy as np
from scipy.optimize import brentq


@dataclass(frozen=True)
class LambertSolution:
    departure_velocity_km_per_s: np.ndarray
    arrival_velocity_km_per_s: np.ndarray


def solve_lambert_transfer(
    *,
    departure_position_km: np.ndarray,
    arrival_position_km: np.ndarray,
    time_of_flight_seconds: float,
    mu_km3_per_s2: float,
    prograde: bool = True,
) -> LambertSolution:
    r1_vec = np.array(departure_position_km, dtype=float)
    r2_vec = np.array(arrival_position_km, dtype=float)
    r1 = float(np.linalg.norm(r1_vec))
    r2 = float(np.linalg.norm(r2_vec))
    if r1 <= 0.0 or r2 <= 0.0:
        raise ValueError("Lambert solver requires non-zero endpoint radii")

    cos_delta_theta = float(np.clip(np.dot(r1_vec, r2_vec) / (r1 * r2), -1.0, 1.0))
    delta_theta = acos(cos_delta_theta)
    cross_product = np.cross(r1_vec, r2_vec)
    if prograde:
        if cross_product[2] < 0.0:
            delta_theta = 2.0 * pi - delta_theta
    elif cross_product[2] >= 0.0:
        delta_theta = 2.0 * pi - delta_theta

    sin_delta_theta = sin(delta_theta)
    denominator = 1.0 - cos_delta_theta
    if abs(denominator) < 1e-12:
        raise ValueError("Lambert solver cannot handle collinear endpoints")

    transfer_parameter = sin_delta_theta * sqrt(r1 * r2 / denominator)
    if abs(transfer_parameter) < 1e-12:
        raise ValueError("Lambert transfer parameter collapsed to zero")

    z_value = _solve_universal_anomaly(
        transfer_parameter=transfer_parameter,
        departure_radius_km=r1,
        arrival_radius_km=r2,
        time_of_flight_seconds=time_of_flight_seconds,
        mu_km3_per_s2=mu_km3_per_s2,
    )
    y_value = _y_value(z_value, r1, r2, transfer_parameter)
    lagrange_g = transfer_parameter * sqrt(y_value / mu_km3_per_s2)
    if abs(lagrange_g) < 1e-12:
        raise ValueError("Lambert solver produced a singular g term")

    lagrange_f = 1.0 - y_value / r1
    lagrange_g_dot = 1.0 - y_value / r2
    departure_velocity = (r2_vec - lagrange_f * r1_vec) / lagrange_g
    arrival_velocity = (lagrange_g_dot * r2_vec - r1_vec) / lagrange_g

    return LambertSolution(
        departure_velocity_km_per_s=departure_velocity,
        arrival_velocity_km_per_s=arrival_velocity,
    )


def _solve_universal_anomaly(
    *,
    transfer_parameter: float,
    departure_radius_km: float,
    arrival_radius_km: float,
    time_of_flight_seconds: float,
    mu_km3_per_s2: float,
) -> float:
    search_limit = 4.0 * pi * pi
    previous_point: Optional[tuple[float, float]] = None

    for _ in range(8):
        for z_value in np.linspace(-search_limit, search_limit, 240):
            error = _time_of_flight_error(
                z_value=z_value,
                transfer_parameter=transfer_parameter,
                departure_radius_km=departure_radius_km,
                arrival_radius_km=arrival_radius_km,
                time_of_flight_seconds=time_of_flight_seconds,
                mu_km3_per_s2=mu_km3_per_s2,
            )
            if error is None:
                continue
            if abs(error) < 1e-6:
                return float(z_value)
            if previous_point is not None:
                previous_z, previous_error = previous_point
                if previous_error * error < 0.0:
                    return float(
                        brentq(
                            lambda candidate: _time_of_flight_error(
                                z_value=candidate,
                                transfer_parameter=transfer_parameter,
                                departure_radius_km=departure_radius_km,
                                arrival_radius_km=arrival_radius_km,
                                time_of_flight_seconds=time_of_flight_seconds,
                                mu_km3_per_s2=mu_km3_per_s2,
                            )
                            or 0.0,
                            previous_z,
                            z_value,
                            xtol=1e-10,
                            rtol=1e-10,
                            maxiter=200,
                        )
                    )
            previous_point = (float(z_value), float(error))
        search_limit *= 2.0

    raise ValueError("Lambert solver could not bracket a zero-revolution transfer")


def _time_of_flight_error(
    *,
    z_value: float,
    transfer_parameter: float,
    departure_radius_km: float,
    arrival_radius_km: float,
    time_of_flight_seconds: float,
    mu_km3_per_s2: float,
) -> Optional[float]:
    computed_time = _time_of_flight_seconds(
        z_value=z_value,
        transfer_parameter=transfer_parameter,
        departure_radius_km=departure_radius_km,
        arrival_radius_km=arrival_radius_km,
        mu_km3_per_s2=mu_km3_per_s2,
    )
    if computed_time is None:
        return None
    return computed_time - time_of_flight_seconds


def _time_of_flight_seconds(
    *,
    z_value: float,
    transfer_parameter: float,
    departure_radius_km: float,
    arrival_radius_km: float,
    mu_km3_per_s2: float,
) -> Optional[float]:
    stumpff_c = _stumpff_c(z_value)
    if stumpff_c <= 0.0:
        return None
    y_value = _y_value(z_value, departure_radius_km, arrival_radius_km, transfer_parameter)
    if y_value <= 0.0:
        return None
    stumpff_s = _stumpff_s(z_value)
    x_value = sqrt(y_value / stumpff_c)
    return (x_value**3 * stumpff_s + transfer_parameter * sqrt(y_value)) / sqrt(mu_km3_per_s2)


def _y_value(
    z_value: float,
    departure_radius_km: float,
    arrival_radius_km: float,
    transfer_parameter: float,
) -> float:
    stumpff_c = _stumpff_c(z_value)
    stumpff_s = _stumpff_s(z_value)
    if stumpff_c <= 0.0:
        return -1.0
    return departure_radius_km + arrival_radius_km + transfer_parameter * (
        (z_value * stumpff_s - 1.0) / sqrt(stumpff_c)
    )


def _stumpff_c(z_value: float) -> float:
    if z_value > 1e-8:
        root = sqrt(z_value)
        return (1.0 - cos(root)) / z_value
    if z_value < -1e-8:
        root = sqrt(-z_value)
        return (cosh(root) - 1.0) / (-z_value)
    return 0.5


def _stumpff_s(z_value: float) -> float:
    if z_value > 1e-8:
        root = sqrt(z_value)
        return (root - sin(root)) / (root**3)
    if z_value < -1e-8:
        root = sqrt(-z_value)
        return (sinh(root) - root) / (root**3)
    return 1.0 / 6.0
