from typing import Dict, Literal, Optional, Tuple

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
