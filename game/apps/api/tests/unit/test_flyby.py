import numpy as np

from app.core.dynamics.flyby import evaluate_unpowered_flyby


def test_unpowered_flyby_accepts_feasible_jupiter_turn() -> None:
    result = evaluate_unpowered_flyby(
        "jupiter",
        inbound_velocity_km_per_s=np.array([5.0, 0.0, 0.0], dtype=float),
        outbound_velocity_km_per_s=np.array([4.33, 2.5, 0.0], dtype=float),
        body_velocity_km_per_s=np.zeros(3, dtype=float),
    )

    assert result.feasible
    assert result.turn_angle_deg > 20.0
    assert result.periapsis_altitude_km > 0.0


def test_unpowered_flyby_rejects_excessive_turn_for_mars() -> None:
    result = evaluate_unpowered_flyby(
        "mars",
        inbound_velocity_km_per_s=np.array([7.0, 0.0, 0.0], dtype=float),
        outbound_velocity_km_per_s=np.array([-7.0, 0.0, 0.0], dtype=float),
        body_velocity_km_per_s=np.zeros(3, dtype=float),
    )

    assert not result.feasible
