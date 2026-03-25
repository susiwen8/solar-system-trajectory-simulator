from app.mission.models import MissionRequest


def score_candidate(
    request: MissionRequest,
    total_delta_v: float,
    total_duration_days: float,
    near_limit_count: int,
) -> float:
    normalized_duration = total_duration_days / max(request.max_duration_days, 1.0)
    normalized_delta_v = total_delta_v / max(total_delta_v, 1.0)
    score = (
        request.time_weight * (1.0 / (1.0 + normalized_duration))
        + (1.0 - request.time_weight) * (1.0 / (1.0 + normalized_delta_v))
        - 0.05 * near_limit_count
    )
    return max(score, 0.001)

