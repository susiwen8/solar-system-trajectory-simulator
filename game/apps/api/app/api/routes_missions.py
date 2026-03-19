from pathlib import Path

from fastapi import APIRouter, Response, status

from app.core.ephemeris.factory import create_ephemeris
from app.schemas.mission import MissionRequest
from app.services.gravity_assist_search import GravityAssistSearchService
from app.services.mission_service import MissionService

router = APIRouter(prefix="/missions", tags=["missions"])

DATA_PATH = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"


@router.post("/validate-initial-state", status_code=status.HTTP_204_NO_CONTENT)
def validate_initial_state(_: MissionRequest) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/propagate")
def propagate_mission(request: MissionRequest) -> dict:
    service = MissionService(ephemeris=create_ephemeris(DATA_PATH))
    return service.propagate(request).to_dict()


@router.post("/search-gravity-assist")
def search_gravity_assist(request: MissionRequest) -> dict:
    search_service = GravityAssistSearchService(ephemeris=create_ephemeris(DATA_PATH))
    candidates = search_service.search(
        departure_body=request.departureBody,
        target_body=request.targetBody,
        launch_epoch=request.launchEpoch,
    )
    return {
        "ephemerisSource": getattr(search_service.ephemeris, "source_name", "unknown"),
        "candidates": [candidate.to_dict() for candidate in candidates],
    }
