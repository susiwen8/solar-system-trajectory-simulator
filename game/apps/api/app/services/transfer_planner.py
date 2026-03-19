from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import pi, sqrt
from typing import Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import minimize_scalar

from app.core.constants import PLANETARY_BODY_RADII_KM, SOLAR_SYSTEM_MU_KM3_PER_S2
from app.core.dynamics.acceleration import combined_point_mass_acceleration
from app.core.dynamics.lambert import LambertSolution, solve_lambert_transfer


@dataclass(frozen=True)
class TransferPlan:
    initial_state: np.ndarray
    duration_seconds: float
    output_step_seconds: float
    miss_distance_km: float
    delta_v_km_per_s: float


@dataclass(frozen=True)
class _TransferCandidate:
    duration_seconds: float
    solution: LambertSolution
    departure_delta_v_km_per_s: float
    arrival_delta_v_km_per_s: float

    @property
    def total_delta_v_km_per_s(self) -> float:
        return self.departure_delta_v_km_per_s + self.arrival_delta_v_km_per_s


class TransferPlanner:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.solar_mu = SOLAR_SYSTEM_MU_KM3_PER_S2["sun"]

    def plan_auto_transfer(self, departure_body: str, target_body: str, launch_epoch: str) -> TransferPlan:
        if departure_body != "earth":
            raise ValueError("Auto-transfer planning currently supports Earth departures only")

        departure_state = self.ephemeris.get_body_state(departure_body, launch_epoch)
        departure_position = np.array(departure_state.position_km, dtype=float)
        departure_velocity = np.array(departure_state.velocity_km_per_s, dtype=float)
        target_launch_state = self.ephemeris.get_body_state(target_body, launch_epoch)

        r1 = np.linalg.norm(departure_position)
        r2 = np.linalg.norm(np.array(target_launch_state.position_km, dtype=float))
        transfer_axis = (r1 + r2) / 2.0
        hohmann_time = pi * np.sqrt((transfer_axis**3) / self.solar_mu)

        duration_bounds = self._duration_bounds_seconds(hohmann_time, r2 >= r1)
        best = self._best_candidate(
            launch_epoch=launch_epoch,
            departure_position=departure_position,
            departure_velocity=departure_velocity,
            target_body=target_body,
            duration_bounds=duration_bounds,
        )

        duration_seconds = best.duration_seconds
        departure_position, departure_velocity_at_boundary = self._build_departure_state_at_soi_boundary(
            departure_body=departure_body,
            departure_position=departure_position,
            departure_velocity=departure_velocity,
            lambert_departure_velocity=best.solution.departure_velocity_km_per_s,
        )
        initial_velocity, final_state, miss_distance = self._refine_departure_velocity(
            departure_body=departure_body,
            target_body=target_body,
            launch_epoch=launch_epoch,
            departure_position=departure_position,
            initial_velocity=departure_velocity_at_boundary,
            duration_seconds=duration_seconds,
        )
        target_epoch = _epoch_with_offset(launch_epoch, duration_seconds)
        target_arrival_state = self.ephemeris.get_body_state(target_body, target_epoch)
        arrival_delta_v = float(
            np.linalg.norm(final_state[3:] - np.array(target_arrival_state.velocity_km_per_s, dtype=float))
        )
        departure_delta_v = float(np.linalg.norm(initial_velocity - departure_velocity))
        miss_distance = self._arrival_miss_distance(
            departure_position=departure_position,
            initial_velocity=initial_velocity,
            duration_seconds=duration_seconds,
            launch_epoch=launch_epoch,
            target_body=target_body,
        )
        output_step_seconds = self._recommended_output_step(duration_seconds)

        return TransferPlan(
            initial_state=np.array([*departure_position, *initial_velocity], dtype=float),
            duration_seconds=duration_seconds,
            output_step_seconds=output_step_seconds,
            miss_distance_km=miss_distance,
            delta_v_km_per_s=departure_delta_v + arrival_delta_v,
        )

    def _build_departure_state_at_soi_boundary(
        self,
        *,
        departure_body: str,
        departure_position: np.ndarray,
        departure_velocity: np.ndarray,
        lambert_departure_velocity: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        body_mu = SOLAR_SYSTEM_MU_KM3_PER_S2[departure_body]
        v_infinity = np.array(lambert_departure_velocity, dtype=float) - np.array(departure_velocity, dtype=float)
        v_infinity_norm = float(np.linalg.norm(v_infinity))
        if v_infinity_norm <= 1e-9:
            return departure_position, lambert_departure_velocity

        departure_radius = float(np.linalg.norm(departure_position))
        soi_radius = self._sphere_of_influence_radius_km(departure_body, departure_radius)
        escape_direction = v_infinity / v_infinity_norm
        boundary_position = departure_position + escape_direction * soi_radius
        boundary_relative_speed = sqrt(v_infinity_norm**2 + (2.0 * body_mu / soi_radius))
        boundary_velocity = departure_velocity + escape_direction * boundary_relative_speed
        return boundary_position, boundary_velocity

    def _best_candidate(
        self,
        *,
        launch_epoch: str,
        departure_position: np.ndarray,
        departure_velocity: np.ndarray,
        target_body: str,
        duration_bounds: Tuple[float, float],
    ) -> _TransferCandidate:
        lower_bound, upper_bound = duration_bounds
        duration_samples = np.linspace(lower_bound, upper_bound, 40)
        candidates = [
            candidate
            for candidate in (
                self._evaluate_candidate(
                    launch_epoch=launch_epoch,
                    departure_position=departure_position,
                    departure_velocity=departure_velocity,
                    target_body=target_body,
                    duration_seconds=float(duration_seconds),
                )
                for duration_seconds in duration_samples
            )
            if candidate is not None
        ]
        if not candidates:
            raise RuntimeError("Unable to find a feasible Lambert transfer in the search window")

        best = min(candidates, key=lambda candidate: candidate.total_delta_v_km_per_s)
        sample_spacing = float(duration_samples[1] - duration_samples[0]) if len(duration_samples) > 1 else 7.0 * 86_400.0

        for seed in sorted(candidates, key=lambda candidate: candidate.total_delta_v_km_per_s)[:4]:
            lower = max(lower_bound, seed.duration_seconds - sample_spacing)
            upper = min(upper_bound, seed.duration_seconds + sample_spacing)
            if upper - lower < 12.0 * 3600.0:
                continue
            result = minimize_scalar(
                lambda duration_seconds: self._candidate_objective(
                    launch_epoch=launch_epoch,
                    departure_position=departure_position,
                    departure_velocity=departure_velocity,
                    target_body=target_body,
                    duration_seconds=float(duration_seconds),
                ),
                bounds=(lower, upper),
                method="bounded",
                options={"xatol": 1800.0, "maxiter": 80},
            )
            refined = self._evaluate_candidate(
                launch_epoch=launch_epoch,
                departure_position=departure_position,
                departure_velocity=departure_velocity,
                target_body=target_body,
                duration_seconds=float(result.x),
            )
            if refined is not None and refined.total_delta_v_km_per_s < best.total_delta_v_km_per_s:
                best = refined

        return best

    def _candidate_objective(
        self,
        *,
        launch_epoch: str,
        departure_position: np.ndarray,
        departure_velocity: np.ndarray,
        target_body: str,
        duration_seconds: float,
    ) -> float:
        candidate = self._evaluate_candidate(
            launch_epoch=launch_epoch,
            departure_position=departure_position,
            departure_velocity=departure_velocity,
            target_body=target_body,
            duration_seconds=duration_seconds,
        )
        return candidate.total_delta_v_km_per_s if candidate is not None else float("inf")

    def _evaluate_candidate(
        self,
        *,
        launch_epoch: str,
        departure_position: np.ndarray,
        departure_velocity: np.ndarray,
        target_body: str,
        duration_seconds: float,
    ) -> Optional[_TransferCandidate]:
        target_epoch = _epoch_with_offset(launch_epoch, duration_seconds)
        target_state = self.ephemeris.get_body_state(target_body, target_epoch)
        target_position = np.array(target_state.position_km, dtype=float)
        target_velocity = np.array(target_state.velocity_km_per_s, dtype=float)
        try:
            solution = solve_lambert_transfer(
                departure_position_km=departure_position,
                arrival_position_km=target_position,
                time_of_flight_seconds=duration_seconds,
                mu_km3_per_s2=self.solar_mu,
            )
        except ValueError:
            return None

        departure_delta_v = float(np.linalg.norm(solution.departure_velocity_km_per_s - departure_velocity))
        arrival_delta_v = float(np.linalg.norm(solution.arrival_velocity_km_per_s - target_velocity))
        return _TransferCandidate(
            duration_seconds=duration_seconds,
            solution=solution,
            departure_delta_v_km_per_s=departure_delta_v,
            arrival_delta_v_km_per_s=arrival_delta_v,
        )

    def _arrival_miss_distance(
        self,
        *,
        departure_position: np.ndarray,
        initial_velocity: np.ndarray,
        duration_seconds: float,
        launch_epoch: str,
        target_body: str,
    ) -> float:
        final_state = self._propagate_to_epoch(
            np.array([*departure_position, *initial_velocity], dtype=float),
            duration_seconds,
            launch_epoch=launch_epoch,
        )
        target_epoch = _epoch_with_offset(launch_epoch, duration_seconds)
        target_state = self.ephemeris.get_body_state(target_body, target_epoch)
        return float(np.linalg.norm(final_state[:3] - np.array(target_state.position_km, dtype=float)))

    def _propagate_to_epoch(
        self,
        initial_state: np.ndarray,
        duration_seconds: float,
        *,
        launch_epoch: str,
    ) -> np.ndarray:
        body_state_cache: Dict[str, List] = {}

        def rhs(time_seconds: float, state: np.ndarray) -> np.ndarray:
            position = state[:3]
            velocity = state[3:]
            epoch = _epoch_with_offset(launch_epoch, time_seconds)
            if epoch not in body_state_cache:
                body_state_cache[epoch] = self.ephemeris.get_all_body_states(epoch)
            acceleration = combined_point_mass_acceleration(
                body_state_cache[epoch],
                position,
                minimum_radius_by_body_km=PLANETARY_BODY_RADII_KM,
            )
            return np.concatenate((velocity, acceleration))

        solution = solve_ivp(
            rhs,
            t_span=(0.0, duration_seconds),
            y0=initial_state,
            method="DOP853",
            t_eval=[duration_seconds],
            rtol=1e-9,
            atol=1e-9,
        )
        if not solution.success:
            raise RuntimeError(solution.message)
        return solution.y[:, -1]

    def _refine_departure_velocity(
        self,
        *,
        departure_body: str,
        target_body: str,
        launch_epoch: str,
        departure_position: np.ndarray,
        initial_velocity: np.ndarray,
        duration_seconds: float,
    ) -> tuple[np.ndarray, np.ndarray, float]:
        target_epoch = _epoch_with_offset(launch_epoch, duration_seconds)
        target_state = self.ephemeris.get_body_state(target_body, target_epoch)
        target_position = np.array(target_state.position_km, dtype=float)
        current_velocity = np.array(initial_velocity, dtype=float)

        current_state = self._propagate_to_epoch(
            np.array([*departure_position, *current_velocity], dtype=float),
            duration_seconds,
            launch_epoch=launch_epoch,
        )
        current_error = target_position - current_state[:3]
        current_miss_distance = float(np.linalg.norm(current_error))

        best_velocity = current_velocity.copy()
        best_state = current_state
        best_error = current_error
        best_miss_distance = float(np.linalg.norm(best_error))
        perturbation_km_per_s = 0.01

        for _ in range(6):
            if current_miss_distance <= 10.0:
                break

            jacobian = np.zeros((3, 3), dtype=float)
            for axis in range(3):
                perturbed_velocity = current_velocity.copy()
                perturbed_velocity[axis] += perturbation_km_per_s
                perturbed_state = self._propagate_to_epoch(
                    np.array([*departure_position, *perturbed_velocity], dtype=float),
                    duration_seconds,
                    launch_epoch=launch_epoch,
                )
                jacobian[:, axis] = (perturbed_state[:3] - current_state[:3]) / perturbation_km_per_s

            delta_v, *_ = np.linalg.lstsq(jacobian, current_error, rcond=None)
            delta_v_norm = float(np.linalg.norm(delta_v))
            if not np.isfinite(delta_v_norm) or delta_v_norm == 0.0:
                break
            if delta_v_norm > 2.5:
                delta_v *= 2.5 / delta_v_norm

            current_velocity = current_velocity + 0.85 * delta_v
            current_state = self._propagate_to_epoch(
                np.array([*departure_position, *current_velocity], dtype=float),
                duration_seconds,
                launch_epoch=launch_epoch,
            )
            current_error = target_position - current_state[:3]
            current_miss_distance = float(np.linalg.norm(current_error))
            if current_miss_distance < best_miss_distance:
                best_velocity = current_velocity.copy()
                best_state = current_state
                best_error = current_error
                best_miss_distance = current_miss_distance

        return best_velocity, best_state, best_miss_distance

    def _duration_bounds_seconds(self, hohmann_time: float, is_outer_target: bool) -> Tuple[float, float]:
        minimum = max(45.0 * 86_400.0, hohmann_time * (0.7 if is_outer_target else 0.45))
        maximum = min(1_800.0 * 86_400.0, hohmann_time * (2.2 if is_outer_target else 1.8))
        return (minimum, max(minimum + 86_400.0, maximum))

    def _recommended_output_step(self, duration_seconds: float) -> float:
        return float(np.clip(duration_seconds / 480.0, 6.0 * 3600.0, 4.0 * 24.0 * 3600.0))

    def _sphere_of_influence_radius_km(self, body_id: str, heliocentric_radius_km: float) -> float:
        body_mu = SOLAR_SYSTEM_MU_KM3_PER_S2[body_id]
        return heliocentric_radius_km * (body_mu / self.solar_mu) ** (2.0 / 5.0)


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
