from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

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


class HorizonsApiClient:
    def __init__(self, *, timeout_seconds: float = 20.0) -> None:
        self.timeout_seconds = timeout_seconds

    def fetch_vectors(
        self,
        *,
        body_id: str,
        start_epoch: str,
        stop_epoch: str,
        step_size: str,
    ) -> dict[str, dict[str, list[float]]]:
        request = HorizonsRequest(
            body_id=body_id,
            start_epoch=start_epoch,
            stop_epoch=stop_epoch,
            step_size=step_size,
        )
        url = build_horizons_vectors_url(request)
        try:
            with urlopen(url, timeout=self.timeout_seconds) as response:
                response_text = response.read().decode("utf-8")
        except (HTTPError, URLError, OSError) as error:
            raise RuntimeError(f"Unable to fetch Horizons vectors for {body_id}") from error
        return parse_horizons_vectors_response(response_text)
