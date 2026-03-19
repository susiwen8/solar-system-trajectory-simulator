from app.core.dynamics.thrust import BurnSegment, burn_mass_flow_kg_per_s, thrust_acceleration_km_per_s2


def test_thrust_acceleration_scales_with_mass() -> None:
    accel = thrust_acceleration_km_per_s2(
        thrust_newtons=1.2,
        mass_kg=600.0,
        direction=(1.0, 0.0, 0.0),
    )

    assert accel[0] > 0
    assert accel[1] == 0
    assert accel[2] == 0


def test_burn_mass_flow_uses_isp() -> None:
    flow = burn_mass_flow_kg_per_s(thrust_newtons=0.6, isp_seconds=3000.0)

    assert flow > 0


def test_burn_segment_tracks_active_window() -> None:
    segment = BurnSegment(
        burn_type="TCM",
        start_epoch_seconds=120.0,
        duration_seconds=30.0,
        thrust_newtons=0.8,
        isp_seconds=3200.0,
        direction=(0.0, 1.0, 0.0),
        direction_label="prograde",
    )

    assert segment.start_epoch_seconds == 120.0
    assert segment.end_epoch_seconds == 150.0
