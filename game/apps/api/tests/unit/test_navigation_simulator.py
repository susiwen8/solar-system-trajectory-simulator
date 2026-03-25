import numpy as np

import app.services.navigation_simulator as navigation_simulator_module
from app.core.dynamics.propagator import PropagationResult, PropagationSample
from app.schemas.mission import NavigationConfig
from app.services.navigation_simulator import EncounterTarget, NavigationSimulator


def build_navigation_config(*, max_tcm_count: int = 1) -> NavigationConfig:
    return NavigationConfig.model_validate(
        {
            "enabled": True,
            "randomSeed": 4,
            "injectionDispersion": {
                "positionSigmaKm": 2.0,
                "velocitySigmaKmPerS": 0.02,
            },
            "correctionPolicy": {
                "maxTcmCount": max_tcm_count,
                "predictedMissThresholdKm": 0.5,
                "positionDeviationThresholdKm": 0.5,
                "velocityDeviationThresholdKmPerS": 0.005,
                "checkpointStepSeconds": 5.0,
                "maxCorrectionDeltaVKmPerS": 0.05,
            },
        }
    )


def build_nominal_samples() -> list[dict]:
    return [
        {
            "epochSeconds": 0.0,
            "positionKm": [0.0, 0.0, 0.0],
            "velocityKmPerSec": [1.0, 0.0, 0.0],
        },
        {
            "epochSeconds": 5.0,
            "positionKm": [5.0, 0.0, 0.0],
            "velocityKmPerSec": [1.0, 0.0, 0.0],
        },
        {
            "epochSeconds": 10.0,
            "positionKm": [10.0, 0.0, 0.0],
            "velocityKmPerSec": [1.0, 0.0, 0.0],
        },
    ]


def zero_acceleration(_: float, __: np.ndarray) -> np.ndarray:
    return np.zeros(3, dtype=float)


def test_navigation_simulator_injects_dispersion_and_emits_events() -> None:
    simulator = NavigationSimulator()

    result = simulator.simulate(
        launch_epoch="2026-01-01T00:00:00Z",
        nominal_initial_state=np.array([0.0, 0.0, 0.0, 1.0, 0.0, 0.0], dtype=float),
        nominal_samples=build_nominal_samples(),
        acceleration_fn=zero_acceleration,
        navigation_config=build_navigation_config(max_tcm_count=1),
        encounter_targets=[
            EncounterTarget(
                body_id="mars",
                epoch="2026-01-01T00:00:10Z",
                epoch_seconds=10.0,
                position_km=(10.0, 0.0, 0.0),
                kind="arrival",
            )
        ],
    )

    assert result.navigation_telemetry["enabled"] is True
    assert result.navigation_telemetry["dispersedSamples"]
    assert result.navigation_telemetry["navigationEvents"][0]["type"] == "dispersionInjected"
    assert result.navigation_telemetry["tcmCount"] == 1
    assert result.active_samples == result.navigation_telemetry["dispersedSamples"]


def test_navigation_simulator_never_exceeds_max_tcm_count() -> None:
    simulator = NavigationSimulator()

    result = simulator.simulate(
        launch_epoch="2026-01-01T00:00:00Z",
        nominal_initial_state=np.array([0.0, 0.0, 0.0, 1.0, 0.0, 0.0], dtype=float),
        nominal_samples=build_nominal_samples(),
        acceleration_fn=zero_acceleration,
        navigation_config=build_navigation_config(max_tcm_count=0),
        encounter_targets=[
            EncounterTarget(
                body_id="mars",
                epoch="2026-01-01T00:00:10Z",
                epoch_seconds=10.0,
                position_km=(10.0, 0.0, 0.0),
                kind="arrival",
            )
        ],
    )

    assert result.navigation_telemetry["tcmCount"] <= 0
    assert all(event["type"] != "tcmExecuted" for event in result.navigation_telemetry["navigationEvents"])


