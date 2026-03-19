from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.services.mission_segments import build_segment_boundary_state


@dataclass(frozen=True)
class CruisePlan:
    segment_type: str
    start_epoch: str
    end_epoch: str
    samples: List[Dict[str, object]]
    initial_state: Dict[str, object]
    final_state: Dict[str, object]
    events: List[Dict[str, object]]
    warnings: List[str]
    metadata: Dict[str, object]
    mass_summary: Dict[str, float]


class CruisePlanner:
    def plan_segment(
        self,
        *,
        launch_epoch: str,
        start_epoch: str,
        target_body: str,
        samples: List[Dict[str, object]],
        maneuver_events: Optional[List[Dict[str, object]]] = None,
        warnings: Optional[List[str]] = None,
        closest_approach: Optional[Dict[str, object]] = None,
    ) -> CruisePlan:
        if not samples:
            raise ValueError("CruisePlanner requires at least one sample")

        end_epoch = _epoch_with_offset(launch_epoch, float(samples[-1]["epochSeconds"]))
        initial_state = build_segment_boundary_state(
            epoch=start_epoch,
            reference_frame="heliocentric-inertial",
            position_km=samples[0]["positionKm"],
            velocity_km_per_s=samples[0]["velocityKmPerSec"],
            reference_body_id="sun",
        )
        final_state = build_segment_boundary_state(
            epoch=end_epoch,
            reference_frame="heliocentric-inertial",
            position_km=samples[-1]["positionKm"],
            velocity_km_per_s=samples[-1]["velocityKmPerSec"],
            reference_body_id="sun",
        )
        maneuver_events = list(maneuver_events or [])
        warnings = list(warnings or [])
        mass_summary = _build_mass_summary(samples=samples, maneuver_events=maneuver_events)
        metadata = {
            "targetBody": target_body,
            "maneuverCount": len(maneuver_events),
            "deltaVTotalKmPerS": round(sum(float(event["deltaVEstimateKmPerS"]) for event in maneuver_events), 4),
            "maneuverStrategy": "finite-thrust-correction" if maneuver_events else "ballistic",
            "closestApproachEstimateKm": (
                float(closest_approach["distanceKm"]) if closest_approach and "distanceKm" in closest_approach else None
            ),
        }

        return CruisePlan(
            segment_type="heliocentricCruise",
            start_epoch=start_epoch,
            end_epoch=end_epoch,
            samples=samples,
            initial_state=initial_state,
            final_state=final_state,
            events=maneuver_events,
            warnings=warnings,
            metadata=metadata,
            mass_summary=mass_summary,
        )


def _build_mass_summary(
    *,
    samples: List[Dict[str, object]],
    maneuver_events: List[Dict[str, object]],
) -> Dict[str, float]:
    if maneuver_events:
        return {
            "massBeforeKg": float(maneuver_events[0]["massBeforeKg"]),
            "massAfterKg": float(maneuver_events[-1]["massAfterKg"]),
            "propellantUsedKg": round(
                float(maneuver_events[0]["massBeforeKg"]) - float(maneuver_events[-1]["massAfterKg"]),
                6,
            ),
        }

    if samples and samples[0].get("massKg") is not None and samples[-1].get("massKg") is not None:
        return {
            "massBeforeKg": float(samples[0]["massKg"]),
            "massAfterKg": float(samples[-1]["massKg"]),
            "propellantUsedKg": round(float(samples[0]["massKg"]) - float(samples[-1]["massKg"]), 6),
        }

    return {
        "massBeforeKg": 0.0,
        "massAfterKg": 0.0,
        "propellantUsedKg": 0.0,
    }


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
