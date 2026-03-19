from typing import Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field, model_validator


class StateVectorInput(BaseModel):
    positionKm: Tuple[float, float, float]
    velocityKmPerSec: Tuple[float, float, float]


class LaunchFromBodyInput(BaseModel):
    mode: Literal["autoTransfer"] = "autoTransfer"


class LaunchProfile(BaseModel):
    mode: Literal["parkingOrbit"] = "parkingOrbit"
    parkingOrbitAltitudeKm: float = Field(default=400.0, gt=0)
    parkingOrbitInclinationDeg: float = Field(default=28.5, ge=0, le=180)
    parkingOrbitCoastSeconds: float = Field(default=1800.0, ge=0)


class InitialStateInput(BaseModel):
    stateVector: Optional[StateVectorInput] = None
    launchFromBody: Optional[LaunchFromBodyInput] = None

    @model_validator(mode="after")
    def ensure_exactly_one_mode(self) -> "InitialStateInput":
        if (self.stateVector is None) == (self.launchFromBody is None):
            raise ValueError("Provide exactly one initial-state mode")
        return self


class PropulsionConfig(BaseModel):
    initialMassKg: float = Field(gt=0)
    propellantMassKg: float = Field(ge=0)
    maxThrustN: float = Field(gt=0)
    ispSeconds: float = Field(gt=0)

    @model_validator(mode="after")
    def validate_propellant_budget(self) -> "PropulsionConfig":
        if self.propellantMassKg >= self.initialMassKg:
            raise ValueError("propellantMassKg must be less than initialMassKg")
        return self


class ManeuverEvent(BaseModel):
    type: str = Field(min_length=1)
    startEpoch: str = Field(min_length=1)
    durationSeconds: float = Field(ge=0)
    thrustDirection: str = Field(min_length=1)
    deltaVEstimateKmPerS: float = Field(ge=0)
    propellantUsedKg: float = Field(ge=0)
    massBeforeKg: float = Field(gt=0)
    massAfterKg: float = Field(gt=0)


class MissionTimelineEvent(BaseModel):
    id: str = Field(min_length=1)
    type: str = Field(min_length=1)
    epoch: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    relatedBody: Optional[str] = None


class MissionPhase(BaseModel):
    id: str = Field(min_length=1)
    type: str = Field(min_length=1)
    startEpoch: str = Field(min_length=1)
    endEpoch: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    relatedBody: Optional[str] = None
    eventIds: List[str] = Field(default_factory=list)


class MissionTimeline(BaseModel):
    events: List[MissionTimelineEvent] = Field(default_factory=list)
    phases: List[MissionPhase] = Field(default_factory=list)
    currentObjective: Optional[str] = None
    missionStartEpoch: str = Field(min_length=1)
    missionEndEpoch: str = Field(min_length=1)


class ParkingOrbitSummary(BaseModel):
    periapsisKm: float = Field(gt=0)
    apoapsisKm: float = Field(gt=0)
    inclinationDeg: float = Field(ge=0, le=180)
    orbitalPeriodSeconds: float = Field(gt=0)
    isBound: bool = True


class MissionSegmentBoundaryState(BaseModel):
    epoch: str = Field(min_length=1)
    referenceFrame: str = Field(min_length=1)
    referenceBodyId: Optional[str] = None
    positionKm: Tuple[float, float, float]
    velocityKmPerSec: Tuple[float, float, float]


class MissionSegment(BaseModel):
    segmentType: str = Field(min_length=1)
    startEpoch: str = Field(min_length=1)
    endEpoch: str = Field(min_length=1)
    referenceFrame: str = Field(min_length=1)
    events: List[MissionTimelineEvent] = Field(default_factory=list)
    samples: List[Dict[str, object]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    initialState: Optional[MissionSegmentBoundaryState] = None
    finalState: Optional[MissionSegmentBoundaryState] = None
    orbitSummary: Optional[ParkingOrbitSummary] = None
    metadata: Dict[str, object] = Field(default_factory=dict)


class MissionRequest(BaseModel):
    departureBody: str = Field(min_length=1)
    targetBody: str = Field(min_length=1)
    launchEpoch: str = Field(min_length=1)
    initialState: InitialStateInput
    launchProfile: Optional[LaunchProfile] = None
    durationSeconds: Optional[float] = Field(default=None, gt=0)
    outputStepSeconds: Optional[float] = Field(default=None, gt=0)
    propulsionConfig: Optional[PropulsionConfig] = None


class MissionTourRequest(BaseModel):
    departureBody: str = Field(min_length=1)
    requiredVisitBodies: List[str] = Field(min_length=1, max_length=4)
    launchEpoch: str = Field(min_length=1)
    maxAssistBodiesPerLeg: int = Field(default=2, ge=0, le=2)
    maxReturnedCandidates: int = Field(default=5, ge=1, le=10)
    allowAssistBodies: bool = True
    allowRepeatedFlybys: bool = True
    propulsionConfig: Optional[PropulsionConfig] = None

    @model_validator(mode="after")
    def validate_required_visit_bodies(self) -> "MissionTourRequest":
        unique_bodies = set(self.requiredVisitBodies)
        if len(unique_bodies) != len(self.requiredVisitBodies):
            raise ValueError("requiredVisitBodies must be unique")
        if self.departureBody in unique_bodies:
            raise ValueError("requiredVisitBodies cannot include the departure body")
        return self
