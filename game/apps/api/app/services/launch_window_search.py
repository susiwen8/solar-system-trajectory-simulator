from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional, Sequence, Tuple

from app.schemas.mission import PropulsionConfig
from app.services.tour_planner import MissionTourPlanner
from app.services.transfer_planner import TransferPlanner

DEFAULT_EARLIEST_LAUNCH_EPOCH = "2026-01-01T00:00:00Z"
INNER_PLANETS = {"mercury", "venus", "mars"}


@dataclass(frozen=True)
class LaunchWindowCandidate:
    launch_epoch: str
    score: float
    delta_v_km_per_s: float
    flight_time_seconds: float
    target_body: Optional[str] = None
    visit_order: Optional[Tuple[str, ...]] = None
    full_sequence_bodies: Optional[Tuple[str, ...]] = None

    def to_dict(self) -> dict:
        payload = {
            "launchEpoch": self.launch_epoch,
            "score": self.score,
            "deltaVKmPerS": self.delta_v_km_per_s,
            "flightTimeSeconds": self.flight_time_seconds,
        }
        if self.target_body is not None:
            payload["targetBody"] = self.target_body
        if self.visit_order is not None:
            payload["visitOrder"] = list(self.visit_order)
        if self.full_sequence_bodies is not None:
            payload["fullSequenceBodies"] = list(self.full_sequence_bodies)
        return payload


@dataclass(frozen=True)
class LaunchWindowResult:
    recommended_launch_epoch: str
    window_start_epoch: str
    window_end_epoch: str
    candidate_launches: Tuple[LaunchWindowCandidate, ...]
    search_summary: dict
    warnings: Tuple[str, ...] = ()

    def to_dict(self) -> dict:
        return {
            "recommendedLaunchEpoch": self.recommended_launch_epoch,
            "windowStartEpoch": self.window_start_epoch,
            "windowEndEpoch": self.window_end_epoch,
            "candidateLaunches": [candidate.to_dict() for candidate in self.candidate_launches],
            "searchSummary": self.search_summary,
            "warnings": list(self.warnings),
        }


