from typing import Dict, Optional, Tuple

from pydantic import BaseModel, Field, model_validator


class StateVectorInput(BaseModel):
    positionKm: Tuple[float, float, float]
    velocityKmPerSec: Tuple[float, float, float]


class InitialStateInput(BaseModel):
    stateVector: Optional[StateVectorInput] = None
    launchFromBody: Optional[Dict[str, object]] = None

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
    durationSeconds: float = Field(gt=0)
    outputStepSeconds: float = Field(gt=0)
