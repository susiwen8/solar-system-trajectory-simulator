from dataclasses import dataclass
from typing import Dict, List, Union

import numpy as np

from app.core.dynamics.acceleration import point_mass_acceleration
from app.core.dynamics.events import compute_closest_approach
from app.core.dynamics.propagator import PropagationResult, propagate_state
from app.schemas.mission import MissionRequest


@dataclass(frozen=True)
class MissionPropagationResult:
    reference_frame: str
    samples: List[Dict[str, object]]
    closest_approach: Dict[str, Union[float, str]]
    flight_time_seconds: float
    warnings: List[str]

    def to_dict(self) -> Dict[str, object]:
        return {
            "referenceFrame": self.reference_frame,
            "samples": self.samples,
            "closestApproach": self.closest_approach,
            "flightTimeSeconds": self.flight_time_seconds,
            "warnings": self.warnings,
        }


class MissionService:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris

    def propagate(self, request: MissionRequest) -> MissionPropagationResult:
        if request.initialState.stateVector is None:
            raise ValueError("Only stateVector missions are supported right now")

        sun_state = self.ephemeris.get_body_state("sun", request.launchEpoch)
        target_state = self.ephemeris.get_body_state(request.targetBody, request.launchEpoch)
        initial_state = np.array(
            [
                *request.initialState.stateVector.positionKm,
                *request.initialState.stateVector.velocityKmPerSec,
            ],
            dtype=float,
        )

        def acceleration_fn(_: float, probe_position: np.ndarray) -> np.ndarray:
            return point_mass_acceleration(np.array(sun_state.position_km), probe_position, sun_state.mu_km3_per_s2)

        propagation = propagate_state(
            initial_state=initial_state,
            t_span=(0.0, request.durationSeconds),
            sample_step_s=request.outputStepSeconds,
            acceleration_fn=acceleration_fn,
        )
        samples = self._serialize_samples(propagation)
        closest_approach = compute_closest_approach(samples, request.targetBody, target_state.position_km)
        warnings = self._compute_warnings(samples)

        return MissionPropagationResult(
            reference_frame="heliocentric-inertial",
            samples=samples,
            closest_approach=closest_approach,
            flight_time_seconds=request.durationSeconds,
            warnings=warnings,
        )

    def _serialize_samples(self, propagation: PropagationResult) -> List[Dict[str, object]]:
        return [
            {
                "epochSeconds": sample.epoch_seconds,
                "positionKm": list(sample.position_km),
                "velocityKmPerSec": list(sample.velocity_km_per_s),
            }
            for sample in propagation.samples
        ]

    def _compute_warnings(self, samples: List[Dict[str, object]]) -> List[str]:
        if not samples:
            return ["No trajectory samples were produced"]
        return []
