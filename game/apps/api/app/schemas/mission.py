from typing import Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field, model_validator


class StateVectorInput(BaseModel):
    positionKm: Tuple[float, float, float]
    velocityKmPerSec: Tuple[float, float, float]


class LaunchFromBodyInput(BaseModel):
    mode: Literal["autoTransfer"] = "autoTransfer"


class InitialStateInput(BaseModel):
    stateVector: Optional[StateVectorInput] = None
    launchFromBody: Optional[LaunchFromBodyInput] = None

    @model_validator(mode="after")
    def ensure_exactly_one_mode(self) -> "InitialStateInput":
        if (self.stateVector is None) == (self.launchFromBody is None):
            raise ValueError("Provide exactly one initial-state mode")
        return self


class MissionRequest(BaseModel):
    departureBody: str = Field(min_length=1)
    targetBody: str = Field(min_length=1)
    launchEpoch: str = Field(min_length=1)
    initialState: InitialStateInput
    durationSeconds: Optional[float] = Field(default=None, gt=0)
    outputStepSeconds: Optional[float] = Field(default=None, gt=0)


class MissionTourRequest(BaseModel):
    departureBody: str = Field(min_length=1)
    requiredVisitBodies: List[str] = Field(min_length=1, max_length=4)
    launchEpoch: str = Field(min_length=1)
    maxAssistBodiesPerLeg: int = Field(default=2, ge=0, le=2)
    maxReturnedCandidates: int = Field(default=5, ge=1, le=10)
    allowAssistBodies: bool = True
    allowRepeatedFlybys: bool = True

    @model_validator(mode="after")
    def validate_required_visit_bodies(self) -> "MissionTourRequest":
        unique_bodies = set(self.requiredVisitBodies)
        if len(unique_bodies) != len(self.requiredVisitBodies):
            raise ValueError("requiredVisitBodies must be unique")
        if self.departureBody in unique_bodies:
            raise ValueError("requiredVisitBodies cannot include the departure body")
        return self
