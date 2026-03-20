from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import cos, pi, sin, sqrt
from typing import Dict, List

from app.core.constants import PLANETARY_BODY_RADII_KM, SOLAR_SYSTEM_MU_KM3_PER_S2
from app.services.mission_segments import build_segment_boundary_state


@dataclass(frozen=True)
class ArrivalCapturePlan:
    segment_type: str
    start_epoch: str
    end_epoch: str
    samples: List[Dict[str, object]]
    orbit_summary: Dict[str, object]
    initial_state: Dict[str, object]
    final_state: Dict[str, object]
    events: List[Dict[str, object]]
    metadata: Dict[str, object]


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

        initial_state = build_segment_boundary_state(
            epoch=arrival_epoch,
            reference_frame=f"{body_id}-centered-inertial",
            reference_body_id=body_id,
            position_km=samples[0]["positionKm"],
            velocity_km_per_s=samples[0]["velocityKmPerSec"],
        )
        end_epoch = _epoch_with_offset(arrival_epoch, orbital_period_seconds)
        final_state = build_segment_boundary_state(
            epoch=end_epoch,
            reference_frame=f"{body_id}-centered-inertial",
            reference_body_id=body_id,
            position_km=samples[-1]["positionKm"],
            velocity_km_per_s=samples[-1]["velocityKmPerSec"],
        )

        orbit_summary_payload = {
            "isBound": bool(orbit_summary.get("isBound", True)),
            "periapsisKm": periapsis_km,
            "apoapsisKm": apoapsis_km,
            "inclinationDeg": inclination_deg,
        }

        return ArrivalCapturePlan(
            segment_type="arrivalCapture",
            start_epoch=arrival_epoch,
            end_epoch=end_epoch,
            samples=samples,
            orbit_summary=orbit_summary_payload,
            initial_state=initial_state,
            final_state=final_state,
            events=[
                {
                    "id": f"segment-{body_id}-orbit-insertion-burn",
                    "type": "orbitInsertionBurn",
                    "epoch": arrival_epoch,
                    "title": "Orbit Insertion Burn",
                    "description": f"Perform the primary capture burn for arrival at {body_id.title()}.",
                    "relatedBody": body_id,
                },
                {
                    "id": f"segment-{body_id}-capture-established",
                    "type": "captureEstablished",
                    "epoch": _epoch_with_offset(arrival_epoch, min(sample_step_seconds * 2.0, orbital_period_seconds / 4.0)),
                    "title": "Capture Established",
                    "description": f"Establish a bound orbit around {body_id.title()}.",
                    "relatedBody": body_id,
                },
            ],
            metadata={
                "bodyId": body_id,
                "sourceSamplePositionKm": list(heliocentric_sample.get("positionKm", [])),
            },
        )


def _ellipse_radius_km(*, periapsis_km: float, apoapsis_km: float, theta_rad: float) -> float:
    semi_major_axis_km = (periapsis_km + apoapsis_km) / 2.0
    eccentricity = (apoapsis_km - periapsis_km) / max(apoapsis_km + periapsis_km, 1.0)
    return (semi_major_axis_km * (1.0 - eccentricity ** 2)) / max(1.0 + eccentricity * cos(theta_rad), 1e-6)


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
