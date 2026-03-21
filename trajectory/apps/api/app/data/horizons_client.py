import httpx


class HorizonsClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url

    def fetch_vectors(
        self,
        body_id: str,
        start_time: str,
        stop_time: str,
        step_size: str,
    ) -> list[dict]:
        response = httpx.get(
            self.base_url,
            params={
                "format": "json",
                "COMMAND": body_id,
                "EPHEM_TYPE": "VECTORS",
                "START_TIME": start_time,
                "STOP_TIME": stop_time,
                "STEP_SIZE": step_size,
                "CENTER": "500@10",
                "OUT_UNITS": "KM-S",
                "REF_PLANE": "ECLIPTIC",
                "REF_SYSTEM": "ICRF",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        return payload.get("vectors", [])

