import numpy as np


def point_mass_acceleration(body_position: np.ndarray, probe_position: np.ndarray, mu: float) -> np.ndarray:
    delta = body_position - probe_position
    radius = np.linalg.norm(delta)
    return mu * delta / radius**3
