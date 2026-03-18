from app.core.dynamics.propagator import propagate_two_body_reference_case


def test_two_body_reference_case_returns_ordered_samples() -> None:
    result = propagate_two_body_reference_case()

    assert len(result.samples) > 10
    assert result.samples[0].epoch_seconds < result.samples[-1].epoch_seconds


def test_two_body_reference_case_keeps_specific_orbital_energy_stable() -> None:
    result = propagate_two_body_reference_case()
    solar_mu = 132_712_440_018.0

    def specific_orbital_energy(sample) -> float:
        x, y, z = sample.position_km
        vx, vy, vz = sample.velocity_km_per_s
        radius = (x * x + y * y + z * z) ** 0.5
        speed_squared = vx * vx + vy * vy + vz * vz
        return 0.5 * speed_squared - solar_mu / radius

    start_energy = specific_orbital_energy(result.samples[0])
    end_energy = specific_orbital_energy(result.samples[-1])
    relative_drift = abs((end_energy - start_energy) / start_energy)

    # Keep the regression bound tighter than 1e-12 for the 30-day reference arc.
    assert relative_drift < 1e-12