def test_navigation_simulator_limits_checkpoint_propagation_count_for_long_missions(monkeypatch) -> None:
    call_count = 0

    def stub_propagate_state(
        *,
        initial_state,
        t_span,
        sample_step_s,
        acceleration_fn,
        burn_segments=None,
        rtol=1e-9,
        atol=1e-9,
    ):
        del sample_step_s, acceleration_fn, burn_segments, rtol, atol
        nonlocal call_count
        call_count += 1
        start, end = t_span
        state = np.asarray(initial_state, dtype=float)
        dt = float(end - start)
        final_position = tuple(float(state[index] + state[index + 3] * dt) for index in range(3))
        final_velocity = tuple(float(state[index + 3]) for index in range(3))
        initial_mass = float(state[6]) if state.shape[0] > 6 else None
        return PropagationResult(
            samples=[
                PropagationSample(
                    epoch_seconds=float(start),
                    position_km=tuple(float(state[index]) for index in range(3)),
                    velocity_km_per_s=final_velocity,
                    mass_kg=initial_mass,
                ),
                PropagationSample(
                    epoch_seconds=float(end),
                    position_km=final_position,
                    velocity_km_per_s=final_velocity,
                    mass_kg=initial_mass,
                ),
            ]
        )

    monkeypatch.setattr(navigation_simulator_module, "propagate_state", stub_propagate_state)

    nominal_samples = [
        {
            "epochSeconds": float(index * 86_400.0),
            "positionKm": [float(index * 86_400.0), 0.0, 0.0],
            "velocityKmPerSec": [1.0, 0.0, 0.0],
        }
        for index in range(200)
    ]
    simulator = NavigationSimulator()

    result = simulator.simulate(
        launch_epoch="2026-01-01T00:00:00Z",
        nominal_initial_state=np.array([0.0, 0.0, 0.0, 1.0, 0.0, 0.0], dtype=float),
        nominal_samples=nominal_samples,
        acceleration_fn=zero_acceleration,
        navigation_config=NavigationConfig.model_validate(
            {
                "enabled": True,
                "randomSeed": 4,
                "injectionDispersion": {
                    "positionSigmaKm": 2.0,
                    "velocitySigmaKmPerS": 0.02,
                },
                "correctionPolicy": {
                    "maxTcmCount": 0,
                    "predictedMissThresholdKm": 0.5,
                    "positionDeviationThresholdKm": 0.5,
                    "velocityDeviationThresholdKmPerS": 0.005,
                    "checkpointStepSeconds": 86_400.0,
                    "maxCorrectionDeltaVKmPerS": 0.05,
                },
            }
        ),
        encounter_targets=[
            EncounterTarget(
                body_id="jupiter",
                epoch="2026-07-19T00:00:00Z",
                epoch_seconds=float(nominal_samples[-1]["epochSeconds"]),
                position_km=tuple(float(value) for value in nominal_samples[-1]["positionKm"]),
                kind="arrival",
            )
        ],
    )

    assert result.navigation_telemetry["tcmCount"] == 0
    assert call_count <= 24


