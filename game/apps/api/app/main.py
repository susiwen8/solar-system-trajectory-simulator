from fastapi import FastAPI

from app.api.routes_missions import router as missions_router

app = FastAPI(title="Solar System Trajectory API")
app.include_router(missions_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
