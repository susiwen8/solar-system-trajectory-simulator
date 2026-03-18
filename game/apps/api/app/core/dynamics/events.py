from typing import Dict, List, Union


def compute_closest_approach(
    samples: List[Dict[str, object]],
    target_body_id: str,
    target_samples: List[Dict[str, object]],
) -> Dict[str, Union[float, str]]:
    closest = min(samples, key=lambda sample: _distance_to_target(sample, target_samples))
    return {
        "bodyId": target_body_id,
        "distanceKm": _distance_to_target(closest, target_samples),
        "epochSeconds": closest["epochSeconds"],
    }


def _distance_km(a, b) -> float:
    return sum((a[index] - b[index]) ** 2 for index in range(3)) ** 0.5


def _distance_to_target(sample: Dict[str, object], target_samples: List[Dict[str, object]]) -> float:
    matching_target = next(
        target for target in target_samples if target["epochSeconds"] == sample["epochSeconds"]
    )
    return _distance_km(sample["positionKm"], matching_target["positionKm"])
