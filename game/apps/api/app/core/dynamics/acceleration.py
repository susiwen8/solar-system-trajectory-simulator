from typing import Dict, Optional, Set

import numpy as np


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