def test_navigation_simulator_avoids_extra_forecast_propagations_for_linear_nominal_paths(monkeypatch) -> None:
    call_count = 0

    def stub_propagate_state(
        *,
        initial_state,
        t_span,
        sample_step_s,
        acceleration_fn,
        burn_segments=None,
        rtol=1e-9,
        atol=1e-9,
    ):
        del sample_step_s, acceleration_fn, burn_segments, rtol, atol
        nonlocal call_count
        call_count += 1
        start, end = t_span
        state = np.asarray(initial_state, dtype=float)
        dt = float(end - start)
        final_position = tuple(float(state[index] + state[index + 3] * dt) for index in range(3))
        final_velocity = tuple(float(state[index + 3]) for index in range(3))
        initial_mass = float(state[6]) if state.shape[0] > 6 else None
        return PropagationResult(
            samples=[
                PropagationSample(
                    epoch_seconds=float(start),
                    position_km=tuple(float(state[index]) for index in range(3)),
                    velocity_km_per_s=final_velocity,
                    mass_kg=initial_mass,
                ),
                PropagationSample(
                    epoch_seconds=float(end),
                    position_km=final_position,
                    velocity_km_per_s=final_velocity,
                    mass_kg=initial_mass,
                ),
            ]
        )

    monkeypatch.setattr(navigation_simulator_module, "propagate_state", stub_propagate_state)

    nominal_samples = [
        {
            "epochSeconds": float(index * 86_400.0),
            "positionKm": [float(index * 86_400.0), 0.0, 0.0],
            "velocityKmPerSec": [1.0, 0.0, 0.0],
        }
        for index in range(200)
    ]

    result = NavigationSimulator().simulate(
        launch_epoch="2026-01-01T00:00:00Z",
        nominal_initial_state=np.array([0.0, 0.0, 0.0, 1.0, 0.0, 0.0], dtype=float),
        nominal_samples=nominal_samples,
        acceleration_fn=zero_acceleration,
        navigation_config=NavigationConfig.model_validate(
            {
                "enabled": True,
                "randomSeed": 4,
                "injectionDispersion": {
                    "positionSigmaKm": 2.0,
                    "velocitySigmaKmPerS": 0.02,
                },
                "correctionPolicy": {
                    "maxTcmCount": 0,
                    "predictedMissThresholdKm": 0.5,
                    "positionDeviationThresholdKm": 0.5,
                    "velocityDeviationThresholdKmPerS": 0.005,
                    "checkpointStepSeconds": 86_400.0,
                    "maxCorrectionDeltaVKmPerS": 0.05,
                },
            }
        ),
        encounter_targets=[
            EncounterTarget(
                body_id="jupiter",
                epoch="2026-07-19T00:00:00Z",
                epoch_seconds=float(nominal_samples[-1]["epochSeconds"]),
                position_km=tuple(float(value) for value in nominal_samples[-1]["positionKm"]),
                kind="arrival",
            )
        ],
    )

    assert result.navigation_telemetry["tcmCount"] == 0
    assert call_count <= 12


def test_navigation_simulator_uses_navigation_specific_propagation_tolerances(monkeypatch) -> None:
    recorded_tolerances: list[tuple[float, float]] = []

    def stub_propagate_state(
        *,
        initial_state,
        t_span,
        sample_step_s,
        acceleration_fn,
        burn_segments=None,
        rtol=1e-9,
        atol=1e-9,
    ):
        del sample_step_s, acceleration_fn, burn_segments
        recorded_tolerances.append((rtol, atol))
        start, end = t_span
        state = np.asarray(initial_state, dtype=float)
        dt = float(end - start)
        final_position = tuple(float(state[index] + state[index + 3] * dt) for index in range(3))
        final_velocity = tuple(float(state[index + 3]) for index in range(3))
        initial_mass = float(state[6]) if state.shape[0] > 6 else None
        return PropagationResult(
            samples=[
                PropagationSample(
                    epoch_seconds=float(start),
                    position_km=tuple(float(state[index]) for index in range(3)),
                    velocity_km_per_s=final_velocity,
                    mass_kg=initial_mass,
                ),
                PropagationSample(
                    epoch_seconds=float(end),
                    position_km=final_position,
                    velocity_km_per_s=final_velocity,
                    mass_kg=initial_mass,
                ),
            ]
        )

    monkeypatch.setattr(navigation_simulator_module, "propagate_state", stub_propagate_state)

    NavigationSimulator().simulate(
        launch_epoch="2026-01-01T00:00:00Z",
        nominal_initial_state=np.array([0.0, 0.0, 0.0, 1.0, 0.0, 0.0], dtype=float),
        nominal_samples=build_nominal_samples(),
        acceleration_fn=zero_acceleration,
        navigation_config=build_navigation_config(max_tcm_count=0),
        encounter_targets=[
            EncounterTarget(
                body_id="mars",
                epoch="2026-01-01T00:00:10Z",
                epoch_seconds=10.0,
                position_km=(10.0, 0.0, 0.0),
                kind="arrival",
            )
        ],
    )

    assert recorded_tolerances
    assert recorded_tolerances[0] == (1e-7, 1e-7)
