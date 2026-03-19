from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from app.services.transfer_planner import TransferPlanner


@dataclass(frozen=True)
class EarthEscapePlan:
    segment_type: str
    start_epoch: str
    end_epoch: str
    samples: List[Dict[str, object]]
    initial_state: Dict[str, object]
    final_state: Dict[str, object]
    events: List[Dict[str, object]]
    metadata: Dict[str, object]


class EarthEscapePlanner:
    def __init__(self, ephemeris) -> None:
        self.ephemeris = ephemeris
        self.transfer_planner = TransferPlanner(ephemeris)

    def plan_escape(
        self,
        *,
        launch_epoch: str,
        parking_final_state: Dict[str, object],
        target_body: str,
    ) -> EarthEscapePlan:
        transfer_plan = self.transfer_planner.plan_auto_transfer(
            departure_body="earth",
            target_body=target_body,
            launch_epoch=launch_epoch,
        )
        escape_epoch = parking_final_state["epoch"]
        heliocentric_state = self._heliocentric_boundary_state(
            epoch=escape_epoch,
            state_vector=transfer_plan.initial_state,
        )

        return EarthEscapePlan(
            segment_type="earthEscape",
            start_epoch=escape_epoch,
            end_epoch=escape_epoch,
            samples=[
                {
                    "epochSeconds": 0.0,
                    "positionKm": list(parking_final_state["positionKm"]),
                    "velocityKmPerSec": list(parking_final_state["velocityKmPerSec"]),
                    "referenceFrame": parking_final_state["referenceFrame"],
                    "referenceBodyId": parking_final_state["referenceBodyId"],
                },
                {
                    "epochSeconds": 0.0,
                    "positionKm": list(heliocentric_state["positionKm"]),
                    "velocityKmPerSec": list(heliocentric_state["velocityKmPerSec"]),
                    "referenceFrame": heliocentric_state["referenceFrame"],
                },
            ],
            initial_state=parking_final_state,
            final_state=heliocentric_state,
            events=[
                {
                    "id": "segment-earth-escape-burn",
                    "type": "earthEscapeBurn",
                    "epoch": escape_epoch,
                    "title": "Earth Escape Burn",
                    "description": "Inject from parking orbit toward an interplanetary departure trajectory.",
                    "relatedBody": "earth",
                },
                {
                    "id": "segment-earth-soi-exit",
                    "type": "earthSoiExit",
                    "epoch": escape_epoch,
                    "title": "Earth SOI Exit",
                    "description": "Transition from Earth departure into heliocentric cruise.",
                    "relatedBody": "earth",
                },
            ],
            metadata={
                "targetBody": target_body,
                "deltaVEstimateKmPerS": transfer_plan.delta_v_km_per_s,
                "plannedFlightTimeSeconds": transfer_plan.duration_seconds,
            },
        )

    def _heliocentric_boundary_state(self, *, epoch: str, state_vector) -> Dict[str, object]:
        return {
            "epoch": epoch,
            "referenceFrame": "heliocentric-inertial",
            "referenceBodyId": "sun",
            "positionKm": tuple(float(component) for component in state_vector[:3]),
            "velocityKmPerSec": tuple(float(component) for component in state_vector[3:6]),
        }
