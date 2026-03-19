from typing import Dict, Iterable, Optional, Set, Tuple

import numpy as np

from app.core.dynamics.thrust import BurnSegment, burn_mass_flow_kg_per_s, is_burn_active, thrust_acceleration_km_per_s2


def point_mass_acceleration(
    body_position: np.ndarray,
    probe_position: np.ndarray,
    mu: float,
    minimum_radius_km: float = 0.0,
) -> np.ndarray:
    delta = body_position - probe_position
    radius = np.linalg.norm(delta)
    effective_radius = max(float(radius), float(minimum_radius_km))
    if effective_radius <= 0.0:
        return np.zeros(3, dtype=float)
    return mu * delta / effective_radius**3


def combined_point_mass_acceleration(
    body_states,
    probe_position: np.ndarray,
    *,
    ignored_body_ids: Optional[Set[str]] = None,
    minimum_radius_by_body_km: Optional[Dict[str, float]] = None,
) -> np.ndarray:
    ignored_body_ids = ignored_body_ids or set()
    minimum_radius_by_body_km = minimum_radius_by_body_km or {}
    acceleration = np.zeros(3, dtype=float)

    for body_state in body_states:
        if body_state.body_id in ignored_body_ids:
            continue
        acceleration += point_mass_acceleration(
            np.array(body_state.position_km, dtype=float),
            probe_position,
            body_state.mu_km3_per_s2,
            minimum_radius_km=minimum_radius_by_body_km.get(body_state.body_id, 0.0),
        )

    return acceleration


def finite_thrust_acceleration(
    epoch_seconds: float,
    *,
    mass_kg: float,
    burn_segments: Iterable[BurnSegment],
) -> Tuple[np.ndarray, float]:
    acceleration = np.zeros(3, dtype=float)
    mass_flow_kg_per_s = 0.0

    for burn_segment in burn_segments:
        if not is_burn_active(burn_segment, epoch_seconds):
            continue
        acceleration += np.array(
            thrust_acceleration_km_per_s2(
                burn_segment.thrust_newtons,
                mass_kg,
                burn_segment.direction,
            ),
            dtype=float,
        )
        mass_flow_kg_per_s += burn_mass_flow_kg_per_s(
            burn_segment.thrust_newtons,
            burn_segment.isp_seconds,
        )

    return acceleration, mass_flow_kg_per_s
