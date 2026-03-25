from pydantic import BaseModel


class BodySummary(BaseModel):
    id: str
    name: str
    horizons_id: str
    radius_km: float
    mu_km3_s2: float
    color_hex: str


class BodiesResponse(BaseModel):
    bodies: list[BodySummary]

