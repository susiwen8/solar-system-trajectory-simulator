from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import cos, pi, sin, sqrt
from typing import Dict, List, Optional

from app.core.constants import PLANETARY_BODY_RADII_KM, SOLAR_SYSTEM_MU_KM3_PER_S2
from app.services.encounter_geometry import build_encounter_geometry
from app.services.mission_segments import build_segment_boundary_state


@dataclass(frozen=True)
class EncounterSegmentPlan:
    segment_type: str
    start_epoch: str
    end_epoch: str
    samples: List[Dict[str, object]]
    initial_state: Dict[str, object]
    final_state: Dict[str, object]
    events: List[Dict[str, object]]
    metadata: Dict[str, object]
    orbit_summary: Optional[Dict[str, object]] = None
    warnings: Optional[List[str]] = None


@dataclass(frozen=True)
class ArrivalCapturePlan:
    segments: List[EncounterSegmentPlan]


class ArrivalCapturePlanner:
    def plan_capture(
        self,
        *,
        body_id: str,
        arrival_epoch: str,
        heliocentric_sample: Dict[str, object],
        orbit_summary: Dict[str, object],
    ) -> ArrivalCapturePlan:
        periapsis_km = float(orbit_summary.get("periapsisKm") or (PLANETARY_BODY_RADII_KM[body_id] + 500.0))
        apoapsis_km = float(orbit_summary.get("apoapsisKm") or periapsis_km)
        inclination_deg = float(orbit_summary.get("inclinationDeg") or 0.0)
        periapsis_altitude_km = periapsis_km - PLANETARY_BODY_RADII_KM[body_id]
        geometry = build_encounter_geometry(
            body_id=body_id,
            encounter_epoch=arrival_epoch,
            body_position_km=tuple(float(component) for component in heliocentric_sample.get("positionKm", [0.0, 0.0, 0.0])),
            body_velocity_km_per_s=(0.0, 0.0, 0.0),
            probe_position_km=tuple(float(component) for component in heliocentric_sample.get("positionKm", [0.0, 0.0, 0.0])),
            probe_velocity_km_per_s=tuple(float(component) for component in heliocentric_sample.get("velocityKmPerSec", [0.0, 0.0, 0.0])),
            periapsis_altitude_km=periapsis_altitude_km,
            encounter_type="capture",
        )

        parking_orbit_samples = _build_parking_orbit_samples(
            body_id=body_id,
            periapsis_km=periapsis_km,
            apoapsis_km=apoapsis_km,
            inclination_deg=inclination_deg,
        )
        body_mu = SOLAR_SYSTEM_MU_KM3_PER_S2[body_id]
        semi_major_axis_km = max((periapsis_km + apoapsis_km) / 2.0, 1.0)
        orbital_period_seconds = 2.0 * pi * sqrt((semi_major_axis_km ** 3) / body_mu)
        burn_end_epoch = _epoch_with_offset(arrival_epoch, 900.0)
        capture_epoch = _epoch_with_offset(arrival_epoch, min(1800.0, orbital_period_seconds / 4.0))
        parking_end_epoch = _epoch_with_offset(arrival_epoch, orbital_period_seconds)

        approach_samples = [
            {
                "epochSeconds": 0.0,
                "positionKm": [float(geometry.periapsis_radius_km * 2.4), 0.0, float(-geometry.periapsis_radius_km * 1.2)],
                "velocityKmPerSec": [0.0, 0.0, geometry.incoming_v_infinity_km_per_s],
                "referenceFrame": geometry.reference_frame,
                "referenceBodyId": body_id,
            },
            {
                "epochSeconds": 1800.0,
                "positionKm": [float(geometry.periapsis_radius_km * 1.35), 0.0, float(-geometry.periapsis_radius_km * 0.35)],
                "velocityKmPerSec": [0.0, 0.0, geometry.incoming_v_infinity_km_per_s * 0.92],
                "referenceFrame": geometry.reference_frame,
                "referenceBodyId": body_id,
            },
            {
                "epochSeconds": 3600.0,
                "positionKm": [float(periapsis_km), 0.0, 0.0],
                "velocityKmPerSec": [0.0, 0.0, geometry.incoming_v_infinity_km_per_s * 0.82],
                "referenceFrame": geometry.reference_frame,
                "referenceBodyId": body_id,
            },
        ]
        burn_samples = [
            {
                "epochSeconds": 0.0,
                "positionKm": [float(periapsis_km), 0.0, 0.0],
                "velocityKmPerSec": [0.0, 0.0, geometry.incoming_v_infinity_km_per_s * 0.82],
                "referenceFrame": geometry.reference_frame,
                "referenceBodyId": body_id,
            },
            {
                "epochSeconds": 900.0,
                "positionKm": [float(periapsis_km), 0.0, 0.0],
                "velocityKmPerSec": [0.0, sqrt(body_mu / max(periapsis_km, 1.0)), 0.0],
                "referenceFrame": geometry.reference_frame,
                "referenceBodyId": body_id,
            },
        ]
        orbit_summary_payload = {
            "isBound": bool(orbit_summary.get("isBound", True)),
            "periapsisKm": periapsis_km,
            "apoapsisKm": apoapsis_km,
            "inclinationDeg": inclination_deg,
        }

        approach_segment = EncounterSegmentPlan(
            segment_type="arrivalHyperbolicApproach",
            start_epoch=arrival_epoch,
            end_epoch=arrival_epoch,
            samples=approach_samples,
            initial_state=build_segment_boundary_state(
                epoch=arrival_epoch,
                reference_frame=geometry.reference_frame,
                reference_body_id=body_id,
                position_km=approach_samples[0]["positionKm"],
                velocity_km_per_s=approach_samples[0]["velocityKmPerSec"],
            ),
            final_state=build_segment_boundary_state(
                epoch=arrival_epoch,
                reference_frame=geometry.reference_frame,
                reference_body_id=body_id,
                position_km=approach_samples[-1]["positionKm"],
                velocity_km_per_s=approach_samples[-1]["velocityKmPerSec"],
            ),
            events=[
                {
                    "id": f"{body_id}-soi-entry",
                    "type": "sphereOfInfluenceEntry",
                    "epoch": _epoch_with_offset(arrival_epoch, -3600.0),
                    "title": f"{body_id.title()} SOI Entry",
                    "description": f"Enter the encounter corridor around {body_id.title()}.",
                    "relatedBody": body_id,
                },
                {
                    "id": f"{body_id}-hyperbolic-periapsis",
                    "type": "hyperbolicPeriapsis",
                    "epoch": arrival_epoch,
                    "title": f"{body_id.title()} Hyperbolic Periapsis",
                    "description": f"Reach capture periapsis at {body_id.title()}.",
                    "relatedBody": body_id,
                },
            ],
            metadata={
                "bodyId": body_id,
                "encounterType": "capture",
                "sphereOfInfluenceRadiusKm": geometry.sphere_of_influence_radius_km,
                "incomingVInfinityKmPerS": geometry.incoming_v_infinity_km_per_s,
                "periapsisRadiusKm": periapsis_km,
                "periapsisAltitudeKm": periapsis_altitude_km,
            },
        )
        burn_segment = EncounterSegmentPlan(
            segment_type="orbitInsertionBurn",
            start_epoch=arrival_epoch,
            end_epoch=burn_end_epoch,
            samples=burn_samples,
            initial_state=build_segment_boundary_state(
                epoch=arrival_epoch,
                reference_frame=geometry.reference_frame,
                reference_body_id=body_id,
                position_km=burn_samples[0]["positionKm"],
                velocity_km_per_s=burn_samples[0]["velocityKmPerSec"],
            ),
            final_state=build_segment_boundary_state(
                epoch=burn_end_epoch,
                reference_frame=geometry.reference_frame,
                reference_body_id=body_id,
                position_km=burn_samples[-1]["positionKm"],
                velocity_km_per_s=burn_samples[-1]["velocityKmPerSec"],
            ),
            events=[
                {
                    "id": f"{body_id}-orbit-insertion-burn-start",
                    "type": "orbitInsertionBurnStart",
                    "epoch": arrival_epoch,
                    "title": "Orbit Insertion Burn Start",
                    "description": f"Begin primary capture burn at {body_id.title()}.",
                    "relatedBody": body_id,
                },
                {
                    "id": f"{body_id}-orbit-insertion-burn-end",
                    "type": "orbitInsertionBurnEnd",
                    "epoch": burn_end_epoch,
                    "title": "Orbit Insertion Burn End",
                    "description": f"Complete primary capture burn at {body_id.title()}.",
                    "relatedBody": body_id,
                },
            ],
            metadata={
                "bodyId": body_id,
                "encounterType": "capture",
                "insertionDeltaVKmPerS": round(abs(geometry.incoming_v_infinity_km_per_s - sqrt(body_mu / max(periapsis_km, 1.0))), 6),
                "periapsisRadiusKm": periapsis_km,
                "periapsisAltitudeKm": periapsis_altitude_km,
            },
        )
        parking_segment = EncounterSegmentPlan(
            segment_type="parkingOrbit",
            start_epoch=burn_end_epoch,
            end_epoch=parking_end_epoch,
            samples=parking_orbit_samples,
            initial_state=build_segment_boundary_state(
                epoch=burn_end_epoch,
                reference_frame=geometry.reference_frame,
                reference_body_id=body_id,
                position_km=parking_orbit_samples[0]["positionKm"],
                velocity_km_per_s=parking_orbit_samples[0]["velocityKmPerSec"],
            ),
            final_state=build_segment_boundary_state(
                epoch=parking_end_epoch,
                reference_frame=geometry.reference_frame,
                reference_body_id=body_id,
                position_km=parking_orbit_samples[-1]["positionKm"],
                velocity_km_per_s=parking_orbit_samples[-1]["velocityKmPerSec"],
            ),
            events=[
                {
                    "id": f"{body_id}-capture-established",
                    "type": "captureEstablished",
                    "epoch": capture_epoch,
                    "title": "Capture Established",
                    "description": f"Establish the first bound orbit around {body_id.title()}.",
                    "relatedBody": body_id,
                },
            ],
            metadata={
                "bodyId": body_id,
                "encounterType": "capture",
                "postCaptureOrbitType": "parkingOrbit",
                "captureAchieved": True,
            },
            orbit_summary=orbit_summary_payload,
        )

        return ArrivalCapturePlan(
            segments=[approach_segment, burn_segment, parking_segment],
        )


