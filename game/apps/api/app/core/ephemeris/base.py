from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class BodyState:
    body_id: str
    epoch: str
    position_km: tuple[float, float, float]
    velocity_km_per_s: tuple[float, float, float]
    mu_km3_per_s2: float
    source_name: str = "unknown"


MAJOR_BODY_IDS = (
    "sun",
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
)


class Ephemeris(Protocol):
    @property
    def source_name(self) -> str:
        ...

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        ...

    def get_all_body_states(self, epoch: str) -> list[BodyState]:
        ...
