from app.schemas.mission import PropulsionConfig
from app.services.tcm_planner import compute_propellant_used_kg, synthesize_tcm_delta_v


def test_synthesize_tcm_caps_delta_v() -> None:
    correction = synthesize_tcm_delta_v(
        velocity_error_km_per_s=(0.06, 0.0, 0.0),
        position_error_km=(12_000.0, 0.0, 0.0),
        predicted_miss_km=60_000.0,
        max_delta_v_km_per_s=0.01,
    )

    assert correction.delta_v_km_per_s <= 0.01
    assert correction.delta_v_vector_km_per_s[0] < 0


def test_compute_propellant_used_returns_none_without_propulsion() -> None:
    assert compute_propellant_used_kg(
        delta_v_km_per_s=0.002,
        mass_kg=1_800.0,
        propulsion_config=None,
    ) is None


def test_compute_propellant_used_applies_rocket_equation() -> None:
    propellant_used_kg = compute_propellant_used_kg(
        delta_v_km_per_s=0.01,
        mass_kg=1_800.0,
        propulsion_config=PropulsionConfig(
            initialMassKg=1_800.0,
            propellantMassKg=420.0,
            maxThrustN=0.8,
            ispSeconds=3_200.0,
        ),
    )

    assert propellant_used_kg is not None
    assert 0.0 < propellant_used_kg < 420.0
