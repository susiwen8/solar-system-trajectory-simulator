import numpy as np

from app.core.dynamics.acceleration import point_mass_acceleration


def test_point_mass_acceleration_points_toward_origin() -> None:
    acceleration = point_mass_acceleration(
        body_position=np.array([0.0, 0.0, 0.0]),
        probe_position=np.array([1.0e8, 0.0, 0.0]),
        mu=1.32712440018e11,
    )

    assert acceleration[0] < 0.0
    assert acceleration[1] == 0.0
    assert acceleration[2] == 0.0
