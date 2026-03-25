from fastapi import APIRouter


health_router = APIRouter(prefix="/api")


@health_router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}
