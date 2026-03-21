import numpy as np

from app.astrodynamics.flyby import classify_flyby


def test_classify_flyby_reports_infeasible_when_turn_angle_is_too_large() -> None:
    incoming = np.array([7.0, 0.0, 0.0])
    outgoing = np.array([0.0, 7.0, 0.0])

    result = classify_flyby(
        incoming_vinf_km_s=incoming,
        outgoing_vinf_km_s=outgoing,
        mu_km3_s2=3.24859e5,
        body_radius_km=6051.8,
        min_altitude_km=5000.0,
    )

    assert result.status == "infeasible"
    assert result.required_turn_angle_deg > result.max_turn_angle_deg
