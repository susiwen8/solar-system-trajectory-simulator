from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import cos, pi, sin, sqrt
from typing import Dict, List

from app.core.constants import PLANETARY_BODY_RADII_KM, SOLAR_SYSTEM_MU_KM3_PER_S2


@dataclass(frozen=True)
class ParkingOrbitPlan:
    segment_type: str
    start_epoch: str
    end_epoch: str
    samples: List[Dict[str, object]]
    orbit_summary: Dict[str, object]
    initial_state: Dict[str, object]
    final_state: Dict[str, object]
    events: List[Dict[str, object]]


class ParkingOrbitPlanner:
    def plan_default_parking_orbit(self, *, launch_epoch: str) -> ParkingOrbitPlan:
        altitude_km = 400.0
        inclination_deg = 28.5
        coast_seconds = 1800.0
        earth_radius_km = PLANETARY_BODY_RADII_KM["earth"]
        orbital_radius_km = earth_radius_km + altitude_km
        earth_mu = SOLAR_SYSTEM_MU_KM3_PER_S2["earth"]
        orbital_speed_km_per_s = sqrt(earth_mu / orbital_radius_km)
        orbital_period_seconds = 2.0 * pi * sqrt((orbital_radius_km**3) / earth_mu)
        mean_motion_rad_per_s = 2.0 * pi / orbital_period_seconds
        sample_times = [0.0, coast_seconds / 2.0, coast_seconds]

        samples = [
            self._sample_state(
                orbital_radius_km=orbital_radius_km,
                orbital_speed_km_per_s=orbital_speed_km_per_s,
                mean_motion_rad_per_s=mean_motion_rad_per_s,
                epoch_seconds=epoch_seconds,
            )
            for epoch_seconds in sample_times
        ]
        initial_state = self._boundary_state(launch_epoch, samples[0])
        final_state = self._boundary_state(launch_epoch, samples[-1])
        start_epoch = initial_state["epoch"]
        end_epoch = final_state["epoch"]

        return ParkingOrbitPlan(
            segment_type="launchParkingOrbit",
            start_epoch=start_epoch,
            end_epoch=end_epoch,
            samples=samples,
            orbit_summary={
                "periapsisKm": orbital_radius_km,
                "apoapsisKm": orbital_radius_km,
                "inclinationDeg": inclination_deg,
                "orbitalPeriodSeconds": orbital_period_seconds,
                "isBound": True,
            },
            initial_state=initial_state,
            final_state=final_state,
            events=[
                {
                    "id": "segment-launch-parking-orbit-start",
                    "type": "launchParkingOrbitStart",
                    "epoch": start_epoch,
                    "title": "Parking Orbit Insertion",
                    "description": "Insert into an initial Earth parking orbit.",
                    "relatedBody": "earth",
                },
                {
                    "id": "segment-launch-parking-orbit-end",
                    "type": "launchParkingOrbitEnd",
                    "epoch": end_epoch,
                    "title": "Parking Orbit Coast Complete",
                    "description": "Complete the initial parking-orbit coast before Earth escape.",
                    "relatedBody": "earth",
                },
            ],
        )

    def _sample_state(
        self,
        *,
        orbital_radius_km: float,
        orbital_speed_km_per_s: float,
        mean_motion_rad_per_s: float,
        epoch_seconds: float,
    ) -> Dict[str, object]:
        true_anomaly = mean_motion_rad_per_s * epoch_seconds
        position = (
            orbital_radius_km * cos(true_anomaly),
            orbital_radius_km * sin(true_anomaly),
            0.0,
        )
        velocity = (
            -orbital_speed_km_per_s * sin(true_anomaly),
            orbital_speed_km_per_s * cos(true_anomaly),
            0.0,
        )
        return {
            "epochSeconds": epoch_seconds,
            "positionKm": [float(component) for component in position],
            "velocityKmPerSec": [float(component) for component in velocity],
        }

    def _boundary_state(self, launch_epoch: str, sample: Dict[str, object]) -> Dict[str, object]:
        return {
            "epoch": _epoch_with_offset(launch_epoch, float(sample["epochSeconds"])),
            "referenceFrame": "earth-centered-inertial",
            "referenceBodyId": "earth",
            "positionKm": tuple(float(component) for component in sample["positionKm"]),
            "velocityKmPerSec": tuple(float(component) for component in sample["velocityKmPerSec"]),
        }


def _epoch_with_offset(base_epoch: str, offset_seconds: float) -> str:
    start = datetime.fromisoformat(base_epoch.replace("Z", "+00:00")).astimezone(timezone.utc)
    shifted = start + timedelta(seconds=offset_seconds)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
