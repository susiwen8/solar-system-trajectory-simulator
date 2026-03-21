from dataclasses import dataclass, field
from datetime import UTC, datetime


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


@dataclass(frozen=True)
class MissionRequest:
    targets: list[str]
    launch_window_start: str
    launch_window_end: str
    max_duration_days: float
    min_leg_duration_days: float
    max_leg_duration_days: float
    time_weight: float
    allow_gravity_assists: bool
    flyby_altitude_multiplier: float
    origin: str = "earth"

    def __post_init__(self) -> None:
        if not self.targets:
            raise ValueError("At least one target must be selected")
        if parse_timestamp(self.launch_window_end) < parse_timestamp(self.launch_window_start):
            raise ValueError("launch_window_end must not precede launch_window_start")
        if self.max_duration_days <= 0:
            raise ValueError("max_duration_days must be positive")
        if self.min_leg_duration_days <= 0 or self.max_leg_duration_days <= 0:
            raise ValueError("Leg durations must be positive")
        if self.min_leg_duration_days > self.max_leg_duration_days:
            raise ValueError("min_leg_duration_days must be <= max_leg_duration_days")


@dataclass
class MissionLegCandidate:
    departure_body_id: str
    arrival_body_id: str
    departure_time: str
    arrival_time: str
    departure_position_km: list[float]
    arrival_position_km: list[float]
    departure_velocity_km_s: list[float]
    arrival_velocity_km_s: list[float]
    transfer_v1_km_s: list[float]
    transfer_v2_km_s: list[float]
    delta_v_km_s: float
    flyby_status: str | None = None


@dataclass
class MissionSummary:
    label: str
    total_duration_days: float
    total_delta_v: float
    score: float


@dataclass
class MissionCandidate:
    id: str
    summary: MissionSummary
    legs: list[MissionLegCandidate]
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SpacecraftSample:
    timestamp: float
    position_km: list[float]


@dataclass(frozen=True)
class MissionSamples:
    spacecraft: list[SpacecraftSample]

