from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import permutations
from math import pi
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

from app.core.dynamics.acceleration import point_mass_acceleration
from app.core.dynamics.events import compute_closest_approach
from app.core.dynamics.flyby import evaluate_unpowered_flyby
from app.core.dynamics.lambert import solve_lambert_transfer
from app.core.dynamics.propagator import propagate_state
from app.services.transfer_planner import TransferPlanner

OUTER_TARGETS = {"jupiter", "saturn", "uranus", "neptune"}
BODY_ORBIT_ORDER = {
    "mercury": 1,
    "venus": 2,
    "earth": 3,
    "mars": 4,
    "jupiter": 5,
    "saturn": 6,
    "uranus": 7,
    "neptune": 8,
}
INNER_BODIES = {"mercury", "venus", "earth", "mars"}


@dataclass(frozen=True)
class CandidateFlybyEvent:
    body_id: str
    epoch: str
    position_km: Tuple[float, float, float]
    periapsis_altitude_km: float
    turn_angle_deg: float
    inbound_v_infinity_km_per_s: float
    outbound_v_infinity_km_per_s: float

    def to_dict(self) -> Dict[str, object]:
        return {
            "bodyId": self.body_id,
            "epoch": self.epoch,
            "positionKm": list(self.position_km),
            "periapsisAltitudeKm": self.periapsis_altitude_km,
            "turnAngleDeg": self.turn_angle_deg,
            "inboundVInfinityKmPerS": self.inbound_v_infinity_km_per_s,
            "outboundVInfinityKmPerS": self.outbound_v_infinity_km_per_s,
        }


@dataclass(frozen=True)
class GravityAssistCandidate:
    sequence_bodies: Tuple[str, ...]
    score: float
    delta_v_km_per_s: float
    total_flight_time_seconds: float
    samples: List[Dict[str, object]]
    closest_approach: Dict[str, object]
    warnings: Tuple[str, ...]
    flyby_events: Tuple[CandidateFlybyEvent, ...]

    def to_dict(self) -> Dict[str, object]:
        return {
            "sequenceBodies": list(self.sequence_bodies),
            "score": self.score,
            "deltaVKmPerS": self.delta_v_km_per_s,
            "flightTimeSeconds": self.total_flight_time_seconds,
            "samples": self.samples,
            "closestApproach": self.closest_approach,
            "warnings": list(self.warnings),
            "flybyEvents": [event.to_dict() for event in self.flyby_events],
        }


@dataclass(frozen=True)
class _LegPlan:
    departure_body: str
    arrival_body: str
    departure_epoch: str
    arrival_epoch: str
    duration_seconds: float
    departure_velocity_km_per_s: np.ndarray
    arrival_velocity_km_per_s: np.ndarray


@dataclass(frozen=True)
class _EvaluatedCandidate:
    sequence_bodies: Tuple[str, ...]
    leg_plans: Tuple[_LegPlan, ...]
    flyby_events: Tuple[CandidateFlybyEvent, ...]
    delta_v_km_per_s: float
    total_flight_time_seconds: float
    score: float
    warnings: Tuple[str, ...]


