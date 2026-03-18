from pathlib import Path

from fastapi import APIRouter, Response, status

from app.core.ephemeris.bundled import BundledEphemeris
from app.schemas.mission import MissionRequest
from app.services.mission_service import MissionService

router = APIRouter(prefix="/missions", tags=["missions"])

DATA_PATH = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"


@router.post("/validate-initial-state", status_code=status.HTTP_204_NO_CONTENT)
def validate_initial_state(_: MissionRequest) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/propagate")
def propagate_mission(request: MissionRequest) -> dict:
    service = MissionService(ephemeris=BundledEphemeris(DATA_PATH))
    return service.propagate(request).to_dict()
