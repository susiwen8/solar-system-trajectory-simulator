from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import floor, isclose

from app.core.ephemeris.base import BodyState, Ephemeris, MAJOR_BODY_IDS


class InterpolatedEphemerisCache:
    def __init__(self, *, ephemeris: Ephemeris, base_epoch: str, step_seconds: float) -> None:
        if step_seconds <= 0.0:
            raise ValueError("step_seconds must be positive")

        self.ephemeris = ephemeris
        self.base_epoch = base_epoch
        self.step_seconds = float(step_seconds)
        self._batch_cache: dict[float, dict[str, BodyState]] = {}

    def get_all_body_states(self, offset_seconds: float) -> list[BodyState]:
        left_offset, right_offset, ratio = self._neighbor_offsets(offset_seconds)
        left_batch = self._batch_for_offset(left_offset)
        actual_epoch = _epoch_with_offset(self.base_epoch, offset_seconds)

        if right_offset == left_offset:
            return [
                self._with_epoch(left_batch[body_id], actual_epoch)
                for body_id in MAJOR_BODY_IDS
                if body_id in left_batch
            ]

        right_batch = self._batch_for_offset(right_offset)
        return [
            _interpolate_body_state(
                left_state=left_batch[body_id],
                right_state=right_batch[body_id],
                epoch=actual_epoch,
                ratio=ratio,
            )
            for body_id in MAJOR_BODY_IDS
            if body_id in left_batch and body_id in right_batch
        ]

    def get_body_state(self, body_id: str, offset_seconds: float) -> BodyState:
        if body_id not in MAJOR_BODY_IDS:
            return self.ephemeris.get_body_state(body_id, _epoch_with_offset(self.base_epoch, offset_seconds))

        states = {
            state.body_id: state
            for state in self.get_all_body_states(offset_seconds)
        }
        if body_id not in states:
            return self.ephemeris.get_body_state(body_id, _epoch_with_offset(self.base_epoch, offset_seconds))
        return states[body_id]

    def _neighbor_offsets(self, offset_seconds: float) -> tuple[float, float, float]:
        bucket_index = floor(offset_seconds / self.step_seconds)
        left_offset = bucket_index * self.step_seconds
        right_offset = left_offset + self.step_seconds
        delta = offset_seconds - left_offset
        if isclose(delta, 0.0, abs_tol=1e-9):
            return left_offset, left_offset, 0.0
        ratio = delta / self.step_seconds
        return left_offset, right_offset, ratio

    def _batch_for_offset(self, offset_seconds: float) -> dict[str, BodyState]:
        if offset_seconds not in self._batch_cache:
            epoch = _epoch_with_offset(self.base_epoch, offset_seconds)
            self._batch_cache[offset_seconds] = {
                state.body_id: state
                for state in self.ephemeris.get_all_body_states(epoch)
            }
        return self._batch_cache[offset_seconds]

    def _with_epoch(self, state: BodyState, epoch: str) -> BodyState:
        if state.epoch == epoch:
            return state
        return BodyState(
            body_id=state.body_id,
            epoch=epoch,
            position_km=state.position_km,
            velocity_km_per_s=state.velocity_km_per_s,
            mu_km3_per_s2=state.mu_km3_per_s2,
            source_name=state.source_name,
        )


def _interpolate_body_state(
    *,
    left_state: BodyState,
    right_state: BodyState,
    epoch: str,
    ratio: float,
) -> BodyState:
    return BodyState(
        body_id=left_state.body_id,
        epoch=epoch,
        position_km=_interpolate_vector(left_state.position_km, right_state.position_km, ratio),
        velocity_km_per_s=_interpolate_vector(left_state.velocity_km_per_s, right_state.velocity_km_per_s, ratio),
        mu_km3_per_s2=left_state.mu_km3_per_s2,
        source_name=left_state.source_name,
    )


def _interpolate_vector(
    left: tuple[float, float, float],
    right: tuple[float, float, float],
    ratio: float,
) -> tuple[float, float, float]:
    return tuple(
        left[index] + (right[index] - left[index]) * ratio
        for index in range(3)
    )


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def recommended_cache_step_seconds(sample_step_seconds: float) -> float:
    return min(max(float(sample_step_seconds), 3600.0), 6.0 * 3600.0)
