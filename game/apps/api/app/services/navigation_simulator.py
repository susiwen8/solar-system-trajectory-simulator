from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np

from app.core.dynamics.propagator import PropagationResult, propagate_state
from app.schemas.mission import NavigationConfig, PropulsionConfig
from app.services.navigation_dispersion import apply_navigation_dispersion
from app.services.navigation_thresholds import (
    classify_breach_reason,
    compute_state_deviation,
    summarize_predicted_miss,
)
from app.services.tcm_planner import compute_propellant_used_kg, synthesize_tcm_delta_v

MAX_NAVIGATION_CHECKPOINTS = 12
NAVIGATION_PROPAGATION_RTOL = 1e-7
NAVIGATION_PROPAGATION_ATOL = 1e-7


@dataclass(frozen=True)
class EncounterTarget:
    body_id: str
    epoch: str
    epoch_seconds: float
    position_km: Tuple[float, float, float]
    kind: str


@dataclass(frozen=True)
class NavigationSimulationResult:
    active_samples: List[Dict[str, object]]
    navigation_telemetry: Dict[str, object]


class NavigationSimulator:
    def simulate(
        self,
        *,
        launch_epoch: str,
        nominal_initial_state: Sequence[float],
        nominal_samples: Sequence[Dict[str, object]],
        acceleration_fn: Callable[[float, np.ndarray], np.ndarray],
        navigation_config: NavigationConfig,
        encounter_targets: Sequence[EncounterTarget],
        propulsion_config: Optional[PropulsionConfig] = None,
        sample_step_seconds: Optional[float] = None,
    ) -> NavigationSimulationResult:
        nominal_state = np.array(nominal_initial_state, dtype=float, copy=True)
        if nominal_state.shape[0] not in (6, 7):
            raise ValueError("nominal_initial_state must contain 6 or 7 elements")
        if not nominal_samples:
            raise ValueError("nominal_samples must not be empty")

        dispersed = apply_navigation_dispersion(
            nominal_state[:6],
            position_sigma_km=navigation_config.injectionDispersion.positionSigmaKm,
            velocity_sigma_km_per_s=navigation_config.injectionDispersion.velocitySigmaKmPerS,
            seed=navigation_config.randomSeed,
        )
        current_state = dispersed.state_vector
        if nominal_state.shape[0] == 7:
            current_state = np.concatenate((current_state, nominal_state[6:7]))

        current_mass_kg = (
            float(current_state[6])
            if current_state.shape[0] == 7
            else float(propulsion_config.initialMassKg)
            if propulsion_config is not None
            else None
        )

        initial_deviation = compute_state_deviation(
            nominal_state=nominal_state[:6],
            actual_state=current_state[:6],
        )
        navigation_events: List[Dict[str, object]] = [
            {
                "type": "dispersionInjected",
                "epoch": launch_epoch,
                "positionDeviationBeforeKm": initial_deviation.position_deviation_km,
                "velocityDeviationBeforeKmPerS": initial_deviation.velocity_deviation_km_per_s,
            }
        ]

        total_duration_seconds = float(nominal_samples[-1]["epochSeconds"])
        step_seconds = float(
            sample_step_seconds
            or nominal_samples[1]["epochSeconds"] - nominal_samples[0]["epochSeconds"]
            if len(nominal_samples) > 1
            else navigation_config.correctionPolicy.checkpointStepSeconds
        )
        checkpoint_offsets = _build_checkpoint_offsets(
            total_duration_seconds=total_duration_seconds,
            checkpoint_step_seconds=navigation_config.correctionPolicy.checkpointStepSeconds,
            encounter_targets=encounter_targets,
            nominal_samples=nominal_samples,
        )

        dispersed_samples: List[Dict[str, object]] = []
        current_offset = 0.0
        tcm_count = 0
        cumulative_delta_v_km_per_s = 0.0
        max_predicted_miss_km = 0.0
        max_position_deviation_km = initial_deviation.position_deviation_km
        max_velocity_deviation_km_per_s = initial_deviation.velocity_deviation_km_per_s
        final_predicted_miss_km: Optional[float] = None

        for checkpoint_offset in checkpoint_offsets[1:]:
            arc = propagate_state(
                initial_state=current_state,
                t_span=(current_offset, checkpoint_offset),
                sample_step_s=max(min(step_seconds, max(checkpoint_offset - current_offset, 1e-6)), 1e-6),
                acceleration_fn=acceleration_fn,
                rtol=NAVIGATION_PROPAGATION_RTOL,
                atol=NAVIGATION_PROPAGATION_ATOL,
            )
            dispersed_samples = _append_serialized_samples(dispersed_samples, arc)
            current_state = _sample_to_state_vector(arc.samples[-1])
            current_offset = checkpoint_offset

            nominal_reference = _nearest_nominal_sample(nominal_samples, current_offset)
            deviation = compute_state_deviation(
                nominal_state=_sample_to_state_vector_dict(nominal_reference),
                actual_state=current_state[:6],
            )
            max_position_deviation_km = max(max_position_deviation_km, deviation.position_deviation_km)
            max_velocity_deviation_km_per_s = max(
                max_velocity_deviation_km_per_s,
                deviation.velocity_deviation_km_per_s,
            )

            next_encounter = _next_encounter(encounter_targets, current_offset)
            if next_encounter is None:
                continue
            encounter_nominal = _nearest_nominal_sample(nominal_samples, next_encounter.epoch_seconds)

            predicted_miss_km = _estimate_predicted_miss(
                state_vector=current_state,
                start_offset_seconds=current_offset,
                current_nominal_state=_sample_to_state_vector_dict(nominal_reference),
                encounter_nominal_state=_sample_to_state_vector_dict(encounter_nominal),
                encounter_target=next_encounter,
            )
            max_predicted_miss_km = max(max_predicted_miss_km, predicted_miss_km)
            final_predicted_miss_km = predicted_miss_km

            breach_reason = classify_breach_reason(
                predicted_miss_km=predicted_miss_km,
                predicted_miss_threshold_km=navigation_config.correctionPolicy.predictedMissThresholdKm,
                position_deviation_km=deviation.position_deviation_km,
                position_threshold_km=navigation_config.correctionPolicy.positionDeviationThresholdKm,
                velocity_deviation_km_per_s=deviation.velocity_deviation_km_per_s,
                velocity_threshold_km_per_s=navigation_config.correctionPolicy.velocityDeviationThresholdKmPerS,
            )
            if breach_reason is None or tcm_count >= navigation_config.correctionPolicy.maxTcmCount:
                continue

            navigation_events.append(
                {
                    "type": "tcmTriggered",
                    "epoch": _epoch_with_offset(launch_epoch, current_offset),
                    "reason": breach_reason,
                    "predictedMissBeforeKm": predicted_miss_km,
                    "positionDeviationBeforeKm": deviation.position_deviation_km,
                    "velocityDeviationBeforeKmPerS": deviation.velocity_deviation_km_per_s,
                }
            )

            correction = synthesize_tcm_delta_v(
                velocity_error_km_per_s=current_state[3:6] - _sample_to_state_vector_dict(nominal_reference)[3:6],
                position_error_km=current_state[:3] - _sample_to_state_vector_dict(nominal_reference)[:3],
                predicted_miss_km=predicted_miss_km,
                max_delta_v_km_per_s=navigation_config.correctionPolicy.maxCorrectionDeltaVKmPerS,
            )
            current_state[3:6] += correction.delta_v_vector_km_per_s
            cumulative_delta_v_km_per_s += correction.delta_v_km_per_s
            tcm_count += 1

            propellant_used_kg = compute_propellant_used_kg(
                delta_v_km_per_s=correction.delta_v_km_per_s,
                mass_kg=current_mass_kg or 0.0,
                propulsion_config=propulsion_config,
            )
            if current_mass_kg is not None and propellant_used_kg is not None:
                current_mass_kg = max(current_mass_kg - propellant_used_kg, 0.0)
                if current_state.shape[0] == 7:
                    current_state[6] = current_mass_kg

            corrected_deviation = compute_state_deviation(
                nominal_state=_sample_to_state_vector_dict(nominal_reference),
                actual_state=current_state[:6],
            )
            corrected_predicted_miss_km = _estimate_predicted_miss(
                state_vector=current_state,
                start_offset_seconds=current_offset,
                current_nominal_state=_sample_to_state_vector_dict(nominal_reference),
                encounter_nominal_state=_sample_to_state_vector_dict(encounter_nominal),
                encounter_target=next_encounter,
            )
            max_predicted_miss_km = max(max_predicted_miss_km, corrected_predicted_miss_km)
            final_predicted_miss_km = corrected_predicted_miss_km
            max_position_deviation_km = max(max_position_deviation_km, corrected_deviation.position_deviation_km)
            max_velocity_deviation_km_per_s = max(
                max_velocity_deviation_km_per_s,
                corrected_deviation.velocity_deviation_km_per_s,
            )

            navigation_events.append(
                {
                    "type": "tcmExecuted",
                    "epoch": _epoch_with_offset(launch_epoch, current_offset),
                    "reason": breach_reason,
                    "predictedMissBeforeKm": predicted_miss_km,
                    "predictedMissAfterKm": corrected_predicted_miss_km,
                    "positionDeviationBeforeKm": deviation.position_deviation_km,
                    "positionDeviationAfterKm": corrected_deviation.position_deviation_km,
                    "velocityDeviationBeforeKmPerS": deviation.velocity_deviation_km_per_s,
                    "velocityDeviationAfterKmPerS": corrected_deviation.velocity_deviation_km_per_s,
                    "deltaVKmPerS": correction.delta_v_km_per_s,
                    "propellantUsedKg": propellant_used_kg,
                }
            )

        navigation_telemetry = {
            "enabled": True,
            "nominalSamples": [dict(sample) for sample in nominal_samples],
            "dispersedSamples": dispersed_samples,
            "navigationEvents": navigation_events,
            "tcmCount": tcm_count,
            "cumulativeCorrectionDeltaVKmPerS": cumulative_delta_v_km_per_s,
            "maxPredictedMissKm": max_predicted_miss_km,
            "maxPositionDeviationKm": max_position_deviation_km,
            "maxVelocityDeviationKmPerS": max_velocity_deviation_km_per_s,
            "finalPredictedMissKm": final_predicted_miss_km,
        }
        return NavigationSimulationResult(
            active_samples=dispersed_samples,
            navigation_telemetry=navigation_telemetry,
        )


