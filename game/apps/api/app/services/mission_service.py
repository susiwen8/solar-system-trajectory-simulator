from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Union

import numpy as np

from app.core.constants import PLANETARY_BODY_RADII_KM
from app.core.dynamics.acceleration import combined_point_mass_acceleration
from app.core.dynamics.events import compute_closest_approach
from app.core.dynamics.propagator import PropagationResult, propagate_state
from app.schemas.mission import MissionRequest
from app.services.earth_escape_planner import EarthEscapePlanner
from app.services.gravity_assist_search import OUTER_TARGETS, GravityAssistSearchService
from app.services.maneuver_planner import ManeuverPlanner
from app.services.mission_segments import build_segment_boundary_state, segment_to_dict
from app.services.mission_timeline import build_mission_timeline
from app.services.parking_orbit_planner import ParkingOrbitPlanner
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
    maneuver_events: Optional[List[Dict[str, object]]] = None
    final_mass_kg: Optional[float] = None
    total_propellant_used_kg: Optional[float] = None
    propulsion_config: Optional[Dict[str, float]] = None
    mission_timeline: Optional[Dict[str, object]] = None
    segments: Optional[List[Dict[str, object]]] = None

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
        if self.maneuver_events is not None:
            payload["maneuverEvents"] = self.maneuver_events
        if self.final_mass_kg is not None:
            payload["finalMassKg"] = self.final_mass_kg
        if self.total_propellant_used_kg is not None:
            payload["totalPropellantUsedKg"] = self.total_propellant_used_kg
        if self.propulsion_config is not None:
            payload["propulsionConfig"] = self.propulsion_config
        if self.mission_timeline is not None:
            payload["missionTimeline"] = self.mission_timeline
        if self.segments is not None:
            payload["segments"] = self.segments
        return payload


