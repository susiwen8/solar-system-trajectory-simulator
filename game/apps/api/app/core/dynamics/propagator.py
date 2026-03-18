from dataclasses import dataclass
from typing import Callable, List, Tuple

import numpy as np
from scipy.integrate import solve_ivp

from app.core.dynamics.acceleration import point_mass_acceleration


@dataclass(frozen=True)
class PropagationSample:
    epoch_seconds: float
    position_km: Tuple[float, float, float]
    velocity_km_per_s: Tuple[float, float, float]


@dataclass(frozen=True)
class PropagationResult:
    samples: List[PropagationSample]


def propagate_state(
    *,
    initial_state: np.ndarray,
    t_span: Tuple[float, float],
    sample_step_s: float,
    acceleration_fn: Callable[[float, np.ndarray], np.ndarray],
    rtol: float = 1e-9,
    atol: float = 1e-9,
) -> PropagationResult:
    sample_times = np.arange(t_span[0], t_span[1] + sample_step_s, sample_step_s)

    def rhs(time_seconds: float, state: np.ndarray) -> np.ndarray:
        position = state[:3]
        velocity = state[3:]
        acceleration = acceleration_fn(time_seconds, position)
        return np.concatenate((velocity, acceleration))

    solution = solve_ivp(
        rhs,
        t_span=t_span,
        y0=initial_state,
        method="DOP853",
        t_eval=sample_times,
        rtol=rtol,
        atol=atol,
    )
    if not solution.success:
        raise RuntimeError(solution.message)

    samples = [
        PropagationSample(
            epoch_seconds=float(solution.t[index]),
            position_km=tuple(float(value) for value in solution.y[:3, index]),
            velocity_km_per_s=tuple(float(value) for value in solution.y[3:, index]),
        )
        for index in range(solution.y.shape[1])
    ]
    return PropagationResult(samples=samples)


def propagate_two_body_reference_case() -> PropagationResult:
    solar_mu = 132_712_440_018.0
    initial_state = np.array([149_597_870.7, 0.0, 0.0, 0.0, 29.78, 0.0], dtype=float)

    def acceleration_fn(_: float, probe_position: np.ndarray) -> np.ndarray:
        return point_mass_acceleration(np.zeros(3), probe_position, solar_mu)

    return propagate_state(
        initial_state=initial_state,
        t_span=(0.0, 30.0 * 24.0 * 3600.0),
        sample_step_s=24.0 * 3600.0,
        acceleration_fn=acceleration_fn,
    )
