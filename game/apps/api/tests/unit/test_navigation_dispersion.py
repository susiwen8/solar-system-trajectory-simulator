import numpy as np

from app.services.navigation_dispersion import apply_navigation_dispersion


def test_fixed_seed_produces_repeatable_dispersion() -> None:
    nominal_state = np.array([1.0, 2.0, 3.0, 0.1, 0.2, 0.3], dtype=float)

    left = apply_navigation_dispersion(
        nominal_state,
        position_sigma_km=10.0,
        velocity_sigma_km_per_s=0.01,
        seed=4,
    )
    right = apply_navigation_dispersion(
        nominal_state,
        position_sigma_km=10.0,
        velocity_sigma_km_per_s=0.01,
        seed=4,
    )

    assert np.allclose(left.state_vector, right.state_vector)
    assert np.allclose(left.position_offset_km, right.position_offset_km)
    assert np.allclose(left.velocity_offset_km_per_s, right.velocity_offset_km_per_s)


def test_dispersion_does_not_mutate_nominal_state() -> None:
    nominal_state = np.array([1.0, 0.0, 0.0, 0.0, 1.0, 0.0], dtype=float)
    original = nominal_state.copy()

    dispersed = apply_navigation_dispersion(
        nominal_state,
        position_sigma_km=5.0,
        velocity_sigma_km_per_s=0.02,
        seed=9,
    )

    assert dispersed.state_vector is not nominal_state
    assert np.allclose(nominal_state, original)
    assert not np.allclose(dispersed.state_vector, original)
