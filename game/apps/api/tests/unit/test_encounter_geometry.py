from app.services.encounter_geometry import build_encounter_geometry


def test_build_encounter_geometry_returns_body_relative_v_infinity() -> None:
    geometry = build_encounter_geometry(
        body_id="jupiter",
        encounter_epoch="2027-03-01T12:00:00.000Z",
        body_position_km=(778_500_000.0, 0.0, 0.0),
        body_velocity_km_per_s=(0.0, 13.1, 0.0),
        probe_position_km=(778_650_000.0, 12_000.0, 0.0),
        probe_velocity_km_per_s=(0.0, 19.2, 0.0),
        periapsis_altitude_km=75_000.0,
    )

    assert geometry.body_id == "jupiter"
    assert geometry.encounter_type == "flyby"
    assert geometry.reference_frame == "jupiter-centered-inertial"
    assert geometry.incoming_v_infinity_km_per_s > 0
    assert geometry.periapsis_altitude_km == 75_000.0
    assert geometry.sphere_of_influence_radius_km > geometry.periapsis_radius_km


def test_build_capture_geometry_marks_capture_encounter_type() -> None:
    geometry = build_encounter_geometry(
        body_id="mars",
        encounter_epoch="2026-01-04T00:00:00Z",
        body_position_km=(-159_300_000.0, 188_100_000.0, 7_650_000.0),
        body_velocity_km_per_s=(-17.2, -13.2, 0.15),
        probe_position_km=(-159_295_000.0, 188_098_000.0, 7_649_000.0),
        probe_velocity_km_per_s=(-18.4, -11.7, -0.35),
        periapsis_altitude_km=350.0,
        encounter_type="capture",
    )

    assert geometry.body_id == "mars"
    assert geometry.encounter_type == "capture"
    assert geometry.reference_frame == "mars-centered-inertial"
    assert geometry.periapsis_radius_km > geometry.periapsis_altitude_km
