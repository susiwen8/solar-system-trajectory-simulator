from copy import deepcopy
from dataclasses import replace

import numpy as np

from app.astrodynamics.flyby import classify_flyby
from app.astrodynamics.lambert import solve_lambert
from app.astrodynamics.vector_math import safe_norm
from app.core.body_catalog import BODY_CATALOG
from app.mission.models import (
    MissionCandidate,
    MissionLegCandidate,
    MissionRequest,
    MissionSummary,
    parse_timestamp,
)
from app.mission.scoring import score_candidate


MU_SUN_KM3_S2 = 1.32712440018e11


class MissionSearchService:
    def __init__(self, ephemeris_service) -> None:
        self.ephemeris_service = ephemeris_service

    def solve(self, **kwargs) -> list[MissionCandidate]:
        request = MissionRequest(**kwargs)
        body_sequence = [request.origin, *request.targets]
        all_leg_options: list[list[MissionLegCandidate]] = []

        for index, (departure_body, arrival_body) in enumerate(
            zip(body_sequence[:-1], body_sequence[1:], strict=False)
        ):
            options = self._build_leg_options(
                departure_body=departure_body,
                arrival_body=arrival_body,
                request=request,
                first_leg=index == 0,
            )
            if not options:
                return []
            all_leg_options.append(options[:3])

        candidate_chains: list[list[MissionLegCandidate]] = []
        self._chain_legs(all_leg_options, 0, None, [], candidate_chains)
        if not candidate_chains:
            return []

        candidates: list[MissionCandidate] = []
        for chain_index, chain in enumerate(candidate_chains):
            warnings: list[str] = []
            near_limit_count = 0
            annotated_chain = deepcopy(chain)
            for leg_index in range(1, len(annotated_chain)):
                previous_leg = annotated_chain[leg_index - 1]
                current_leg = annotated_chain[leg_index]
                incoming_vinf = np.array(previous_leg.transfer_v2_km_s) - np.array(
                    previous_leg.arrival_velocity_km_s
                )
                outgoing_vinf = np.array(current_leg.transfer_v1_km_s) - np.array(
                    current_leg.departure_velocity_km_s
                )
                body = BODY_CATALOG[current_leg.departure_body_id]
                flyby_result = classify_flyby(
                    incoming_vinf_km_s=incoming_vinf,
                    outgoing_vinf_km_s=outgoing_vinf,
                    mu_km3_s2=body.mu_km3_s2,
                    body_radius_km=body.radius_km,
                    min_altitude_km=body.radius_km * request.flyby_altitude_multiplier,
                )
                current_leg.flyby_status = flyby_result.status
                if flyby_result.status == "near limit":
                    near_limit_count += 1
                if flyby_result.status == "infeasible":
                    warnings.append(
                        f"Flyby at {body.name} exceeds the patched-conic turning limit."
                    )

            total_duration_days = (
                parse_timestamp(annotated_chain[-1].arrival_time)
                - parse_timestamp(annotated_chain[0].departure_time)
            ).total_seconds() / 86400.0
            total_delta_v = sum(leg.delta_v_km_s for leg in annotated_chain)
            score = score_candidate(
                request,
                total_delta_v=total_delta_v,
                total_duration_days=total_duration_days,
                near_limit_count=near_limit_count,
            )
            candidates.append(
                MissionCandidate(
                    id=f"candidate-{chain_index}",
                    summary=MissionSummary(
                        label="recommended",
                        total_duration_days=total_duration_days,
                        total_delta_v=total_delta_v,
                        score=score,
                    ),
                    legs=annotated_chain,
                    warnings=warnings,
                )
            )

        return self._label_top_candidates(candidates)

    def _build_leg_options(
        self,
        departure_body: str,
        arrival_body: str,
        request: MissionRequest,
        first_leg: bool,
    ) -> list[MissionLegCandidate]:
        departure_records = self.ephemeris_service.get_vectors(
            departure_body,
            request.launch_window_start,
            request.launch_window_end,
            "30d",
        ).records
        arrival_records = self.ephemeris_service.get_vectors(
            arrival_body,
            request.launch_window_start,
            request.launch_window_end,
            "30d",
        ).records

        launch_start = parse_timestamp(request.launch_window_start)
        launch_end = parse_timestamp(request.launch_window_end)
        leg_options: list[MissionLegCandidate] = []
        for departure_record in departure_records:
            departure_dt = parse_timestamp(departure_record["timestamp"])
            if first_leg and not (launch_start <= departure_dt <= launch_end):
                continue
            for arrival_record in arrival_records:
                arrival_dt = parse_timestamp(arrival_record["timestamp"])
                if arrival_dt <= departure_dt:
                    continue
                duration_days = (arrival_dt - departure_dt).total_seconds() / 86400.0
                if not (
                    request.min_leg_duration_days
                    <= duration_days
                    <= request.max_leg_duration_days
                ):
                    continue

                departure_position = np.array(departure_record["position_km"], dtype=float)
                arrival_position = np.array(arrival_record["position_km"], dtype=float)
                lambert_solution = solve_lambert(
                    departure_position,
                    arrival_position,
                    (arrival_dt - departure_dt).total_seconds(),
                    MU_SUN_KM3_S2,
                )
                if lambert_solution is None:
                    continue

                departure_velocity = np.array(
                    departure_record["velocity_km_s"], dtype=float
                )
                arrival_velocity = np.array(arrival_record["velocity_km_s"], dtype=float)
                delta_v = safe_norm(lambert_solution.v1_km_s - departure_velocity) + safe_norm(
                    lambert_solution.v2_km_s - arrival_velocity
                )
                leg_options.append(
                    MissionLegCandidate(
                        departure_body_id=departure_body,
                        arrival_body_id=arrival_body,
                        departure_time=departure_record["timestamp"],
                        arrival_time=arrival_record["timestamp"],
                        departure_position_km=departure_record["position_km"],
                        arrival_position_km=arrival_record["position_km"],
                        departure_velocity_km_s=departure_record["velocity_km_s"],
                        arrival_velocity_km_s=arrival_record["velocity_km_s"],
                        transfer_v1_km_s=lambert_solution.v1_km_s.tolist(),
                        transfer_v2_km_s=lambert_solution.v2_km_s.tolist(),
                        delta_v_km_s=delta_v,
                    )
                )

        leg_options.sort(
            key=lambda leg: (
                parse_timestamp(leg.departure_time),
                leg.delta_v_km_s,
            )
        )
        return leg_options

    def _chain_legs(
        self,
        all_leg_options: list[list[MissionLegCandidate]],
        index: int,
        previous_arrival,
        current_chain: list[MissionLegCandidate],
        result: list[list[MissionLegCandidate]],
    ) -> None:
        if index == len(all_leg_options):
            result.append(deepcopy(current_chain))
            return

        for leg in all_leg_options[index]:
            departure_dt = parse_timestamp(leg.departure_time)
            if previous_arrival is not None and departure_dt < previous_arrival:
                continue
            current_chain.append(leg)
            self._chain_legs(
                all_leg_options,
                index + 1,
                parse_timestamp(leg.arrival_time),
                current_chain,
                result,
            )
            current_chain.pop()

    @staticmethod
    def _label_top_candidates(candidates: list[MissionCandidate]) -> list[MissionCandidate]:
        if not candidates:
            return []

        fuel_candidate = min(candidates, key=lambda candidate: candidate.summary.total_delta_v)
        time_candidate = min(
            candidates, key=lambda candidate: candidate.summary.total_duration_days
        )
        recommended_candidate = max(candidates, key=lambda candidate: candidate.summary.score)

        labeled: list[MissionCandidate] = []
        seen_ids: set[str] = set()
        for label, candidate in [
            ("fuel_efficient", fuel_candidate),
            ("time_efficient", time_candidate),
            ("recommended", recommended_candidate),
        ]:
            if candidate.id in seen_ids:
                continue
            seen_ids.add(candidate.id)
            labeled.append(
                replace(
                    candidate,
                    summary=replace(candidate.summary, label=label),
                )
            )
        return labeled

