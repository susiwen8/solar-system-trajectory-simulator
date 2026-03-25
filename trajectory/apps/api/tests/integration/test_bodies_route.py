from fastapi.testclient import TestClient

from app.main import create_app


def test_bodies_route_returns_sorted_supported_bodies() -> None:
    client = TestClient(create_app())

    response = client.get("/api/bodies")

    payload = response.json()
    assert response.status_code == 200
    assert payload["bodies"][0]["id"] == "ceres"
    assert any(body["id"] == "earth" for body in payload["bodies"])
    assert any(body["id"] == "eris" for body in payload["bodies"])
