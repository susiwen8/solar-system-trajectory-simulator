from dataclasses import dataclass


@dataclass(frozen=True)
class BodyState:
    body_id: str
    epoch: str
    position_km: tuple[float, float, float]
    velocity_km_per_s: tuple[float, float, float]
    mu_km3_per_s2: float
