from fastapi import FastAPI

app = FastAPI(title="Solar System Trajectory API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
