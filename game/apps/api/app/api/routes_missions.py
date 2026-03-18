from fastapi import APIRouter, Response, status

from app.schemas.mission import MissionRequest

router = APIRouter(prefix="/missions", tags=["missions"])


@router.post("/validate-initial-state", status_code=status.HTTP_204_NO_CONTENT)
def validate_initial_state(_: MissionRequest) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