def _build_checkpoint_offsets(
    *,
    total_duration_seconds: float,
    checkpoint_step_seconds: float,
    encounter_targets: Sequence[EncounterTarget],
    nominal_samples: Sequence[Dict[str, object]],
) -> List[float]:
    checkpoints = {0.0, total_duration_seconds}
    if checkpoint_step_seconds > 0:
        candidate_offsets: List[float] = []
        last_checkpoint = 0.0
        for sample in nominal_samples:
            sample_offset = float(sample["epochSeconds"])
            if sample_offset <= 0.0 or sample_offset >= total_duration_seconds:
                continue
            if sample_offset - last_checkpoint >= checkpoint_step_seconds:
                candidate_offsets.append(sample_offset)
                last_checkpoint = sample_offset
        max_intermediate_checkpoints = max(MAX_NAVIGATION_CHECKPOINTS - 2, 1)
        if len(candidate_offsets) > max_intermediate_checkpoints:
            stride = int(np.ceil(len(candidate_offsets) / max_intermediate_checkpoints))
            candidate_offsets = candidate_offsets[::stride]
        checkpoints.update(candidate_offsets)
    checkpoints.update(
        min(total_duration_seconds, float(target.epoch_seconds))
        for target in encounter_targets
        if 0.0 <= float(target.epoch_seconds) <= total_duration_seconds
    )
    return sorted(checkpoints)


