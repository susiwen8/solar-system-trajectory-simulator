from fastapi.testclient import TestClient

from app.main import app


def test_plan_tour_returns_ranked_candidates() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["saturn", "venus", "jupiter"],
            "launchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["referenceFrame"] == "heliocentric-inertial"
    assert data["ephemerisSource"]
    assert len(data["candidates"]) >= 1
    assert "missionTimeline" in data
    assert data["missionTimeline"]["phases"]
    assert data["candidates"][0]["visitOrder"]
    assert "missionTimeline" in data["candidates"][0]
    assert data["candidates"][0]["missionTimeline"]["events"]
    assert "segments" in data
    assert "segments" in data["candidates"][0]
    assert any(
        any(segment["segmentType"] == "flybyEncounter" for segment in candidate["segments"])
        for candidate in data["candidates"]
        if candidate["flybyEvents"]
    )
    assert data["candidates"][0]["fullSequenceBodies"][0] == "earth"
    assert set(data["candidates"][0]["visitOrder"]) == {"venus", "jupiter", "saturn"}


def test_plan_tour_returns_sorted_candidates() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter", "saturn"],
            "launchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["candidates"]) >= 2
    assert data["candidates"][0]["score"] <= data["candidates"][1]["score"]


def test_plan_tour_returns_maneuver_fields_when_propulsion_enabled() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter", "saturn"],
            "launchEpoch": "2026-01-01T00:00:00Z",
            "propulsionConfig": {
                "initialMassKg": 1800,
                "propellantMassKg": 420,
                "maxThrustN": 0.8,
                "ispSeconds": 3200,
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "maneuverEvents" in data
    assert "finalMassKg" in data
    assert "totalPropellantUsedKg" in data


def test_plan_tour_accepts_more_than_four_required_visit_bodies() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["mercury", "venus", "mars", "jupiter", "saturn"],
            "launchEpoch": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["candidates"]
    assert set(data["candidates"][0]["visitOrder"]) == {"mercury", "venus", "mars", "jupiter", "saturn"}
