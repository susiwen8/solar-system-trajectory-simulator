from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Union

import numpy as np

from app.core.constants import PLANETARY_BODY_RADII_KM
from app.core.dynamics.acceleration import combined_point_mass_acceleration
from app.core.dynamics.flyby import SAFETY_ALTITUDE_KM
from app.core.dynamics.events import compute_closest_approach
from app.core.dynamics.propagator import PropagationResult, propagate_state
from app.core.ephemeris.interpolated_cache import (
    InterpolatedEphemerisCache,
    recommended_cache_step_seconds,
)
from app.schemas.mission import MissionRequest, NavigationConfig
from app.services.arrival_capture_planner import ArrivalCapturePlanner
from app.services.cruise_planner import CruisePlanner
from app.services.earth_escape_planner import EarthEscapePlanner
from app.services.gravity_assist_search import OUTER_TARGETS, GravityAssistSearchService
from app.services.maneuver_planner import ManeuverPlanner
from app.services.mission_segments import merge_segment_events, segment_to_dict
from app.services.navigation_simulator import EncounterTarget, NavigationSimulator
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
    navigation_telemetry: Optional[Dict[str, object]] = None
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
        if self.navigation_telemetry is not None:
            payload["navigationTelemetry"] = self.navigation_telemetry
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
        self.cruise_planner = CruisePlanner()
        self.arrival_capture_planner = ArrivalCapturePlanner()

    def propagate(self, request: MissionRequest) -> MissionPropagationResult:
        navigation_config = _coerce_navigation_config(request.navigationConfig)
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

        ephemeris_cache = InterpolatedEphemerisCache(
            ephemeris=self.ephemeris,
            base_epoch=request.launchEpoch,
            step_seconds=recommended_cache_step_seconds(output_step_seconds),
        )

        def acceleration_fn(time_seconds: float, probe_position: np.ndarray) -> np.ndarray:
            return combined_point_mass_acceleration(
                ephemeris_cache.get_all_body_states(time_seconds),
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
        target_samples = self._target_samples_for_request(request, samples, ephemeris_cache=ephemeris_cache)
        closest_approach = compute_closest_approach(samples, request.targetBody, target_samples)
        warnings = planner_warnings + self._compute_warnings(samples)

        maneuver_events: Optional[List[Dict[str, object]]] = None
        final_mass_kg: Optional[float] = None
        total_propellant_used_kg: Optional[float] = None
        propulsion_config_payload: Optional[Dict[str, float]] = None
        navigation_telemetry: Optional[Dict[str, object]] = None

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
            target_samples = self._target_samples_for_request(request, samples, ephemeris_cache=ephemeris_cache)
            closest_approach = compute_closest_approach(samples, request.targetBody, target_samples)
            maneuver_events = self.maneuver_planner.build_maneuver_events(
                launch_epoch=request.launchEpoch,
                propulsion_config=request.propulsionConfig,
                burn_segments=burn_segments,
            )
            final_mass_kg = float(maneuver_events[-1]["massAfterKg"]) if maneuver_events else None
            total_propellant_used_kg = (
                round(float(maneuver_events[0]["massBeforeKg"]) - final_mass_kg, 6)
                if maneuver_events and final_mass_kg is not None
                else None
            )
            propulsion_config_payload = request.propulsionConfig.model_dump()
            warnings = [
                *warnings,
                f"Finite-thrust planner scheduled {len(maneuver_events)} correction burns",
            ]

        if navigation_config is not None and navigation_config.enabled and samples:
            encounter_target = self._build_navigation_target(
                request=request,
                closest_approach=closest_approach,
                ephemeris_cache=ephemeris_cache,
            )
            if encounter_target is not None:
                nominal_samples = [dict(sample) for sample in samples]
                navigation_result = NavigationSimulator().simulate(
                    launch_epoch=request.launchEpoch,
                    nominal_initial_state=_sample_dict_to_state_vector(nominal_samples[0]),
                    nominal_samples=nominal_samples,
                    acceleration_fn=acceleration_fn,
                    navigation_config=navigation_config,
                    encounter_targets=[encounter_target],
                    propulsion_config=request.propulsionConfig,
                    sample_step_seconds=output_step_seconds,
                )
                samples = navigation_result.active_samples
                navigation_telemetry = navigation_result.navigation_telemetry
                target_samples = self._target_samples_for_request(request, samples, ephemeris_cache=ephemeris_cache)
                closest_approach = compute_closest_approach(samples, request.targetBody, target_samples)
                warnings = planner_warnings + self._compute_warnings(samples)
                if request.propulsionConfig is not None and maneuver_events is not None:
                    warnings.append(f"Finite-thrust planner scheduled {len(maneuver_events)} correction burns")

        segments = self._build_segments(
            request=request,
            segment_payloads=segment_payloads,
            samples=samples,
            maneuver_events=maneuver_events,
            warnings=warnings,
            closest_approach=closest_approach,
        )

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
            navigation_telemetry=navigation_telemetry,
            mission_timeline=build_mission_timeline(
                launch_epoch=request.launchEpoch,
                flight_time_seconds=duration_seconds,
                target_body=request.targetBody,
                samples=samples,
                closest_approach=_materialize_closest_approach_epoch(request.launchEpoch, closest_approach),
                maneuver_events=maneuver_events,
                segment_events=merge_segment_events(segments or []),
                departure_body=request.departureBody,
            ),
            segments=segments,
        )

    def _build_navigation_target(
        self,
        *,
        request: MissionRequest,
        closest_approach: Dict[str, Union[float, str]],
        ephemeris_cache: InterpolatedEphemerisCache,
    ) -> Optional[EncounterTarget]:
        epoch_seconds = closest_approach.get("epochSeconds")
        if epoch_seconds is None:
            return None

        encounter_epoch = _epoch_with_offset(request.launchEpoch, float(epoch_seconds))
        body_state = ephemeris_cache.get_body_state(request.targetBody, float(epoch_seconds))
        return EncounterTarget(
            body_id=request.targetBody,
            epoch=encounter_epoch,
            epoch_seconds=float(epoch_seconds),
            position_km=tuple(body_state.position_km),
            kind="arrival",
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
        *,
        ephemeris_cache: InterpolatedEphemerisCache,
    ) -> List[Dict[str, object]]:
        return [
            {
                "epochSeconds": sample["epochSeconds"],
                "positionKm": list(
                    ephemeris_cache.get_body_state(
                        request.targetBody,
                        float(sample["epochSeconds"]),
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
        maneuver_events: Optional[List[Dict[str, object]]],
        warnings: List[str],
        closest_approach: Dict[str, Union[float, str]],
    ) -> Optional[List[Dict[str, object]]]:
        if segment_payloads is None:
            return None

        cruise_start_epoch = str(segment_payloads[-1]["endEpoch"]) if segment_payloads else request.launchEpoch
        cruise_plan = self.cruise_planner.plan_segment(
            launch_epoch=request.launchEpoch,
            start_epoch=cruise_start_epoch,
            target_body=request.targetBody,
            samples=samples,
            maneuver_events=maneuver_events,
            warnings=warnings,
            closest_approach=closest_approach,
        )
        segment_payloads.append(segment_to_dict(cruise_plan))
        arrival_capture_plan = self.arrival_capture_planner.plan_capture(
            body_id=request.targetBody,
            arrival_epoch=_epoch_with_offset(request.launchEpoch, float(closest_approach["epochSeconds"])),
            heliocentric_sample=_closest_sample(samples, float(closest_approach["epochSeconds"])),
            orbit_summary=_default_arrival_orbit_summary(request.targetBody),
        )
        segment_payloads.extend(segment_to_dict(segment) for segment in arrival_capture_plan.segments)
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


def _closest_sample(samples: List[Dict[str, object]], epoch_seconds: float) -> Dict[str, object]:
    return min(samples, key=lambda sample: abs(float(sample["epochSeconds"]) - epoch_seconds))


def _sample_dict_to_state_vector(sample: Dict[str, object]) -> np.ndarray:
    values = [
        *sample["positionKm"],
        *sample["velocityKmPerSec"],
    ]
    if sample.get("massKg") is not None:
        values.append(sample["massKg"])
    return np.array(values, dtype=float)


def _coerce_navigation_config(raw_navigation_config) -> Optional[NavigationConfig]:
    if raw_navigation_config is None:
        return None
    if isinstance(raw_navigation_config, NavigationConfig):
        return raw_navigation_config
    return NavigationConfig.model_validate(raw_navigation_config)


def _default_arrival_orbit_summary(target_body: str) -> Dict[str, object]:
    body_radius_km = PLANETARY_BODY_RADII_KM[target_body]
    periapsis_altitude_km = SAFETY_ALTITUDE_KM.get(target_body, 1_000.0)
    return {
        "isBound": True,
        "periapsisKm": body_radius_km + periapsis_altitude_km,
        "apoapsisKm": body_radius_km + periapsis_altitude_km + 1_000.0,
        "inclinationDeg": 25.0,
    }
