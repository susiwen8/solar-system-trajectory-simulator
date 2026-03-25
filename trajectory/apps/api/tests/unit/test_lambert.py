import numpy as np

from app.astrodynamics.lambert import solve_lambert


def test_solve_lambert_returns_finite_endpoint_velocities() -> None:
    mu_sun = 1.32712440018e11
    r1 = np.array([149_597_870.7, 0.0, 0.0])
    r2 = np.array([0.0, 227_939_200.0, 0.0])

    solution = solve_lambert(r1, r2, 220 * 86400.0, mu_sun)

    assert solution is not None
    assert np.isfinite(solution.v1_km_s).all()
    assert np.isfinite(solution.v2_km_s).all()