class GravityAssistSearchService:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.transfer_planner = TransferPlanner(ephemeris)
        self.solar_mu = self.transfer_planner.solar_mu

    def search(
        self,
        *,
        departure_body: str,
        target_body: str,
        launch_epoch: str,
        max_flybys: int = 3,
        candidate_limit: int = 5,
        sequence_budget: int = 36,
    ) -> List[GravityAssistCandidate]:
        raw_sequences = self._generate_sequences(
            departure_body=departure_body,
            target_body=target_body,
            max_flybys=max_flybys,
            sequence_budget=sequence_budget,
        )
        evaluated: List[_EvaluatedCandidate] = []
        for sequence in raw_sequences:
            candidate = self._evaluate_sequence(
                departure_body=departure_body,
                target_body=target_body,
                assist_bodies=sequence,
                launch_epoch=launch_epoch,
            )
            if candidate is not None:
                evaluated.append(candidate)

        top_candidates = sorted(evaluated, key=lambda candidate: candidate.score)[:candidate_limit]
        return [
            self._build_candidate_output(
                departure_body=departure_body,
                target_body=target_body,
                candidate=candidate,
            )
            for candidate in top_candidates
        ]

    def _generate_sequences(
        self,
        *,
        departure_body: str,
        target_body: str,
        max_flybys: int,
        sequence_budget: int,
    ) -> List[Tuple[str, ...]]:
        allowed_assists = [
            body_id
            for body_id in ("mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune")
            if body_id not in {departure_body, target_body}
        ]
        priority = self._assist_priority(target_body)
        scored_sequences: List[Tuple[float, Tuple[str, ...]]] = [(0.0, tuple())]

        for flyby_count in range(1, max_flybys + 1):
            for sequence in permutations(allowed_assists, flyby_count):
                if not self._is_sequence_plausible(
                    departure_body=departure_body,
                    target_body=target_body,
                    assist_bodies=sequence,
                ):
                    continue
                score = 0.0
                for index, body_id in enumerate(sequence):
                    score += priority.get(body_id, 1.0) * (flyby_count - index + 1)
                scored_sequences.append((-score, tuple(sequence)))

        scored_sequences.sort(key=lambda item: (item[0], len(item[1]), item[1]))
        selected = [sequence for _, sequence in scored_sequences[: max(sequence_budget, 1)]]
        if tuple() not in selected:
            selected.insert(0, tuple())
        return selected

    def _is_sequence_plausible(
        self,
        *,
        departure_body: str,
        target_body: str,
        assist_bodies: Sequence[str],
    ) -> bool:
        del departure_body
        if not assist_bodies:
            return True

        target_order = BODY_ORBIT_ORDER[target_body]
        saw_outer_assist = False
        last_outer_order = 0
        last_inner_order = BODY_ORBIT_ORDER["earth"]

        for body_id in assist_bodies:
            order = BODY_ORBIT_ORDER[body_id]

            if target_body in OUTER_TARGETS:
                if order > target_order:
                    return False
                if body_id in INNER_BODIES:
                    if saw_outer_assist:
                        return False
                    if order < last_inner_order - 1:
                        return False
                    last_inner_order = order
                    continue

                if last_outer_order and order < last_outer_order:
                    return False
                saw_outer_assist = True
                last_outer_order = order
                continue

            if order > BODY_ORBIT_ORDER["mars"]:
                return False
            if saw_outer_assist:
                return False
            if order > last_inner_order:
                saw_outer_assist = True
            last_inner_order = order

        return True

    def _assist_priority(self, target_body: str) -> Dict[str, float]:
        if target_body in OUTER_TARGETS:
            return {
                "jupiter": 12.0,
                "venus": 8.0,
                "mars": 6.0,
                "saturn": 10.0,
                "mercury": 4.0,
                "uranus": 5.0,
                "neptune": 5.0,
                "earth": 9.0,
            }
        return {
            "venus": 11.0,
            "earth": 10.0,
            "mars": 8.0,
            "jupiter": 6.0,
            "saturn": 4.0,
            "mercury": 5.0,
            "uranus": 3.0,
            "neptune": 3.0,
        }

    def _evaluate_sequence(
        self,
        *,
        departure_body: str,
        target_body: str,
        assist_bodies: Sequence[str],
        launch_epoch: str,
    ) -> Optional[_EvaluatedCandidate]:
        bodies = (departure_body, *assist_bodies, target_body)
        best_candidate: Optional[_EvaluatedCandidate] = None

        for global_scale in self._candidate_scales(assist_bodies):
            leg_plans = self._build_leg_plans(bodies=bodies, launch_epoch=launch_epoch, global_scale=global_scale)
            if leg_plans is None:
                continue

            flyby_events = []
            feasible = True
            warnings: List[str] = []
            flyby_correction_delta_v = 0.0
            for index, assist_body in enumerate(assist_bodies):
                arrival_leg = leg_plans[index]
                departure_leg = leg_plans[index + 1]
                assist_state = self.ephemeris.get_body_state(assist_body, arrival_leg.arrival_epoch)
                flyby = evaluate_unpowered_flyby(
                    assist_body,
                    arrival_leg.arrival_velocity_km_per_s,
                    departure_leg.departure_velocity_km_per_s,
                    np.array(assist_state.velocity_km_per_s, dtype=float),
                )
                if not flyby.feasible:
                    feasible = False
                    break
                flyby_events.append(
                    CandidateFlybyEvent(
                        body_id=assist_body,
                        epoch=arrival_leg.arrival_epoch,
                        position_km=assist_state.position_km,
                        periapsis_altitude_km=flyby.periapsis_altitude_km,
                        turn_angle_deg=flyby.turn_angle_deg,
                        inbound_v_infinity_km_per_s=flyby.inbound_v_infinity_km_per_s,
                        outbound_v_infinity_km_per_s=flyby.outbound_v_infinity_km_per_s,
                    )
                )
                warnings.extend(flyby.warnings)
                flyby_correction_delta_v += abs(
                    flyby.inbound_v_infinity_km_per_s - flyby.outbound_v_infinity_km_per_s
                )

            if not feasible:
                continue

            departure_state = self.ephemeris.get_body_state(departure_body, launch_epoch)
            target_arrival_state = self.ephemeris.get_body_state(target_body, leg_plans[-1].arrival_epoch)
            departure_delta_v = float(
                np.linalg.norm(leg_plans[0].departure_velocity_km_per_s - np.array(departure_state.velocity_km_per_s, dtype=float))
            )
            arrival_delta_v = float(
                np.linalg.norm(leg_plans[-1].arrival_velocity_km_per_s - np.array(target_arrival_state.velocity_km_per_s, dtype=float))
            )
            total_flight_time_seconds = sum(leg.duration_seconds for leg in leg_plans)
            total_delta_v = departure_delta_v + arrival_delta_v + flyby_correction_delta_v
            score = (
                total_delta_v
                + (total_flight_time_seconds / 86_400.0) * 0.01
                + len(assist_bodies) * 0.75
            )
            candidate = _EvaluatedCandidate(
                sequence_bodies=tuple(bodies),
                leg_plans=leg_plans,
                flyby_events=tuple(flyby_events),
                delta_v_km_per_s=total_delta_v,
                total_flight_time_seconds=total_flight_time_seconds,
                score=score,
                warnings=tuple(warnings),
            )
            if best_candidate is None or candidate.score < best_candidate.score:
                best_candidate = candidate

        return best_candidate

    def _candidate_scales(self, assist_bodies: Sequence[str]) -> Tuple[float, ...]:
        if assist_bodies:
            return (0.55, 0.7, 0.85, 1.0, 1.15, 1.3)
        return (0.85, 1.0, 1.15)

    def _build_leg_plans(
        self,
        *,
        bodies: Sequence[str],
        launch_epoch: str,
        global_scale: float,
    ) -> Optional[Tuple[_LegPlan, ...]]:
        current_epoch = launch_epoch
        leg_plans: List[_LegPlan] = []

        for departure_body, arrival_body in zip(bodies[:-1], bodies[1:]):
            departure_state = self.ephemeris.get_body_state(departure_body, current_epoch)
            nominal_duration_seconds = self._nominal_leg_duration_seconds(
                departure_state.position_km,
                arrival_body=arrival_body,
                epoch=current_epoch,
            )
            duration_seconds = max(35.0 * 86_400.0, nominal_duration_seconds * global_scale)
            arrival_epoch = _epoch_with_offset(current_epoch, duration_seconds)
            arrival_state = self.ephemeris.get_body_state(arrival_body, arrival_epoch)
            try:
                solution = solve_lambert_transfer(
                    departure_position_km=np.array(departure_state.position_km, dtype=float),
                    arrival_position_km=np.array(arrival_state.position_km, dtype=float),
                    time_of_flight_seconds=duration_seconds,
                    mu_km3_per_s2=self.solar_mu,
                )
            except ValueError:
                return None

            leg_plans.append(
                _LegPlan(
                    departure_body=departure_body,
                    arrival_body=arrival_body,
                    departure_epoch=current_epoch,
                    arrival_epoch=arrival_epoch,
                    duration_seconds=duration_seconds,
                    departure_velocity_km_per_s=solution.departure_velocity_km_per_s,
                    arrival_velocity_km_per_s=solution.arrival_velocity_km_per_s,
                )
            )
            current_epoch = arrival_epoch

        return tuple(leg_plans)

    def _nominal_leg_duration_seconds(
        self,
        departure_position_km: Sequence[float],
        *,
        arrival_body: str,
        epoch: str,
    ) -> float:
        arrival_state = self.ephemeris.get_body_state(arrival_body, epoch)
        r1 = float(np.linalg.norm(np.array(departure_position_km, dtype=float)))
        r2 = float(np.linalg.norm(np.array(arrival_state.position_km, dtype=float)))
        transfer_axis = max((r1 + r2) / 2.0, 1.0)
        return pi * np.sqrt((transfer_axis**3) / self.solar_mu)

    def _build_candidate_output(
        self,
        *,
        departure_body: str,
        target_body: str,
        candidate: _EvaluatedCandidate,
    ) -> GravityAssistCandidate:
        sample_step = max(candidate.total_flight_time_seconds / 420.0, 12.0 * 3600.0)
        samples: List[Dict[str, object]] = []
        epoch_offset = 0.0

        for leg in candidate.leg_plans:
            departure_state = self.ephemeris.get_body_state(leg.departure_body, leg.departure_epoch)
            propagation = propagate_state(
                initial_state=np.array(
                    [
                        *departure_state.position_km,
                        *leg.departure_velocity_km_per_s,
                    ],
                    dtype=float,
                ),
                t_span=(0.0, leg.duration_seconds),
                sample_step_s=sample_step,
                acceleration_fn=lambda _time_seconds, probe_position: point_mass_acceleration(
                    np.zeros(3, dtype=float),
                    probe_position,
                    self.solar_mu,
                ),
            )

            for index, sample in enumerate(propagation.samples):
                if samples and index == 0:
                    continue
                samples.append(
                    {
                        "epochSeconds": epoch_offset + sample.epoch_seconds,
                        "positionKm": list(sample.position_km),
                        "velocityKmPerSec": list(sample.velocity_km_per_s),
                    }
                )
            epoch_offset += leg.duration_seconds

        target_samples = self._target_samples(target_body=target_body, sequence_end_epoch=leg.arrival_epoch, samples=samples, launch_epoch=candidate.leg_plans[0].departure_epoch)
        closest_approach = compute_closest_approach(samples, target_body, target_samples)
        warnings = list(candidate.warnings)
        if candidate.flyby_events:
            warnings.append("Patched-conic gravity-assist candidate")
        return GravityAssistCandidate(
            sequence_bodies=candidate.sequence_bodies,
            score=round(candidate.score, 3),
            delta_v_km_per_s=round(candidate.delta_v_km_per_s, 3),
            total_flight_time_seconds=candidate.total_flight_time_seconds,
            samples=samples,
            closest_approach=closest_approach,
            warnings=tuple([*warnings]),
            flyby_events=candidate.flyby_events,
        )

    def _make_acceleration_fn(self, base_epoch: str):
        body_state_cache: Dict[str, list] = {}

        def acceleration_fn(time_seconds: float, probe_position: np.ndarray) -> np.ndarray:
            epoch = _epoch_with_offset(base_epoch, time_seconds)
            if epoch not in body_state_cache:
                body_state_cache[epoch] = self.ephemeris.get_all_body_states(epoch)
            from app.core.dynamics.acceleration import combined_point_mass_acceleration
            from app.core.constants import PLANETARY_BODY_RADII_KM

            return combined_point_mass_acceleration(
                body_state_cache[epoch],
                probe_position,
                minimum_radius_by_body_km=PLANETARY_BODY_RADII_KM,
            )

        return acceleration_fn

    def _target_samples(
        self,
        *,
        target_body: str,
        sequence_end_epoch: str,
        samples: List[Dict[str, object]],
        launch_epoch: str,
    ) -> List[Dict[str, object]]:
        del sequence_end_epoch
        return [
            {
                "epochSeconds": sample["epochSeconds"],
                "positionKm": list(
                    self.ephemeris.get_body_state(
                        target_body,
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