class LaunchWindowSearchService:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.transfer_planner = TransferPlanner(ephemeris)
        self.tour_planner = MissionTourPlanner(ephemeris)

    def _search_horizon_days(self, *, mission_type: str, target_body: Optional[str]) -> int:
        if mission_type == "tour":
            return 5 * 365
        if target_body in INNER_PLANETS:
            return 2 * 365
        return 5 * 365

    def search_trajectory_window(
        self,
        *,
        departure_body: str,
        target_body: str,
        earliest_launch_epoch: Optional[str] = None,
    ) -> LaunchWindowResult:
        search_start = earliest_launch_epoch or DEFAULT_EARLIEST_LAUNCH_EPOCH
        horizon_days = self._search_horizon_days(mission_type="trajectory", target_body=target_body)
        coarse_step_days = 180 if target_body in INNER_PLANETS else 270
        fine_step_days = 30 if target_body in INNER_PLANETS else 45

        coarse_candidates = self._evaluate_trajectory_candidates(
            departure_body=departure_body,
            target_body=target_body,
            candidate_epochs=self._candidate_epochs(search_start, horizon_days, coarse_step_days),
        )
        best_epochs = self._best_seed_epochs(coarse_candidates)
        refined_candidates = self._evaluate_trajectory_candidates(
            departure_body=departure_body,
            target_body=target_body,
            candidate_epochs=self._refined_epochs(best_epochs, fine_step_days),
        )
        all_candidates = self._merge_candidates(coarse_candidates, refined_candidates)
        best = min(all_candidates, key=lambda candidate: candidate.score)
        return self._build_result(
            candidates=all_candidates,
            best=best,
            window_candidates=self._window_candidates_from_merged(best, all_candidates),
            search_start=search_start,
            horizon_days=horizon_days,
            mission_type="trajectory",
        )

    def search_tour_window(
        self,
        *,
        departure_body: str,
        required_visit_bodies: Sequence[str],
        earliest_launch_epoch: Optional[str] = None,
        max_assist_bodies_per_leg: int = 2,
        max_returned_candidates: int = 5,
        allow_assist_bodies: bool = True,
        allow_repeated_flybys: bool = True,
        propulsion_config: Optional[PropulsionConfig] = None,
    ) -> LaunchWindowResult:
        search_start = earliest_launch_epoch or DEFAULT_EARLIEST_LAUNCH_EPOCH
        horizon_days = self._search_horizon_days(mission_type="tour", target_body=None)
        coarse_step_days = 540
        fine_step_days = 90

        coarse_candidates = self._evaluate_tour_candidates(
            departure_body=departure_body,
            required_visit_bodies=required_visit_bodies,
            candidate_epochs=self._candidate_epochs(search_start, horizon_days, coarse_step_days),
            max_assist_bodies_per_leg=max_assist_bodies_per_leg,
            max_returned_candidates=max_returned_candidates,
            allow_assist_bodies=allow_assist_bodies,
            allow_repeated_flybys=allow_repeated_flybys,
            propulsion_config=propulsion_config,
        )
        best_epochs = self._best_seed_epochs(coarse_candidates)
        refined_candidates = self._evaluate_tour_candidates(
            departure_body=departure_body,
            required_visit_bodies=required_visit_bodies,
            candidate_epochs=self._refined_epochs(best_epochs, fine_step_days),
            max_assist_bodies_per_leg=max_assist_bodies_per_leg,
            max_returned_candidates=max_returned_candidates,
            allow_assist_bodies=allow_assist_bodies,
            allow_repeated_flybys=allow_repeated_flybys,
            propulsion_config=propulsion_config,
        )
        all_candidates = self._merge_candidates(coarse_candidates, refined_candidates)
        best = min(all_candidates, key=lambda candidate: candidate.score)
        return self._build_result(
            candidates=all_candidates,
            best=best,
            window_candidates=self._window_candidates_from_merged(best, all_candidates),
            search_start=search_start,
            horizon_days=horizon_days,
            mission_type="tour",
        )

    def _evaluate_trajectory_candidates(
        self,
        *,
        departure_body: str,
        target_body: str,
        candidate_epochs: Iterable[str],
    ) -> Tuple[LaunchWindowCandidate, ...]:
        candidates = []
        for epoch in candidate_epochs:
            try:
                plan = self.transfer_planner.plan_auto_transfer(
                    departure_body=departure_body,
                    target_body=target_body,
                    launch_epoch=epoch,
                )
            except Exception:
                continue

            flight_days = plan.duration_seconds / 86_400.0
            miss_distance_penalty = plan.miss_distance_km / 1_000_000.0 * 0.05
            score = plan.delta_v_km_per_s + flight_days * 0.01 + miss_distance_penalty
            candidates.append(
                LaunchWindowCandidate(
                    launch_epoch=epoch,
                    score=round(score, 6),
                    delta_v_km_per_s=round(plan.delta_v_km_per_s, 6),
                    flight_time_seconds=round(plan.duration_seconds, 6),
                    target_body=target_body,
                )
            )
        return tuple(sorted(candidates, key=lambda candidate: candidate.score))

    def _evaluate_tour_candidates(
        self,
        *,
        departure_body: str,
        required_visit_bodies: Sequence[str],
        candidate_epochs: Iterable[str],
        max_assist_bodies_per_leg: int,
        max_returned_candidates: int,
        allow_assist_bodies: bool,
        allow_repeated_flybys: bool,
        propulsion_config: Optional[PropulsionConfig],
    ) -> Tuple[LaunchWindowCandidate, ...]:
        candidates = []
        for epoch in candidate_epochs:
            try:
                tour_candidates = self.tour_planner.plan_tour(
                    departure_body=departure_body,
                    required_visit_bodies=tuple(required_visit_bodies),
                    launch_epoch=epoch,
                    max_assist_bodies_per_leg=max_assist_bodies_per_leg,
                    max_returned_candidates=max_returned_candidates,
                    allow_assist_bodies=allow_assist_bodies,
                    allow_repeated_flybys=allow_repeated_flybys,
                    propulsion_config=propulsion_config,
                )
            except Exception:
                continue

            best = tour_candidates[0] if tour_candidates else None
            if best is None:
                continue
            candidates.append(
                LaunchWindowCandidate(
                    launch_epoch=epoch,
                    score=round(best.score, 6),
                    delta_v_km_per_s=round(best.total_delta_v_km_per_s, 6),
                    flight_time_seconds=round(best.total_flight_time_seconds, 6),
                    visit_order=tuple(best.visit_order),
                    full_sequence_bodies=tuple(best.full_sequence_bodies),
                )
            )
        return tuple(sorted(candidates, key=lambda candidate: candidate.score))

    def _build_result(
        self,
        *,
        candidates: Sequence[LaunchWindowCandidate],
        best: LaunchWindowCandidate,
        window_candidates: Sequence[LaunchWindowCandidate],
        search_start: str,
        horizon_days: int,
        mission_type: str,
    ) -> LaunchWindowResult:
        sorted_candidates = tuple(sorted(self._merge_candidates(candidates, window_candidates), key=lambda candidate: candidate.score))
        window_start_epoch, window_end_epoch = self._window_bounds(best, window_candidates)
        return LaunchWindowResult(
            recommended_launch_epoch=best.launch_epoch,
            window_start_epoch=window_start_epoch,
            window_end_epoch=window_end_epoch,
            candidate_launches=sorted_candidates[:5],
            search_summary={
                "searchStartEpoch": search_start,
                "searchEndEpoch": _epoch_with_offset(search_start, horizon_days * 86_400.0),
                "coarseSampleCount": len(candidates),
                "refinedCandidateCount": len(window_candidates),
                "scoringMode": f"{mission_type}-delta-v-first",
            },
        )

    def _window_bounds(
        self,
        best: LaunchWindowCandidate,
        window_candidates: Sequence[LaunchWindowCandidate],
    ) -> Tuple[str, str]:
        if not window_candidates:
            return best.launch_epoch, best.launch_epoch
        threshold = best.score * 1.12
        viable_epochs = sorted(candidate.launch_epoch for candidate in window_candidates if candidate.score <= threshold)
        if not viable_epochs:
            return best.launch_epoch, best.launch_epoch
        return viable_epochs[0], viable_epochs[-1]

    def _window_candidates_from_merged(
        self,
        best: LaunchWindowCandidate,
        candidates: Sequence[LaunchWindowCandidate],
    ) -> Tuple[LaunchWindowCandidate, ...]:
        return tuple(
            candidate
            for candidate in candidates
            if abs(
                (datetime.fromisoformat(candidate.launch_epoch.replace("Z", "+00:00")) - datetime.fromisoformat(best.launch_epoch.replace("Z", "+00:00"))).days
            )
            <= 365
        )

    def _candidate_epochs(self, start_epoch: str, horizon_days: int, step_days: int) -> Tuple[str, ...]:
        total_steps = max(horizon_days // max(step_days, 1), 1)
        return tuple(_epoch_with_offset(start_epoch, index * step_days * 86_400.0) for index in range(total_steps + 1))

    def _best_seed_epochs(self, candidates: Sequence[LaunchWindowCandidate]) -> Tuple[str, ...]:
        return tuple(candidate.launch_epoch for candidate in sorted(candidates, key=lambda candidate: candidate.score)[:1])

    def _refined_epochs(self, seed_epochs: Sequence[str], fine_step_days: int) -> Tuple[str, ...]:
        epochs = set()
        for epoch in seed_epochs:
            epochs.update(self._window_neighborhood(epoch, fine_step_days, half_span_steps=1))
        return tuple(sorted(epochs))

    def _window_neighborhood(self, center_epoch: str, step_days: int, *, half_span_steps: int) -> Tuple[str, ...]:
        return tuple(
            _epoch_with_offset(center_epoch, offset * step_days * 86_400.0)
            for offset in range(-half_span_steps, half_span_steps + 1)
        )

    def _merge_candidates(
        self,
        left: Sequence[LaunchWindowCandidate],
        right: Sequence[LaunchWindowCandidate],
    ) -> Tuple[LaunchWindowCandidate, ...]:
        merged = {candidate.launch_epoch: candidate for candidate in left}
        for candidate in right:
            existing = merged.get(candidate.launch_epoch)
            if existing is None or candidate.score < existing.score:
                merged[candidate.launch_epoch] = candidate
        return tuple(sorted(merged.values(), key=lambda candidate: candidate.score))


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
