from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import permutations
from typing import Dict, List, Optional, Sequence, Set, Tuple

from app.schemas.mission import PropulsionConfig
from app.services.gravity_assist_search import GravityAssistCandidate, GravityAssistSearchService
from app.services.maneuver_planner import ManeuverPlanner
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
    maneuver_events: Optional[Tuple[dict, ...]] = None
    final_mass_kg: Optional[float] = None
    total_propellant_used_kg: Optional[float] = None
    propulsion_config: Optional[Dict[str, float]] = None
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
        if self.maneuver_events is not None:
            payload["maneuverEvents"] = list(self.maneuver_events)
        if self.final_mass_kg is not None:
            payload["finalMassKg"] = self.final_mass_kg
        if self.total_propellant_used_kg is not None:
            payload["totalPropellantUsedKg"] = self.total_propellant_used_kg
        if self.propulsion_config is not None:
            payload["propulsionConfig"] = self.propulsion_config
        if self.mission_timeline is not None:
            payload["missionTimeline"] = self.mission_timeline
        return payload


class MissionTourPlanner:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.gravity_assist_search = GravityAssistSearchService(ephemeris)
        self.maneuver_planner = ManeuverPlanner()

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
        propulsion_config: Optional[PropulsionConfig] = None,
    ) -> List[MissionTourCandidate]:
        visit_orders = self._generate_visit_orders(required_visit_bodies)
        candidates: List[MissionTourCandidate] = []

        for visit_order in visit_orders:
            candidate = self._build_candidate_for_visit_order(
                departure_body=departure_body,
                visit_order=visit_order,
                launch_epoch=launch_epoch,
                max_assist_bodies_per_leg=max_assist_bodies_per_leg if allow_assist_bodies else 0,
                allow_repeated_flybys=allow_repeated_flybys,
                propulsion_config=propulsion_config,
            )
            if candidate is not None:
                candidates.append(candidate)

        return sorted(candidates, key=lambda candidate: candidate.score)[:max_returned_candidates]

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
        propulsion_config: Optional[PropulsionConfig],
    ) -> Optional[MissionTourCandidate]:
        current_body = departure_body
        current_epoch = launch_epoch
        leg_candidates: List[GravityAssistCandidate] = []

        for visit_body in visit_order:
            leg_candidate = self._select_leg_candidate(
                departure_body=current_body,
                target_body=visit_body,
                launch_epoch=current_epoch,
                max_assist_bodies_per_leg=max_assist_bodies_per_leg,
                used_bodies=self._used_bodies_for_tour(visit_order, leg_candidates) if not allow_repeated_flybys else set(),
            )
            if leg_candidate is None:
                return None
            leg_candidates.append(leg_candidate)
            current_body = visit_body
            current_epoch = _epoch_with_offset(current_epoch, leg_candidate.total_flight_time_seconds)

        return self._assemble_candidate(
            departure_body=departure_body,
            visit_order=visit_order,
            launch_epoch=launch_epoch,
            leg_candidates=leg_candidates,
            propulsion_config=propulsion_config,
        )

    def _select_leg_candidate(
        self,
        *,
        departure_body: str,
        target_body: str,
        launch_epoch: str,
        max_assist_bodies_per_leg: int,
        used_bodies: Set[str],
    ) -> Optional[GravityAssistCandidate]:
        candidates = self.gravity_assist_search.search(
            departure_body=departure_body,
            target_body=target_body,
            launch_epoch=launch_epoch,
            max_flybys=max_assist_bodies_per_leg,
            candidate_limit=3,
            sequence_budget=18,
        )
        for candidate in candidates:
            assist_bodies = set(candidate.sequence_bodies[1:-1])
            if used_bodies and assist_bodies.intersection(used_bodies):
                continue
            return candidate
        return None

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
        launch_epoch: str,
        leg_candidates: Sequence[GravityAssistCandidate],
        propulsion_config: Optional[PropulsionConfig],
    ) -> MissionTourCandidate:
        full_sequence_bodies: List[str] = [departure_body]
        legs: List[TourLeg] = []
        visit_events: List[VisitEvent] = []
        flyby_events: List[dict] = []
        warnings: List[str] = []
        samples: List[dict] = []
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
            target_state = self.ephemeris.get_body_state(visit_order[index], arrival_epoch)
            visit_events.append(
                VisitEvent(
                    body_id=visit_order[index],
                    epoch=arrival_epoch,
                    position_km=tuple(target_state.position_km),
                )
            )

            for event in leg_candidate.flyby_events:
                flyby_events.append(event.to_dict())

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

        return MissionTourCandidate(
            visit_order=visit_order,
            full_sequence_bodies=tuple(full_sequence_bodies),
            legs=tuple(legs),
            visit_events=tuple(visit_events),
            flyby_events=tuple(flyby_events),
            total_flight_time_seconds=epoch_offset,
            total_delta_v_km_per_s=round(total_delta_v, 3),
            score=round(score, 3),
            samples=samples,
            warnings=tuple(dict.fromkeys(warnings)),
            closest_approach={
                "bodyId": visit_order[-1],
                "distanceKm": float(legs[-1].closest_approach_km),
                "epochSeconds": float(epoch_offset),
            },
            maneuver_events=maneuver_events,
            final_mass_kg=final_mass_kg,
            total_propellant_used_kg=total_propellant_used_kg,
            propulsion_config=propulsion_payload,
            mission_timeline=build_mission_timeline(
                launch_epoch=launch_epoch,
                flight_time_seconds=epoch_offset,
                target_body=visit_order[-1],
                samples=samples,
                closest_approach=_materialize_closest_approach_epoch(
                    launch_epoch,
                    {
                        "bodyId": visit_order[-1],
                        "distanceKm": float(legs[-1].closest_approach_km),
                        "epochSeconds": float(epoch_offset),
                    },
                ),
                maneuver_events=list(maneuver_events) if maneuver_events is not None else None,
                flyby_events=flyby_events,
                visit_events=[event.to_dict() for event in visit_events],
                departure_body=departure_body,
            ),
        )


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _materialize_closest_approach_epoch(base_epoch: str, closest_approach: Dict[str, object]) -> Dict[str, object]:
    payload = dict(closest_approach)
    if "epochSeconds" in payload and "epoch" not in payload:
        payload["epoch"] = _epoch_with_offset(base_epoch, float(payload["epochSeconds"]))
    return payload
