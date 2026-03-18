from pathlib import Path

from fastapi import APIRouter, Query

from app.core.ephemeris.bundled import BundledEphemeris

router = APIRouter(prefix="/ephemeris", tags=["ephemeris"])

DATA_PATH = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"


@router.get("/bodies")
def list_bodies(epoch: str = Query(...)) -> dict:
    ephemeris = BundledEphemeris(DATA_PATH)
    bodies = [
        {
            "bodyId": state.body_id,
            "epoch": state.epoch,
            "positionKm": list(state.position_km),
            "velocityKmPerSec": list(state.velocity_km_per_s),
            "muKm3PerS2": state.mu_km3_per_s2,
        }
        for state in ephemeris.get_all_body_states(epoch)
    ]
    return {
        "referenceFrame": "heliocentric-inertial",
        "epoch": epoch,
        "bodies": bodies,
    }
