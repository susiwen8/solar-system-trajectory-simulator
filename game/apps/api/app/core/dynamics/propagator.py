from dataclasses import dataclass
from typing import Callable, List, Optional, Sequence, Tuple

import numpy as np
from scipy.integrate import solve_ivp

from app.core.dynamics.acceleration import finite_thrust_acceleration, point_mass_acceleration
from app.core.dynamics.thrust import BurnSegment


@dataclass(frozen=True)
class PropagationSample:
    epoch_seconds: float
    position_km: Tuple[float, float, float]
    velocity_km_per_s: Tuple[float, float, float]
    mass_kg: Optional[float] = None


@dataclass(frozen=True)
class PropagationResult:
    samples: List[PropagationSample]


def propagate_state(
    *,
    initial_state: Sequence[float],
    t_span: Tuple[float, float],
    sample_step_s: float,
    acceleration_fn: Callable[[float, np.ndarray], np.ndarray],
    burn_segments: Optional[List[BurnSegment]] = None,
    rtol: float = 1e-9,
    atol: float = 1e-9,
) -> PropagationResult:
    state_vector = np.asarray(initial_state, dtype=float)
    if state_vector.shape[0] not in (6, 7):
        raise ValueError("initial_state must contain either 6 or 7 state elements")

    active_burn_segments = burn_segments or []
    sample_times = np.arange(t_span[0], t_span[1], sample_step_s, dtype=float)
    if sample_times.size == 0 or sample_times[0] != float(t_span[0]):
        sample_times = np.insert(sample_times, 0, float(t_span[0]))
    if sample_times[-1] != float(t_span[1]):
        sample_times = np.append(sample_times, float(t_span[1]))

    def rhs(time_seconds: float, state: np.ndarray) -> np.ndarray:
        position = state[:3]
        velocity = state[3:6]
        acceleration = np.array(acceleration_fn(time_seconds, position), dtype=float)

        if state.shape[0] == 6:
            return np.concatenate((velocity, acceleration))

        mass_kg = max(float(state[6]), 1e-9)
        thrust_acceleration, mass_flow_kg_per_s = finite_thrust_acceleration(
            time_seconds,
            mass_kg=mass_kg,
            burn_segments=active_burn_segments,
        )
        return np.concatenate(
            (
                velocity,
                acceleration + thrust_acceleration,
                np.array([-mass_flow_kg_per_s], dtype=float),
            )
        )

    solution = solve_ivp(
        rhs,
        t_span=t_span,
        y0=state_vector,
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
            velocity_km_per_s=tuple(float(value) for value in solution.y[3:6, index]),
            mass_kg=float(solution.y[6, index]) if solution.y.shape[0] > 6 else None,
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