def _append_serialized_samples(
    existing_samples: List[Dict[str, object]],
    propagation: PropagationResult,
) -> List[Dict[str, object]]:
    serialized: List[Dict[str, object]] = list(existing_samples)
    for index, sample in enumerate(propagation.samples):
        if serialized and index == 0:
            continue
        payload: Dict[str, object] = {
            "epochSeconds": sample.epoch_seconds,
            "positionKm": list(sample.position_km),
            "velocityKmPerSec": list(sample.velocity_km_per_s),
        }
        if sample.mass_kg is not None:
            payload["massKg"] = sample.mass_kg
        serialized.append(payload)
    return serialized


def _sample_to_state_vector(sample) -> np.ndarray:
    values = [
        *sample.position_km,
        *sample.velocity_km_per_s,
    ]
    if sample.mass_kg is not None:
        values.append(sample.mass_kg)
    return np.array(values, dtype=float)


def _sample_to_state_vector_dict(sample: Dict[str, object]) -> np.ndarray:
    values = [
        *sample["positionKm"],
        *sample["velocityKmPerSec"],
    ]
    mass_kg = sample.get("massKg")
    if mass_kg is not None:
        values.append(mass_kg)
    return np.array(values, dtype=float)


def _nearest_nominal_sample(nominal_samples: Sequence[Dict[str, object]], epoch_seconds: float) -> Dict[str, object]:
    return min(
        nominal_samples,
        key=lambda sample: abs(float(sample["epochSeconds"]) - epoch_seconds),
    )


def _next_encounter(
    encounter_targets: Sequence[EncounterTarget],
    current_offset: float,
) -> Optional[EncounterTarget]:
    future_targets = [
        target for target in encounter_targets if float(target.epoch_seconds) > current_offset + 1e-9
    ]
    if not future_targets:
        return None
    return min(future_targets, key=lambda target: target.epoch_seconds)


def _estimate_predicted_miss(
    *,
    state_vector: np.ndarray,
    start_offset_seconds: float,
    current_nominal_state: np.ndarray,
    encounter_nominal_state: np.ndarray,
    encounter_target: EncounterTarget,
) -> float:
    if encounter_target.epoch_seconds <= start_offset_seconds:
        return float(
            np.linalg.norm(np.array(state_vector[:3], dtype=float) - np.array(encounter_target.position_km, dtype=float))
        )
    time_to_go = float(encounter_target.epoch_seconds - start_offset_seconds)
    position_error_km = np.array(state_vector[:3], dtype=float) - np.array(current_nominal_state[:3], dtype=float)
    velocity_error_km_per_s = np.array(state_vector[3:6], dtype=float) - np.array(current_nominal_state[3:6], dtype=float)
    predicted_position_km = (
        np.array(encounter_nominal_state[:3], dtype=float)
        + position_error_km
        + velocity_error_km_per_s * time_to_go
    )
    return summarize_predicted_miss(
        sample_positions_km=[list(predicted_position_km)],
        body_positions_km=[list(encounter_target.position_km)],
    )


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
