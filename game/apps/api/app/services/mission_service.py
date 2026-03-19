from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Union

import numpy as np

from app.core.constants import PLANETARY_BODY_RADII_KM
from app.core.dynamics.acceleration import combined_point_mass_acceleration
from app.core.dynamics.events import compute_closest_approach
from app.core.dynamics.propagator import PropagationResult, propagate_state
from app.schemas.mission import MissionRequest
from app.services.gravity_assist_search import OUTER_TARGETS, GravityAssistSearchService
from app.services.transfer_planner import TransferPlanner


@dataclass(frozen=True)
class MissionPropagationResult:
    reference_frame: str
    ephemeris_source: str
    samples: List[Dict[str, object]]
    closest_approach: Dict[str, Union[float, str]]
    flight_time_seconds: float
    warnings: List[str]
    candidates: Optional[List[Dict[str, object]]] = None
    sequence_bodies: Optional[List[str]] = None
    score: Optional[float] = None
    delta_v_km_per_s: Optional[float] = None
    flyby_events: Optional[List[Dict[str, object]]] = None

    def to_dict(self) -> Dict[str, object]:
        payload = {
            "referenceFrame": self.reference_frame,
            "ephemerisSource": self.ephemeris_source,
            "samples": self.samples,
            "closestApproach": self.closest_approach,
            "flightTimeSeconds": self.flight_time_seconds,
            "warnings": self.warnings,
        }
        if self.candidates is not None:
            payload["candidates"] = self.candidates
        if self.sequence_bodies is not None:
            payload["sequenceBodies"] = self.sequence_bodies
        if self.score is not None:
            payload["score"] = self.score
        if self.delta_v_km_per_s is not None:
            payload["deltaVKmPerS"] = self.delta_v_km_per_s
        if self.flyby_events is not None:
            payload["flybyEvents"] = self.flyby_events
        return payload


class MissionService:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.transfer_planner = TransferPlanner(ephemeris)

    def propagate(self, request: MissionRequest) -> MissionPropagationResult:
        planner_warnings: List[str] = []
        if request.initialState.launchFromBody is not None and request.targetBody in OUTER_TARGETS:
            search_candidates = GravityAssistSearchService(self.ephemeris).search(
                departure_body=request.departureBody,
                target_body=request.targetBody,
                launch_epoch=request.launchEpoch,
            )
            if search_candidates:
                best_candidate = search_candidates[0]
                warnings = list(best_candidate.warnings)
                warnings.insert(0, f"Gravity-assist search returned {len(search_candidates)} ranked candidates")
                return MissionPropagationResult(
                    reference_frame="heliocentric-inertial",
                    ephemeris_source=getattr(self.ephemeris, "source_name", "unknown"),
                    samples=best_candidate.samples,
                    closest_approach=best_candidate.closest_approach,
                    flight_time_seconds=best_candidate.total_flight_time_seconds,
                    warnings=warnings,
                    candidates=[candidate.to_dict() for candidate in search_candidates],
                    sequence_bodies=list(best_candidate.sequence_bodies),
                    score=best_candidate.score,
                    delta_v_km_per_s=best_candidate.delta_v_km_per_s,
                    flyby_events=[event.to_dict() for event in best_candidate.flyby_events],
                )

        if request.initialState.stateVector is not None:
            initial_state = np.array(
                [
                    *request.initialState.stateVector.positionKm,
                    *request.initialState.stateVector.velocityKmPerSec,
                ],
                dtype=float,
            )
            duration_seconds = float(request.durationSeconds or 3.0 * 24.0 * 3600.0)
            output_step_seconds = float(request.outputStepSeconds or 6.0 * 3600.0)
        else:
            plan = self.transfer_planner.plan_auto_transfer(
                departure_body=request.departureBody,
                target_body=request.targetBody,
                launch_epoch=request.launchEpoch,
            )
            initial_state = plan.initial_state
            duration_seconds = float(request.durationSeconds or plan.duration_seconds)
            output_step_seconds = float(request.outputStepSeconds or plan.output_step_seconds)
            planner_warnings = [
                f"Auto-transfer delta-v estimate: {plan.delta_v_km_per_s:.2f} km/s",
                f"Planned arrival miss distance estimate: {plan.miss_distance_km:.0f} km",
            ]

        body_state_cache: Dict[str, list] = {}

        def acceleration_fn(time_seconds: float, probe_position: np.ndarray) -> np.ndarray:
            epoch = _epoch_with_offset(request.launchEpoch, time_seconds)
            if epoch not in body_state_cache:
                body_state_cache[epoch] = self.ephemeris.get_all_body_states(epoch)
            return combined_point_mass_acceleration(
                body_state_cache[epoch],
                probe_position,
                minimum_radius_by_body_km=PLANETARY_BODY_RADII_KM,
            )

        propagation = propagate_state(
            initial_state=initial_state,
            t_span=(0.0, duration_seconds),
            sample_step_s=output_step_seconds,
            acceleration_fn=acceleration_fn,
        )
        samples = self._serialize_samples(propagation)
        target_samples = self._target_samples_for_request(request, samples)
        closest_approach = compute_closest_approach(samples, request.targetBody, target_samples)
        warnings = planner_warnings + self._compute_warnings(samples)

        return MissionPropagationResult(
            reference_frame="heliocentric-inertial",
            ephemeris_source=getattr(self.ephemeris, "source_name", "unknown"),
            samples=samples,
            closest_approach=closest_approach,
            flight_time_seconds=duration_seconds,
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

        max_distance_km = max(
            sum(component * component for component in sample["positionKm"]) ** 0.5
            for sample in samples
        )
        warnings: List[str] = []
        if max_distance_km > 1_000_000_000:
            warnings.append("Probe distance exceeds the trusted phase-1 operating range")
        return warnings

    def _target_samples_for_request(
        self,
        request: MissionRequest,
        samples: List[Dict[str, object]],
    ) -> List[Dict[str, object]]:
        return [
            {
                "epochSeconds": sample["epochSeconds"],
                "positionKm": list(
                    self.ephemeris.get_body_state(
                        request.targetBody,
                        _epoch_with_offset(request.launchEpoch, sample["epochSeconds"]),
                    ).position_km
                ),
            }
            for sample in samples
        ]


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