def _build_parking_orbit_samples(
    *,
    body_id: str,
    periapsis_km: float,
    apoapsis_km: float,
    inclination_deg: float,
) -> List[Dict[str, object]]:
    semi_major_axis_km = max((periapsis_km + apoapsis_km) / 2.0, 1.0)
    body_mu = SOLAR_SYSTEM_MU_KM3_PER_S2[body_id]
    orbital_period_seconds = 2.0 * pi * sqrt((semi_major_axis_km ** 3) / body_mu)
    sample_count = 16
    sample_step_seconds = orbital_period_seconds / (sample_count - 1)
    inclination_rad = inclination_deg * pi / 180.0

    samples: List[Dict[str, object]] = []
    for index in range(sample_count):
        theta = (index / (sample_count - 1)) * 2.0 * pi
        radius_km = _ellipse_radius_km(
            periapsis_km=periapsis_km,
            apoapsis_km=apoapsis_km,
            theta_rad=theta,
        )
        orbital_plane_x = radius_km * cos(theta)
        orbital_plane_z = radius_km * sin(theta)
        position_km = [
            float(orbital_plane_x),
            float(orbital_plane_z * sin(inclination_rad)),
            float(orbital_plane_z * cos(inclination_rad)),
        ]
        circular_speed_km_per_s = sqrt(body_mu / max(radius_km, 1.0))
        velocity_km_per_s = [
            float(-circular_speed_km_per_s * sin(theta)),
            float(circular_speed_km_per_s * cos(theta) * sin(inclination_rad)),
            float(circular_speed_km_per_s * cos(theta) * cos(inclination_rad)),
        ]
        samples.append(
            {
                "epochSeconds": round(index * sample_step_seconds, 6),
                "positionKm": position_km,
                "velocityKmPerSec": velocity_km_per_s,
                "referenceFrame": f"{body_id}-centered-inertial",
                "referenceBodyId": body_id,
            }
        )
    return samples


def _ellipse_radius_km(*, periapsis_km: float, apoapsis_km: float, theta_rad: float) -> float:
    semi_major_axis_km = (periapsis_km + apoapsis_km) / 2.0
    eccentricity = (apoapsis_km - periapsis_km) / max(apoapsis_km + periapsis_km, 1.0)
    return (semi_major_axis_km * (1.0 - eccentricity ** 2)) / max(1.0 + eccentricity * cos(theta_rad), 1e-6)


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
