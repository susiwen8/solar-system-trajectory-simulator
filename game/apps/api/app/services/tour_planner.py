from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import permutations
from typing import Dict, List, Optional, Sequence, Set, Tuple

import numpy as np

from app.core.constants import PLANETARY_BODY_RADII_KM
from app.core.dynamics.acceleration import combined_point_mass_acceleration
from app.core.dynamics.events import compute_closest_approach
from app.core.dynamics.flyby import SAFETY_ALTITUDE_KM
from app.core.ephemeris.interpolated_cache import (
    InterpolatedEphemerisCache,
    recommended_cache_step_seconds,
)
from app.schemas.mission import NavigationConfig, PropulsionConfig
from app.services.arrival_capture_planner import ArrivalCapturePlanner
from app.services.flyby_planner import FlybyPlanner
from app.services.gravity_assist_search import (
    GravityAssistCandidate,
    GravityAssistEstimate,
    GravityAssistSearchService,
)
from app.services.maneuver_planner import ManeuverPlanner
from app.services.mission_segments import merge_segment_events, segment_to_dict
from app.services.navigation_simulator import EncounterTarget, NavigationSimulator
from app.services.mission_timeline import build_mission_timeline

@dataclass(frozen=True)
class TourLeg:
    start_body: str
    end_body: str
    assist_bodies: Tuple[str, ...]
    duration_seconds: float
    delta_v_km_per_s: float
    closest_approach_km: float

    def to_dict(self) -> Dict[str, object]:
        return {
            "startBody": self.start_body,
            "endBody": self.end_body,
            "assistBodies": list(self.assist_bodies),
            "durationSeconds": self.duration_seconds,
            "deltaVKmPerS": self.delta_v_km_per_s,
            "closestApproachKm": self.closest_approach_km,
        }


@dataclass(frozen=True)
class VisitEvent:
    body_id: str
    epoch: str
    position_km: Tuple[float, float, float]

    def to_dict(self) -> Dict[str, object]:
        return {
            "bodyId": self.body_id,
            "epoch": self.epoch,
            "positionKm": list(self.position_km),
        }


@dataclass(frozen=True)
class MissionTourCandidate:
    visit_order: Tuple[str, ...]
    full_sequence_bodies: Tuple[str, ...]
    legs: Tuple[TourLeg, ...]
    visit_events: Tuple[VisitEvent, ...]
    flyby_events: Tuple[dict, ...]
    total_flight_time_seconds: float
    total_delta_v_km_per_s: float
    score: float
    samples: List[dict]
    warnings: Tuple[str, ...]
    closest_approach: Dict[str, object]
    segments: Optional[Tuple[dict, ...]] = None
    maneuver_events: Optional[Tuple[dict, ...]] = None
    final_mass_kg: Optional[float] = None
    total_propellant_used_kg: Optional[float] = None
    propulsion_config: Optional[Dict[str, float]] = None
    navigation_telemetry: Optional[Dict[str, object]] = None
    mission_timeline: Optional[Dict[str, object]] = None

    def to_dict(self) -> Dict[str, object]:
        payload = {
            "visitOrder": list(self.visit_order),
            "fullSequenceBodies": list(self.full_sequence_bodies),
            "legs": [leg.to_dict() for leg in self.legs],
            "visitEvents": [event.to_dict() for event in self.visit_events],
            "flybyEvents": list(self.flyby_events),
            "flightTimeSeconds": self.total_flight_time_seconds,
            "deltaVKmPerS": self.total_delta_v_km_per_s,
            "score": self.score,
            "samples": self.samples,
            "warnings": list(self.warnings),
            "closestApproach": self.closest_approach,
        }
        if self.segments is not None:
            payload["segments"] = list(self.segments)
        if self.maneuver_events is not None:
            payload["maneuverEvents"] = list(self.maneuver_events)
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
        return payload


@dataclass(frozen=True)
class MissionTourEstimate:
    visit_order: Tuple[str, ...]
    full_sequence_bodies: Tuple[str, ...]
    total_flight_time_seconds: float
    total_delta_v_km_per_s: float
    score: float


