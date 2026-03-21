import numpy as np


def safe_norm(vector: np.ndarray) -> float:
    return float(np.linalg.norm(vector))


def safe_unit(vector: np.ndarray) -> np.ndarray:
    norm = safe_norm(vector)
    if norm == 0.0:
        raise ValueError("Cannot normalize a zero vector")

    return vector / norm

