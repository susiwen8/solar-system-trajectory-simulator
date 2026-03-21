from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.core.config import TrajectorySettings
from app.data.horizons_client import HorizonsClient
from app.mission.models import MissionRequest, parse_timestamp
from app.mission.sampling import sample_candidate
from app.mission.search import MissionSearchService
from app.services.ephemeris_service import EphemerisService


missions_router = APIRouter(prefix="/api")


def get_settings() -> TrajectorySettings:
    return TrajectorySettings()


def get_ephemeris_service(
    settings: TrajectorySettings = Depends(get_settings),
) -> EphemerisService:
    return EphemerisService(
        cache_dir=settings.cache_dir,
        client=HorizonsClient(base_url=settings.horizons_base_url),
    )


def get_mission_search_service(
    ephemeris_service: EphemerisService = Depends(get_ephemeris_service),
) -> MissionSearchService:
    return MissionSearchService(ephemeris_service=ephemeris_service)


@missions_router.post("/missions/solve")
def solve_mission(
    request: MissionRequest,
    mission_search_service: MissionSearchService = Depends(get_mission_search_service),
) -> dict:
    candidates = mission_search_service.solve(**asdict(request))
    serialized_candidates = []
    for candidate in candidates:
        serialized_candidate = asdict(candidate)
        serialized_candidate["samples"] = asdict(sample_candidate(candidate, step_seconds=86400))
        serialized_candidates.append(serialized_candidate)

    warnings = []
    if not serialized_candidates:
        warnings.append(
            "No feasible route found in this launch window. Try widening the departure range or increasing maximum mission duration."
        )

    body_samples = {}
    for body_id in [request.origin, *request.targets]:
        result = mission_search_service.ephemeris_service.get_vectors(
            body_id,
            request.launch_window_start,
            request.launch_window_end,
            "30d",
        )
        body_samples[body_id] = [
            {
                "timestamp": parse_timestamp(record["timestamp"]).timestamp(),
                "positionKm": record["position_km"],
            }
            for record in result.records
        ]

    return {
        "candidates": serialized_candidates,
        "relevantBodies": [request.origin, *request.targets],
        "bodySamples": body_samples,
        "fidelity": {
            "ephemeris": "high",
            "transfer": "engineering approximation",
            "flyby": "patched-conic approximation",
        },
        "warnings": warnings,
    }
