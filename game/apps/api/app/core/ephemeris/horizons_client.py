from dataclasses import dataclass
from urllib.parse import urlencode

from app.core.ephemeris.horizons_import import parse_horizons_vector_csv


@dataclass(frozen=True)
class HorizonsRequest:
    body_id: str
    start_epoch: str
    stop_epoch: str
    step_size: str


BODY_COMMAND_IDS = {
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
}


def build_horizons_vectors_url(request: HorizonsRequest) -> str:
    query = urlencode(
        {
            "format": "text",
            "EPHEM_TYPE": "VECTORS",
            "CENTER": "500@10",
            "CSV_FORMAT": "YES",
            "COMMAND": BODY_COMMAND_IDS[request.body_id],
            "START_TIME": request.start_epoch,
            "STOP_TIME": request.stop_epoch,
            "STEP_SIZE": request.step_size,
        }
    )
    return f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}"


def parse_horizons_vectors_response(response_text: str) -> dict[str, dict[str, list[float]]]:
    return parse_horizons_vector_csv(response_text)
