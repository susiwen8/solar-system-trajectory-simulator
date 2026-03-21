from fastapi import APIRouter

from app.core.body_catalog import BODY_CATALOG
from app.core.schemas import BodiesResponse


bodies_router = APIRouter(prefix="/api")


@bodies_router.get("/bodies", response_model=BodiesResponse)
def get_bodies() -> BodiesResponse:
    bodies = [
        definition.__dict__
        for _, definition in sorted(BODY_CATALOG.items(), key=lambda item: item[0])
    ]
    return BodiesResponse(bodies=bodies)

