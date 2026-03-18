from pathlib import Path

import pytest

from app.core.ephemeris.bundled import BundledEphemeris
from app.schemas.mission import InitialStateInput, MissionRequest, StateVectorInput


@pytest.fixture
def bundled_ephemeris() -> BundledEphemeris:
    data_path = Path(__file__).resolve().parents[1] / "data/ephemeris/major_bodies.json"
    return BundledEphemeris(data_path)


@pytest.fixture
def sample_mission_request() -> MissionRequest:
    return MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(
            stateVector=StateVectorInput(
                positionKm=(149_597_870.7, 0.0, 0.0),
                velocityKmPerSec=(0.0, 29.78, 0.0),
            )
        ),
        durationSeconds=3 * 24 * 3600,
        outputStepSeconds=6 * 3600,
    )
