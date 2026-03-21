from fastapi import FastAPI

from app.routes.bodies import bodies_router
from app.routes.health import health_router


def create_app() -> FastAPI:
    app = FastAPI(title="Trajectory API")
    app.include_router(bodies_router)
    app.include_router(health_router)
    return app
