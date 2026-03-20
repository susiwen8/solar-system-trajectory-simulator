from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import cos, pi, sin
from typing import Dict, List, Tuple

from app.core.constants import PLANETARY_BODY_RADII_KM
from app.services.encounter_geometry import build_encounter_geometry
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
        geometry = build_encounter_geometry(
            body_id=body_id,
            encounter_epoch=periapsis_epoch,
            body_position_km=position_km,
            body_velocity_km_per_s=(0.0, 0.0, 0.0),
            probe_position_km=(position_km[0] + periapsis_altitude_km, position_km[1], position_km[2]),
            probe_velocity_km_per_s=(0.0, inbound_v_infinity_km_per_s, 0.0),
            periapsis_altitude_km=periapsis_altitude_km,
            encounter_type="flyby",
        )
        approach_epoch = _epoch_with_offset(periapsis_epoch, -12.0 * 3600.0)
        departure_epoch = _epoch_with_offset(periapsis_epoch, 12.0 * 3600.0)
        samples = _build_flyby_samples(
            body_id=body_id,
            periapsis_altitude_km=periapsis_altitude_km,
            inbound_v_infinity_km_per_s=inbound_v_infinity_km_per_s,
            outbound_v_infinity_km_per_s=outbound_v_infinity_km_per_s,
        )
        initial_state = build_segment_boundary_state(
            epoch=approach_epoch,
            reference_frame=geometry.reference_frame,
            position_km=samples[0]["positionKm"],
            velocity_km_per_s=samples[0]["velocityKmPerSec"],
            reference_body_id=body_id,
        )
        final_state = build_segment_boundary_state(
            epoch=departure_epoch,
            reference_frame=geometry.reference_frame,
            position_km=samples[-1]["positionKm"],
            velocity_km_per_s=samples[-1]["velocityKmPerSec"],
            reference_body_id=body_id,
        )
        metadata = {
            "bodyId": body_id,
            "encounterType": "flyby",
            "sphereOfInfluenceRadiusKm": geometry.sphere_of_influence_radius_km,
            "periapsisAltitudeKm": periapsis_altitude_km,
            "periapsisRadiusKm": geometry.periapsis_radius_km,
            "turnAngleDeg": turn_angle_deg,
            "incomingVInfinityKmPerS": inbound_v_infinity_km_per_s,
            "outgoingVInfinityKmPerS": outbound_v_infinity_km_per_s,
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
                "id": f"{body_id}-soi-entry",
                "type": "sphereOfInfluenceEntry",
                "epoch": approach_epoch,
                "title": f"{body_id.title()} SOI Entry",
                "description": f"Enter the primary encounter corridor around {body_id.title()}.",
                "relatedBody": body_id,
            },
            {
                "id": f"{body_id}-flyby-periapsis",
                "type": "hyperbolicPeriapsis",
                "epoch": periapsis_epoch,
                "title": f"{body_id.title()} Flyby Periapsis",
                "description": f"Pass periapsis during the {body_id.title()} gravity assist.",
                "relatedBody": body_id,
            },
            {
                "id": f"{body_id}-soi-exit",
                "type": "sphereOfInfluenceExit",
                "epoch": departure_epoch,
                "title": f"{body_id.title()} SOI Exit",
                "description": f"Exit the primary encounter corridor after the {body_id.title()} assist.",
                "relatedBody": body_id,
            },
        ]

        return FlybyPlan(
            segment_type="flybyEncounter",
            start_epoch=approach_epoch,
            end_epoch=departure_epoch,
            samples=samples,
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


def _build_flyby_samples(
    *,
    body_id: str,
    periapsis_altitude_km: float,
    inbound_v_infinity_km_per_s: float,
    outbound_v_infinity_km_per_s: float,
) -> List[Dict[str, object]]:
    radius_km = periapsis_altitude_km + PLANETARY_BODY_RADII_KM[body_id]
    samples: List[Dict[str, object]] = []
    phase_angles = [-0.8 * pi, -0.35 * pi, 0.0, 0.35 * pi, 0.8 * pi]
    for index, theta in enumerate(phase_angles):
        speed = inbound_v_infinity_km_per_s if index <= 2 else outbound_v_infinity_km_per_s
        samples.append(
            {
                "epochSeconds": float(index * 6.0 * 3600.0),
                "positionKm": [
                    float(radius_km * cos(theta)),
                    0.0,
                    float(radius_km * sin(theta)),
                ],
                "velocityKmPerSec": [
                    float(-speed * sin(theta)),
                    0.0,
                    float(speed * cos(theta)),
                ],
                "referenceBodyId": body_id,
                "referenceFrame": f"{body_id}-centered-inertial",
            }
        )
    return samples
