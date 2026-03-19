from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

from app.core.dynamics.thrust import BurnSegment
from app.core.dynamics.thrust import burn_mass_flow_kg_per_s
from app.schemas.mission import PropulsionConfig


class ManeuverPlanner:
    def validate_propulsion_config(self, propulsion_config: PropulsionConfig) -> None:
        if propulsion_config.propellantMassKg >= propulsion_config.initialMassKg:
            raise ValueError("Propellant mass must be less than initial mass")
        if propulsion_config.propellantMassKg / propulsion_config.initialMassKg > 0.8:
            raise ValueError("Propellant fraction is outside the phase-1 trusted range")

    def plan_candidate_windows(
        self,
        *,
        samples: Sequence[Dict[str, object]],
        closest_epoch_seconds: float,
        propulsion_config: PropulsionConfig,
        correction_direction: Optional[Tuple[float, float, float]] = None,
    ) -> List[BurnSegment]:
        self.validate_propulsion_config(propulsion_config)
        if not samples:
            return []

        total_flight_seconds = float(samples[-1]["epochSeconds"])
        if total_flight_seconds <= 0:
            return []

        candidate_specs = [
            ("TCM", min(total_flight_seconds * 0.08, closest_epoch_seconds * 0.25), 2.0 * 3600.0, "prograde"),
            ("DSM", total_flight_seconds * 0.52, 4.0 * 3600.0, "target-correction"),
            ("arrivalCorrection", min(total_flight_seconds * 0.9, closest_epoch_seconds * 0.98), 2.0 * 3600.0, "target-correction"),
        ]

        burns: List[BurnSegment] = []
        for burn_type, start_epoch_seconds, duration_seconds, direction_label in candidate_specs:
            sample = self._nearest_sample(samples, start_epoch_seconds)
            direction = self._direction_for_label(
                sample=sample,
                direction_label=direction_label,
                correction_direction=correction_direction,
            )
            burns.append(
                BurnSegment(
                    burn_type=burn_type,
                    start_epoch_seconds=float(max(start_epoch_seconds, 0.0)),
                    duration_seconds=float(duration_seconds),
                    thrust_newtons=float(propulsion_config.maxThrustN),
                    isp_seconds=float(propulsion_config.ispSeconds),
                    direction=direction,
                    direction_label=direction_label,
                )
            )

        return burns

    def build_maneuver_events(
        self,
        *,
        launch_epoch: str,
        propulsion_config: PropulsionConfig,
        burn_segments: Sequence[BurnSegment],
    ) -> List[Dict[str, float]]:
        current_mass_kg = float(propulsion_config.initialMassKg)
        events: List[Dict[str, float]] = []

        for burn_segment in burn_segments:
            propellant_used_kg = burn_mass_flow_kg_per_s(
                burn_segment.thrust_newtons,
                burn_segment.isp_seconds,
            ) * burn_segment.duration_seconds
            mass_after_kg = max(current_mass_kg - propellant_used_kg, 0.0)
            mean_mass_kg = max((current_mass_kg + mass_after_kg) / 2.0, 1e-9)
            delta_v_estimate_km_per_s = (
                (burn_segment.thrust_newtons / mean_mass_kg) * burn_segment.duration_seconds / 1000.0
            )
            events.append(
                {
                    "type": burn_segment.burn_type,
                    "startEpoch": _epoch_with_offset(launch_epoch, burn_segment.start_epoch_seconds),
                    "durationSeconds": burn_segment.duration_seconds,
                    "thrustDirection": burn_segment.direction_label,
                    "deltaVEstimateKmPerS": delta_v_estimate_km_per_s,
                    "propellantUsedKg": propellant_used_kg,
                    "massBeforeKg": current_mass_kg,
                    "massAfterKg": mass_after_kg,
                }
            )
            current_mass_kg = mass_after_kg

        return events

    def _nearest_sample(self, samples: Sequence[Dict[str, object]], epoch_seconds: float) -> Dict[str, object]:
        return min(samples, key=lambda sample: abs(float(sample["epochSeconds"]) - epoch_seconds))

    def _direction_for_label(
        self,
        *,
        sample: Dict[str, object],
        direction_label: str,
        correction_direction: Optional[Tuple[float, float, float]],
    ) -> Tuple[float, float, float]:
        if direction_label == "target-correction" and correction_direction is not None:
            return self._normalize(correction_direction)
        if direction_label == "retrograde":
            velocity = np.array(sample["velocityKmPerSec"], dtype=float)
            return tuple((-velocity / np.linalg.norm(velocity)).tolist())

        velocity = np.array(sample["velocityKmPerSec"], dtype=float)
        if np.linalg.norm(velocity) > 0:
            return tuple((velocity / np.linalg.norm(velocity)).tolist())

        return (1.0, 0.0, 0.0)

    def _normalize(self, direction: Tuple[float, float, float]) -> Tuple[float, float, float]:
        vector = np.array(direction, dtype=float)
        magnitude = float(np.linalg.norm(vector))
        if magnitude <= 0:
            return (1.0, 0.0, 0.0)
        return tuple((vector / magnitude).tolist())


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    from datetime import datetime, timedelta, timezone

    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