class MissionTourPlanner:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.gravity_assist_search = GravityAssistSearchService(ephemeris)
        self.arrival_capture_planner = ArrivalCapturePlanner()
        self.maneuver_planner = ManeuverPlanner()
        self.flyby_planner = FlybyPlanner()

    def plan_tour(
        self,
        *,
        departure_body: str,
        required_visit_bodies: Sequence[str],
        launch_epoch: str,
        max_assist_bodies_per_leg: int = 2,
        max_returned_candidates: int = 5,
        allow_assist_bodies: bool = True,
        allow_repeated_flybys: bool = True,
        return_to_departure: bool = False,
        propulsion_config: Optional[PropulsionConfig] = None,
        navigation_config: Optional[NavigationConfig] = None,
    ) -> List[MissionTourCandidate]:
        visit_orders = self._generate_visit_orders(required_visit_bodies)
        candidates: List[MissionTourCandidate] = []
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistCandidate, ...]] = {}

        for visit_order in visit_orders:
            candidate = self._build_candidate_for_visit_order(
                departure_body=departure_body,
                visit_order=visit_order,
                launch_epoch=launch_epoch,
                max_assist_bodies_per_leg=max_assist_bodies_per_leg if allow_assist_bodies else 0,
                allow_repeated_flybys=allow_repeated_flybys,
                return_to_departure=return_to_departure,
                propulsion_config=propulsion_config,
                navigation_config=navigation_config,
                leg_candidate_cache=leg_candidate_cache,
            )
            if candidate is not None:
                candidates.append(candidate)

        return sorted(candidates, key=lambda candidate: candidate.score)[:max_returned_candidates]

    def estimate_tour_candidates(
        self,
        *,
        departure_body: str,
        required_visit_bodies: Sequence[str],
        launch_epoch: str,
        max_assist_bodies_per_leg: int = 2,
        max_returned_candidates: int = 5,
        allow_assist_bodies: bool = True,
        allow_repeated_flybys: bool = True,
        return_to_departure: bool = False,
        propulsion_config: Optional[PropulsionConfig] = None,
    ) -> List[MissionTourEstimate]:
        del propulsion_config
        visit_orders = self._generate_visit_orders(required_visit_bodies)
        estimates: List[MissionTourEstimate] = []
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistCandidate, ...]] = {}

        for visit_order in visit_orders:
            candidate = self._estimate_candidate_for_visit_order(
                departure_body=departure_body,
                visit_order=visit_order,
                launch_epoch=launch_epoch,
                max_assist_bodies_per_leg=max_assist_bodies_per_leg if allow_assist_bodies else 0,
                allow_repeated_flybys=allow_repeated_flybys,
                return_to_departure=return_to_departure,
                leg_candidate_cache=leg_candidate_cache,
            )
            if candidate is not None:
                estimates.append(candidate)

        return sorted(estimates, key=lambda candidate: candidate.score)[:max_returned_candidates]

    def _generate_visit_orders(self, required_visit_bodies: Sequence[str]) -> List[Tuple[str, ...]]:
        return sorted(
            (tuple(order) for order in permutations(required_visit_bodies)),
            key=self._visit_order_priority,
        )

    def _visit_order_priority(self, visit_order: Tuple[str, ...]) -> Tuple[float, Tuple[str, ...]]:
        orbital_order = {
            "mercury": 1,
            "venus": 2,
            "earth": 3,
            "mars": 4,
            "jupiter": 5,
            "saturn": 6,
            "uranus": 7,
            "neptune": 8,
        }
        reversal_penalty = 0.0
        for left, right in zip(visit_order[:-1], visit_order[1:]):
            if orbital_order[left] > orbital_order[right]:
                reversal_penalty += (orbital_order[left] - orbital_order[right]) * 6.0
        return (reversal_penalty, visit_order)

    def _build_candidate_for_visit_order(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        allow_repeated_flybys: bool,
        return_to_departure: bool,
        propulsion_config: Optional[PropulsionConfig],
        navigation_config: Optional[NavigationConfig],
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistCandidate, ...]],
    ) -> Optional[MissionTourCandidate]:
        mission_targets = self._mission_targets(
            departure_body=departure_body,
            visit_order=visit_order,
            return_to_departure=return_to_departure,
        )
        leg_candidates = self._plan_leg_candidates_for_visit_order(
            departure_body=departure_body,
            visit_order=visit_order,
            mission_targets=mission_targets,
            launch_epoch=launch_epoch,
            max_assist_bodies_per_leg=max_assist_bodies_per_leg,
            allow_repeated_flybys=allow_repeated_flybys,
            leg_candidate_cache=leg_candidate_cache,
        )
        if leg_candidates is None:
            return None

        return self._assemble_candidate(
            departure_body=departure_body,
            visit_order=visit_order,
            mission_targets=mission_targets,
            launch_epoch=launch_epoch,
            leg_candidates=leg_candidates,
            propulsion_config=propulsion_config,
            navigation_config=navigation_config,
        )

    def _estimate_candidate_for_visit_order(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        allow_repeated_flybys: bool,
        return_to_departure: bool,
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistEstimate, ...]],
    ) -> Optional[MissionTourEstimate]:
        mission_targets = self._mission_targets(
            departure_body=departure_body,
            visit_order=visit_order,
            return_to_departure=return_to_departure,
        )
        leg_candidates = self._plan_estimate_leg_candidates_for_visit_order(
            departure_body=departure_body,
            visit_order=visit_order,
            mission_targets=mission_targets,
            launch_epoch=launch_epoch,
            max_assist_bodies_per_leg=max_assist_bodies_per_leg,
            allow_repeated_flybys=allow_repeated_flybys,
            leg_candidate_cache=leg_candidate_cache,
        )
        if leg_candidates is None:
            return None

        return self._summarize_candidate(
            departure_body=departure_body,
            visit_order=visit_order,
            leg_candidates=leg_candidates,
        )

    def _plan_estimate_leg_candidates_for_visit_order(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        mission_targets: Tuple[str, ...],
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        allow_repeated_flybys: bool,
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistEstimate, ...]],
    ) -> Optional[Tuple[GravityAssistEstimate, ...]]:
        current_body = departure_body
        current_epoch = launch_epoch
        leg_candidates: List[GravityAssistEstimate] = []

        for target_body in mission_targets:
            leg_candidate = self._select_leg_estimate_candidate(
                departure_body=current_body,
                target_body=target_body,
                launch_epoch=current_epoch,
                max_assist_bodies_per_leg=max_assist_bodies_per_leg,
                used_bodies=self._used_bodies_for_tour(visit_order, leg_candidates) if not allow_repeated_flybys else set(),
                leg_candidate_cache=leg_candidate_cache,
            )
            if leg_candidate is None:
                return None
            leg_candidates.append(leg_candidate)
            current_body = target_body
            current_epoch = _epoch_with_offset(current_epoch, leg_candidate.total_flight_time_seconds)

        return tuple(leg_candidates)

    def _plan_leg_candidates_for_visit_order(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        mission_targets: Tuple[str, ...],
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        allow_repeated_flybys: bool,
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistCandidate, ...]],
    ) -> Optional[Tuple[GravityAssistCandidate, ...]]:
        current_body = departure_body
        current_epoch = launch_epoch
        leg_candidates: List[GravityAssistCandidate] = []

        for target_body in mission_targets:
            leg_candidate = self._select_leg_candidate(
                departure_body=current_body,
                target_body=target_body,
                launch_epoch=current_epoch,
                max_assist_bodies_per_leg=max_assist_bodies_per_leg,
                used_bodies=self._used_bodies_for_tour(visit_order, leg_candidates) if not allow_repeated_flybys else set(),
                leg_candidate_cache=leg_candidate_cache,
            )
            if leg_candidate is None:
                return None
            leg_candidates.append(leg_candidate)
            current_body = target_body
            current_epoch = _epoch_with_offset(current_epoch, leg_candidate.total_flight_time_seconds)

        return tuple(leg_candidates)

    def _mission_targets(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        return_to_departure: bool,
    ) -> Tuple[str, ...]:
        if return_to_departure and visit_order:
            return visit_order + (departure_body,)
        return visit_order

    def _select_leg_candidate(
        self,
        *,
        departure_body: str,
        target_body: str,
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        used_bodies: Set[str],
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistCandidate, ...]],
    ) -> Optional[GravityAssistCandidate]:
        cache_key = (
            departure_body,
            target_body,
            launch_epoch,
            max_assist_bodies_per_leg,
        )
        if cache_key not in leg_candidate_cache:
            leg_candidate_cache[cache_key] = tuple(
                self.gravity_assist_search.search(
                    departure_body=departure_body,
                    target_body=target_body,
                    launch_epoch=launch_epoch,
                    max_flybys=max_assist_bodies_per_leg,
                    candidate_limit=3,
                    sequence_budget=18,
                )
            )
        candidates = leg_candidate_cache[cache_key]
        for candidate in candidates:
            assist_bodies = set(candidate.sequence_bodies[1:-1])
            if used_bodies and assist_bodies.intersection(used_bodies):
                continue
            return candidate
        return None

    def _select_leg_estimate_candidate(
        self,
        *,
        departure_body: str,
        target_body: str,
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        used_bodies: Set[str],
        leg_candidate_cache: Dict[Tuple[str, str, str, int], Tuple[GravityAssistEstimate, ...]],
    ) -> Optional[GravityAssistEstimate]:
        cache_key = (
            departure_body,
            target_body,
            launch_epoch,
            max_assist_bodies_per_leg,
        )
        if cache_key not in leg_candidate_cache:
            leg_candidate_cache[cache_key] = tuple(
                self.gravity_assist_search.search_estimates(
                    departure_body=departure_body,
                    target_body=target_body,
                    launch_epoch=launch_epoch,
                    max_flybys=max_assist_bodies_per_leg,
                    candidate_limit=3,
                    sequence_budget=18,
                )
            )
        candidates = leg_candidate_cache[cache_key]
        for candidate in candidates:
            assist_bodies = set(candidate.sequence_bodies[1:-1])
            if used_bodies and assist_bodies.intersection(used_bodies):
                continue
            return candidate
        return None

    def _summarize_candidate(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        leg_candidates: Sequence[GravityAssistCandidate],
    ) -> MissionTourEstimate:
        full_sequence_bodies: List[str] = [departure_body]
        total_flight_time_seconds = 0.0
        total_delta_v_km_per_s = 0.0
        flyby_count = 0

        for leg_candidate in leg_candidates:
            full_sequence_bodies.extend(leg_candidate.sequence_bodies[1:])
            total_flight_time_seconds += leg_candidate.total_flight_time_seconds
            total_delta_v_km_per_s += leg_candidate.delta_v_km_per_s
            flyby_count += len(leg_candidate.flyby_events)

        repeated_penalty = max(0, len(full_sequence_bodies) - len(set(full_sequence_bodies))) * 1.5
        total_days = total_flight_time_seconds / 86_400.0
        score = total_delta_v_km_per_s + total_days * 0.015 + flyby_count * 0.5 + repeated_penalty

        return MissionTourEstimate(
            visit_order=visit_order,
            full_sequence_bodies=tuple(full_sequence_bodies),
            total_flight_time_seconds=total_flight_time_seconds,
            total_delta_v_km_per_s=round(total_delta_v_km_per_s, 3),
            score=round(score, 3),
        )

    def _used_bodies_for_tour(
        self,
        visit_order: Sequence[str],
        leg_candidates: Sequence[GravityAssistCandidate],
    ) -> Set[str]:
        used = set(visit_order[: len(leg_candidates)])
        for candidate in leg_candidates:
            used.update(candidate.sequence_bodies[1:-1])
        return used

    def _assemble_candidate(
        self,
        *,
        departure_body: str,
        visit_order: Tuple[str, ...],
        mission_targets: Tuple[str, ...],
        launch_epoch: str,
        leg_candidates: Sequence[GravityAssistCandidate],
        propulsion_config: Optional[PropulsionConfig],
        navigation_config: Optional[NavigationConfig],
    ) -> MissionTourCandidate:
        full_sequence_bodies: List[str] = [departure_body]
        legs: List[TourLeg] = []
        visit_events: List[VisitEvent] = []
        flyby_events: List[dict] = []
        warnings: List[str] = []
        samples: List[dict] = []
        segments: List[dict] = []
        epoch_offset = 0.0
        score = 0.0
        total_delta_v = 0.0

        for index, leg_candidate in enumerate(leg_candidates):
            leg_sequence = leg_candidate.sequence_bodies
            full_sequence_bodies.extend(leg_sequence[1:])
            assist_bodies = tuple(leg_sequence[1:-1])
            legs.append(
                TourLeg(
                    start_body=leg_sequence[0],
                    end_body=leg_sequence[-1],
                    assist_bodies=assist_bodies,
                    duration_seconds=leg_candidate.total_flight_time_seconds,
                    delta_v_km_per_s=leg_candidate.delta_v_km_per_s,
                    closest_approach_km=float(leg_candidate.closest_approach["distanceKm"]),
                )
            )

            arrival_epoch = _epoch_with_offset(launch_epoch, epoch_offset + leg_candidate.total_flight_time_seconds)
            target_body = mission_targets[index]
            target_state = self.ephemeris.get_body_state(target_body, arrival_epoch)
            visit_events.append(
                VisitEvent(
                    body_id=target_body,
                    epoch=arrival_epoch,
                    position_km=tuple(target_state.position_km),
                )
            )

            for event in leg_candidate.flyby_events:
                flyby_events.append(event.to_dict())
                segments.append(
                    segment_to_dict(
                        self.flyby_planner.plan_segment(
                            body_id=event.body_id,
                            periapsis_epoch=event.epoch,
                            periapsis_altitude_km=event.periapsis_altitude_km,
                            turn_angle_deg=event.turn_angle_deg,
                            inbound_v_infinity_km_per_s=event.inbound_v_infinity_km_per_s,
                            outbound_v_infinity_km_per_s=event.outbound_v_infinity_km_per_s,
                            position_km=event.position_km,
                        )
                    )
                )

            for sample_index, sample in enumerate(leg_candidate.samples):
                if samples and sample_index == 0:
                    continue
                samples.append(
                    {
                        "epochSeconds": epoch_offset + float(sample["epochSeconds"]),
                        "positionKm": sample["positionKm"],
                        "velocityKmPerSec": sample["velocityKmPerSec"],
                    }
                )

            warnings.extend(leg_candidate.warnings)
            total_delta_v += leg_candidate.delta_v_km_per_s
            score += leg_candidate.score
            epoch_offset += leg_candidate.total_flight_time_seconds

        repeated_penalty = max(0, len(full_sequence_bodies) - len(set(full_sequence_bodies))) * 1.5
        total_days = epoch_offset / 86_400.0
        score = total_delta_v + total_days * 0.015 + len(flyby_events) * 0.5 + repeated_penalty

        if mission_targets and samples:
            final_target_body = mission_targets[-1]
            final_arrival_epoch = _epoch_with_offset(launch_epoch, epoch_offset)
            arrival_capture_plan = self.arrival_capture_planner.plan_capture(
                body_id=final_target_body,
                arrival_epoch=final_arrival_epoch,
                heliocentric_sample=_closest_sample(samples, epoch_offset),
                orbit_summary=_default_arrival_orbit_summary(final_target_body),
            )
            segments.extend(segment_to_dict(segment) for segment in arrival_capture_plan.segments)

        maneuver_events = None
        final_mass_kg = None
        total_propellant_used_kg = None
        propulsion_payload = None
        if propulsion_config is not None:
            correction_direction = None
            if len(samples) >= 2:
                correction_direction = tuple(
                    float(samples[-1]["positionKm"][index] - samples[-2]["positionKm"][index]) for index in range(3)
                )
            burn_segments = self.maneuver_planner.plan_candidate_windows(
                samples=samples,
                closest_epoch_seconds=float(epoch_offset),
                propulsion_config=propulsion_config,
                correction_direction=correction_direction,
            )
            maneuver_event_list = self.maneuver_planner.build_maneuver_events(
                launch_epoch=launch_epoch,
                propulsion_config=propulsion_config,
                burn_segments=burn_segments,
            )
            maneuver_events = tuple(maneuver_event_list)
            if maneuver_event_list:
                final_mass_kg = float(maneuver_event_list[-1]["massAfterKg"])
                total_propellant_used_kg = round(
                    propulsion_config.initialMassKg - final_mass_kg,
                    6,
                )
            propulsion_payload = propulsion_config.model_dump()

        candidate_samples = samples
        candidate_closest_approach = {
            "bodyId": mission_targets[-1],
            "distanceKm": float(legs[-1].closest_approach_km),
            "epochSeconds": float(epoch_offset),
        }
        navigation_telemetry = None
        if navigation_config is not None and navigation_config.enabled and candidate_samples:
            navigation_result = NavigationSimulator().simulate(
                launch_epoch=launch_epoch,
                nominal_initial_state=_sample_dict_to_state_vector(candidate_samples[0]),
                nominal_samples=[dict(sample) for sample in candidate_samples],
                acceleration_fn=self._build_acceleration_fn(
                    launch_epoch,
                    sample_step_seconds=(
                        float(candidate_samples[1]["epochSeconds"]) - float(candidate_samples[0]["epochSeconds"])
                        if len(candidate_samples) > 1
                        else navigation_config.correctionPolicy.checkpointStepSeconds
                    ),
                ),
                navigation_config=navigation_config,
                encounter_targets=self._build_navigation_targets(
                    launch_epoch=launch_epoch,
                    flyby_events=flyby_events,
                    visit_events=visit_events,
                ),
                propulsion_config=propulsion_config,
            )
            candidate_samples = navigation_result.active_samples
            navigation_telemetry = navigation_result.navigation_telemetry
            candidate_closest_approach = compute_closest_approach(
                candidate_samples,
                mission_targets[-1],
                self._target_samples_for_body(
                    body_id=mission_targets[-1],
                    launch_epoch=launch_epoch,
                    samples=candidate_samples,
                ),
            )

        return MissionTourCandidate(
            visit_order=visit_order,
            full_sequence_bodies=tuple(full_sequence_bodies),
            legs=tuple(legs),
            visit_events=tuple(visit_events),
            flyby_events=tuple(flyby_events),
            total_flight_time_seconds=epoch_offset,
            total_delta_v_km_per_s=round(total_delta_v, 3),
            score=round(score, 3),
            samples=candidate_samples,
            warnings=tuple(dict.fromkeys(warnings)),
            closest_approach=candidate_closest_approach,
            segments=tuple(segments),
            maneuver_events=maneuver_events,
            final_mass_kg=final_mass_kg,
            total_propellant_used_kg=total_propellant_used_kg,
            propulsion_config=propulsion_payload,
            navigation_telemetry=navigation_telemetry,
            mission_timeline=build_mission_timeline(
                launch_epoch=launch_epoch,
                flight_time_seconds=epoch_offset,
                target_body=mission_targets[-1],
                samples=candidate_samples,
                closest_approach=_materialize_closest_approach_epoch(
                    launch_epoch,
                    candidate_closest_approach,
                ),
                maneuver_events=list(maneuver_events) if maneuver_events is not None else None,
                flyby_events=flyby_events,
                visit_events=[event.to_dict() for event in visit_events],
                segment_events=merge_segment_events(segments),
                departure_body=departure_body,
            ),
        )

    def _build_acceleration_fn(
        self,
        launch_epoch: str,
        *,
        sample_step_seconds: Optional[float] = None,
    ):
        ephemeris_cache = InterpolatedEphemerisCache(
            ephemeris=self.ephemeris,
            base_epoch=launch_epoch,
            step_seconds=recommended_cache_step_seconds(sample_step_seconds or 3600.0),
        )

        def acceleration_fn(time_seconds: float, probe_position: np.ndarray) -> np.ndarray:
            return combined_point_mass_acceleration(
                ephemeris_cache.get_all_body_states(time_seconds),
                probe_position,
                minimum_radius_by_body_km=PLANETARY_BODY_RADII_KM,
            )

        return acceleration_fn

    def _build_navigation_targets(
        self,
        *,
        launch_epoch: str,
        flyby_events: Sequence[dict],
        visit_events: Sequence[VisitEvent],
    ) -> List[EncounterTarget]:
        encounter_targets: List[EncounterTarget] = []
        for event in flyby_events:
            encounter_targets.append(
                EncounterTarget(
                    body_id=str(event["bodyId"]),
                    epoch=str(event["epoch"]),
                    epoch_seconds=_seconds_between_epochs(launch_epoch, str(event["epoch"])),
                    position_km=tuple(float(value) for value in event["positionKm"]),
                    kind="flyby",
                )
            )
        for event in visit_events:
            encounter_targets.append(
                EncounterTarget(
                    body_id=event.body_id,
                    epoch=event.epoch,
                    epoch_seconds=_seconds_between_epochs(launch_epoch, event.epoch),
                    position_km=event.position_km,
                    kind="arrival",
                )
            )
        return sorted(encounter_targets, key=lambda target: target.epoch_seconds)

    def _target_samples_for_body(
        self,
        *,
        body_id: str,
        launch_epoch: str,
        samples: Sequence[dict],
    ) -> List[Dict[str, object]]:
        return [
            {
                "epochSeconds": sample["epochSeconds"],
                "positionKm": list(
                    self.ephemeris.get_body_state(
                        body_id,
                        _epoch_with_offset(launch_epoch, float(sample["epochSeconds"])),
                    ).position_km
                ),
            }
            for sample in samples
        ]


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _materialize_closest_approach_epoch(base_epoch: str, closest_approach: Dict[str, object]) -> Dict[str, object]:
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


def _seconds_between_epochs(start_epoch: str, end_epoch: str) -> float:
    start = datetime.fromisoformat(start_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    end = datetime.fromisoformat(end_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    return float((end - start).total_seconds())


def _default_arrival_orbit_summary(target_body: str) -> Dict[str, object]:
    body_radius_km = PLANETARY_BODY_RADII_KM[target_body]
    periapsis_altitude_km = SAFETY_ALTITUDE_KM.get(target_body, 1_000.0)
    return {
        "isBound": True,
        "periapsisKm": body_radius_km + periapsis_altitude_km,
        "apoapsisKm": body_radius_km + periapsis_altitude_km + 1_000.0,
        "inclinationDeg": 25.0,
    }
