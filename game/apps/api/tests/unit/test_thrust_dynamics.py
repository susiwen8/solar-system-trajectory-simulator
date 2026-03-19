from app.core.dynamics.thrust import BurnSegment, burn_mass_flow_kg_per_s, thrust_acceleration_km_per_s2
from app.core.dynamics.propagator import propagate_state


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


def test_propagator_decreases_mass_during_active_burn() -> None:
    propagation = propagate_state(
        initial_state=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 900.0],
        t_span=(0.0, 20.0),
        sample_step_s=10.0,
        acceleration_fn=lambda _time_seconds, _probe_position: (0.0, 0.0, 0.0),
        burn_segments=[
            BurnSegment(
                burn_type="TCM",
                start_epoch_seconds=0.0,
                duration_seconds=20.0,
                thrust_newtons=1.4,
                isp_seconds=2500.0,
                direction=(1.0, 0.0, 0.0),
                direction_label="prograde",
            )
        ],
    )

    assert propagation.samples[0].mass_kg is not None
    assert propagation.samples[-1].mass_kg is not None
    assert propagation.samples[0].mass_kg > propagation.samples[-1].mass_kg
