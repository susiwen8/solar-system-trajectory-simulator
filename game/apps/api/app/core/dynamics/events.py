from typing import Dict, List, Union


def compute_closest_approach(
    samples: List[Dict[str, object]],
    target_body_id: str,
    target_position_km,
) -> Dict[str, Union[float, str]]:
    closest = min(
        samples,
        key=lambda sample: _distance_km(sample["positionKm"], target_position_km),
    )
    return {
        "bodyId": target_body_id,
        "distanceKm": _distance_km(closest["positionKm"], target_position_km),
        "epochSeconds": closest["epochSeconds"],
    }


def _distance_km(a, b) -> float:
    return sum((a[index] - b[index]) ** 2 for index in range(3)) ** 0.5
