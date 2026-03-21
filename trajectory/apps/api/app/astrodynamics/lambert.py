from dataclasses import dataclass

import numpy as np
from scipy.optimize import root_scalar

from app.astrodynamics.vector_math import safe_norm


@dataclass(frozen=True)
class LambertSolution:
    v1_km_s: np.ndarray
    v2_km_s: np.ndarray


def _stumpff_c(z: float) -> float:
    if z > 0:
        sqrt_z = np.sqrt(z)
        return float((1 - np.cos(sqrt_z)) / z)
    if z < 0:
        sqrt_neg_z = np.sqrt(-z)
        return float((np.cosh(sqrt_neg_z) - 1) / (-z))
    return 0.5


def _stumpff_s(z: float) -> float:
    if z > 0:
        sqrt_z = np.sqrt(z)
        return float((sqrt_z - np.sin(sqrt_z)) / (sqrt_z**3))
    if z < 0:
        sqrt_neg_z = np.sqrt(-z)
        return float((np.sinh(sqrt_neg_z) - sqrt_neg_z) / (sqrt_neg_z**3))
    return 1.0 / 6.0


def solve_lambert(
    r1_km: np.ndarray,
    r2_km: np.ndarray,
    time_of_flight_s: float,
    mu_km3_s2: float,
) -> LambertSolution | None:
    r1_norm = safe_norm(r1_km)
    r2_norm = safe_norm(r2_km)
    cos_dtheta = float(np.clip(np.dot(r1_km, r2_km) / (r1_norm * r2_norm), -1.0, 1.0))
    cross_z = float(np.cross(r1_km, r2_km)[2])
    dtheta = float(np.arccos(cos_dtheta))
    if cross_z < 0:
        dtheta = 2 * np.pi - dtheta

    denominator = 1 - cos_dtheta
    if denominator <= 0:
        return None

    a_term = np.sin(dtheta) * np.sqrt(r1_norm * r2_norm / denominator)
    if np.isclose(a_term, 0.0):
        return None

    def y_of(z: float) -> float:
        c_value = _stumpff_c(z)
        s_value = _stumpff_s(z)
        if c_value <= 0:
            return -1.0

        return r1_norm + r2_norm + a_term * ((z * s_value - 1.0) / np.sqrt(c_value))

    def equation(z: float) -> float:
        c_value = _stumpff_c(z)
        y_value = y_of(z)
        if c_value <= 0 or y_value <= 0:
            return np.nan

        s_value = _stumpff_s(z)
        return ((y_value / c_value) ** 1.5) * s_value + a_term * np.sqrt(y_value) - np.sqrt(
            mu_km3_s2
        ) * time_of_flight_s

    bracket = None
    z_values = np.linspace(-4 * np.pi**2, 4 * np.pi**2, 2000)
    previous_z = None
    previous_f = None
    for z_value in z_values:
        current_f = equation(float(z_value))
        if np.isnan(current_f):
            continue
        if previous_f is not None and previous_f == 0:
            bracket = (previous_z, previous_z)
            break
        if (
            previous_f is not None
            and current_f != 0
            and np.sign(previous_f) != np.sign(current_f)
        ):
            bracket = (float(previous_z), float(z_value))
            break
        previous_z = float(z_value)
        previous_f = float(current_f)

    if bracket is None:
        return None

    if bracket[0] == bracket[1]:
        z_root = bracket[0]
    else:
        solution = root_scalar(equation, bracket=bracket, method="bisect")
        if not solution.converged:
            return None
        z_root = float(solution.root)

    y_value = y_of(z_root)
    if y_value <= 0:
        return None

    f_value = 1 - y_value / r1_norm
    g_value = a_term * np.sqrt(y_value / mu_km3_s2)
    g_dot = 1 - y_value / r2_norm
    if np.isclose(g_value, 0.0):
        return None

    v1_km_s = (r2_km - f_value * r1_km) / g_value
    v2_km_s = (g_dot * r2_km - r1_km) / g_value
    return LambertSolution(v1_km_s=v1_km_s, v2_km_s=v2_km_s)