class MissionService:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.transfer_planner = TransferPlanner(ephemeris)
        self.maneuver_planner = ManeuverPlanner()
        self.parking_orbit_planner = ParkingOrbitPlanner()
        self.earth_escape_planner = EarthEscapePlanner(ephemeris)

    def propagate(self, request: MissionRequest) -> MissionPropagationResult:
        planner_warnings: List[str] = []
        segment_payloads: Optional[List[Dict[str, object]]] = None
        if (
            request.initialState.launchFromBody is not None
            and request.targetBody in OUTER_TARGETS
            and request.propulsionConfig is None
        ):
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
                    mission_timeline=build_mission_timeline(
                        launch_epoch=request.launchEpoch,
                        flight_time_seconds=best_candidate.total_flight_time_seconds,
                        target_body=request.targetBody,
                        samples=best_candidate.samples,
                        closest_approach=_materialize_closest_approach_epoch(request.launchEpoch, best_candidate.closest_approach),
                        flyby_events=[event.to_dict() for event in best_candidate.flyby_events],
                        departure_body=request.departureBody,
                    ),
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
            parking_orbit_plan = self.parking_orbit_planner.plan_default_parking_orbit(
                launch_epoch=request.launchEpoch,
            )
            earth_escape_plan = self.earth_escape_planner.plan_escape(
                launch_epoch=request.launchEpoch,
                parking_final_state=parking_orbit_plan.final_state,
                target_body=request.targetBody,
            )
            plan = self.transfer_planner.plan_auto_transfer(
                departure_body=request.departureBody,
                target_body=request.targetBody,
                launch_epoch=request.launchEpoch,
            )
            initial_state = np.array(
                [
                    *earth_escape_plan.final_state["positionKm"],
                    *earth_escape_plan.final_state["velocityKmPerSec"],
                ],
                dtype=float,
            )
            duration_seconds = float(request.durationSeconds or plan.duration_seconds)
            output_step_seconds = float(request.outputStepSeconds or plan.output_step_seconds)
            planner_warnings = [
                f"Auto-transfer delta-v estimate: {plan.delta_v_km_per_s:.2f} km/s",
                f"Planned arrival miss distance estimate: {plan.miss_distance_km:.0f} km",
            ]
            segment_payloads = [
                segment_to_dict(parking_orbit_plan),
                segment_to_dict(earth_escape_plan),
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

        maneuver_events: Optional[List[Dict[str, object]]] = None
        final_mass_kg: Optional[float] = None
        total_propellant_used_kg: Optional[float] = None
        propulsion_config_payload: Optional[Dict[str, float]] = None

        if request.propulsionConfig is not None:
            correction_direction = tuple(
                float(target_samples[-1]["positionKm"][index] - samples[-1]["positionKm"][index]) for index in range(3)
            )
            burn_segments = self.maneuver_planner.plan_candidate_windows(
                samples=samples,
                closest_epoch_seconds=float(closest_approach["epochSeconds"]),
                propulsion_config=request.propulsionConfig,
                correction_direction=correction_direction,
            )

            maneuver_propagation = propagate_state(
                initial_state=np.concatenate(
                    (
                        initial_state,
                        np.array([request.propulsionConfig.initialMassKg], dtype=float),
                    )
                ),
                t_span=(0.0, duration_seconds),
                sample_step_s=output_step_seconds,
                acceleration_fn=acceleration_fn,
                burn_segments=burn_segments,
            )
            samples = self._serialize_samples(maneuver_propagation)
            target_samples = self._target_samples_for_request(request, samples)
            closest_approach = compute_closest_approach(samples, request.targetBody, target_samples)
            final_mass_kg = (
                float(maneuver_propagation.samples[-1].mass_kg)
                if maneuver_propagation.samples and maneuver_propagation.samples[-1].mass_kg is not None
                else None
            )
            total_propellant_used_kg = (
                round(request.propulsionConfig.initialMassKg - final_mass_kg, 6)
                if final_mass_kg is not None
                else None
            )
            maneuver_events = self.maneuver_planner.build_maneuver_events(
                launch_epoch=request.launchEpoch,
                propulsion_config=request.propulsionConfig,
                burn_segments=burn_segments,
            )
            propulsion_config_payload = request.propulsionConfig.model_dump()
            warnings = [
                *warnings,
                f"Finite-thrust planner scheduled {len(maneuver_events)} correction burns",
            ]

        return MissionPropagationResult(
            reference_frame="heliocentric-inertial",
            ephemeris_source=getattr(self.ephemeris, "source_name", "unknown"),
            samples=samples,
            closest_approach=closest_approach,
            flight_time_seconds=duration_seconds,
            warnings=warnings,
            maneuver_events=maneuver_events,
            final_mass_kg=final_mass_kg,
            total_propellant_used_kg=total_propellant_used_kg,
            propulsion_config=propulsion_config_payload,
            mission_timeline=build_mission_timeline(
                launch_epoch=request.launchEpoch,
                flight_time_seconds=duration_seconds,
                target_body=request.targetBody,
                samples=samples,
                closest_approach=_materialize_closest_approach_epoch(request.launchEpoch, closest_approach),
                maneuver_events=maneuver_events,
                departure_body=request.departureBody,
            ),
            segments=self._build_segments(
                request=request,
                segment_payloads=segment_payloads,
                samples=samples,
                duration_seconds=duration_seconds,
            ),
        )

    def _serialize_samples(self, propagation: PropagationResult) -> List[Dict[str, object]]:
        samples: List[Dict[str, object]] = []
        for sample in propagation.samples:
            payload: Dict[str, object] = {
                "epochSeconds": sample.epoch_seconds,
                "positionKm": list(sample.position_km),
                "velocityKmPerSec": list(sample.velocity_km_per_s),
            }
            if sample.mass_kg is not None:
                payload["massKg"] = sample.mass_kg
            samples.append(payload)
        return samples

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

    def _build_segments(
        self,
        *,
        request: MissionRequest,
        segment_payloads: Optional[List[Dict[str, object]]],
        samples: List[Dict[str, object]],
        duration_seconds: float,
    ) -> Optional[List[Dict[str, object]]]:
        if segment_payloads is None:
            return None

        cruise_start_epoch = request.launchEpoch
        cruise_end_epoch = _epoch_with_offset(request.launchEpoch, duration_seconds)
        segment_payloads.append(
            {
                "segmentType": "heliocentricCruise",
                "startEpoch": cruise_start_epoch,
                "endEpoch": cruise_end_epoch,
                "referenceFrame": "heliocentric-inertial",
                "samples": samples,
                "events": [],
                "warnings": [],
                "initialState": build_segment_boundary_state(
                    epoch=cruise_start_epoch,
                    reference_frame="heliocentric-inertial",
                    position_km=samples[0]["positionKm"],
                    velocity_km_per_s=samples[0]["velocityKmPerSec"],
                    reference_body_id="sun",
                ),
                "finalState": build_segment_boundary_state(
                    epoch=cruise_end_epoch,
                    reference_frame="heliocentric-inertial",
                    position_km=samples[-1]["positionKm"],
                    velocity_km_per_s=samples[-1]["velocityKmPerSec"],
                    reference_body_id="sun",
                ),
                "metadata": {
                    "targetBody": request.targetBody,
                },
            }
        )
        return segment_payloads

def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _materialize_closest_approach_epoch(
    base_epoch: str,
    closest_approach: Dict[str, Union[float, str]],
) -> Dict[str, Union[float, str]]:
    payload = dict(closest_approach)
    if "epochSeconds" in payload and "epoch" not in payload:
        payload["epoch"] = _epoch_with_offset(base_epoch, float(payload["epochSeconds"]))
    return payload
