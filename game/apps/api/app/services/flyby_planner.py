from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

from app.services.mission_segments import build_segment_boundary_state


@dataclass(frozen=True)
class FlybyPlan:
    segment_type: str
    start_epoch: str
    end_epoch: str
    samples: List[Dict[str, object]]
    initial_state: Dict[str, object]
    final_state: Dict[str, object]
    events: List[Dict[str, object]]
    warnings: List[str]
    metadata: Dict[str, object]


class FlybyPlanner:
    def plan_segment(
        self,
        *,
        body_id: str,
        periapsis_epoch: str,
        periapsis_altitude_km: float,
        turn_angle_deg: float,
        inbound_v_infinity_km_per_s: float,
        outbound_v_infinity_km_per_s: float,
        position_km: Tuple[float, float, float],
    ) -> FlybyPlan:
        approach_epoch = _epoch_with_offset(periapsis_epoch, -12.0 * 3600.0)
        departure_epoch = _epoch_with_offset(periapsis_epoch, 12.0 * 3600.0)
        initial_state = build_segment_boundary_state(
            epoch=approach_epoch,
            reference_frame="heliocentric-inertial",
            position_km=position_km,
            velocity_km_per_s=(0.0, inbound_v_infinity_km_per_s, 0.0),
            reference_body_id=body_id,
        )
        final_state = build_segment_boundary_state(
            epoch=departure_epoch,
            reference_frame="heliocentric-inertial",
            position_km=position_km,
            velocity_km_per_s=(0.0, outbound_v_infinity_km_per_s, 0.0),
            reference_body_id=body_id,
        )
        metadata = {
            "bodyId": body_id,
            "periapsisAltitudeKm": periapsis_altitude_km,
            "turnAngleDeg": turn_angle_deg,
            "inboundVInfinityKmPerS": inbound_v_infinity_km_per_s,
            "outboundVInfinityKmPerS": outbound_v_infinity_km_per_s,
            "bPlaneLike": {
                "btKm": round(periapsis_altitude_km * 0.35, 3),
                "brKm": round(periapsis_altitude_km * 0.15, 3),
                "thetaDeg": round(turn_angle_deg / 2.0, 3),
            },
        }
        events = [
            {
                "id": f"{body_id}-flyby-approach",
                "type": "flybyApproach",
                "epoch": approach_epoch,
                "title": f"{body_id.title()} Flyby Approach",
                "description": f"Begin approach geometry setup for the {body_id.title()} assist.",
                "relatedBody": body_id,
            },
            {
                "id": f"{body_id}-flyby-periapsis",
                "type": "flybyPeriapsis",
                "epoch": periapsis_epoch,
                "title": f"{body_id.title()} Flyby Periapsis",
                "description": f"Pass periapsis during the {body_id.title()} gravity assist.",
                "relatedBody": body_id,
            },
            {
                "id": f"{body_id}-flyby-departure",
                "type": "flybyDeparture",
                "epoch": departure_epoch,
                "title": f"{body_id.title()} Flyby Departure",
                "description": f"Exit the primary geometry window after the {body_id.title()} assist.",
                "relatedBody": body_id,
            },
        ]

        return FlybyPlan(
            segment_type="gravityAssistFlyby",
            start_epoch=approach_epoch,
            end_epoch=departure_epoch,
            samples=[],
            initial_state=initial_state,
            final_state=final_state,
            events=events,
            warnings=[],
            metadata=metadata,
        )


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
