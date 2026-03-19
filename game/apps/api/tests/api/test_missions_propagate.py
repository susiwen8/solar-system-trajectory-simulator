from fastapi.testclient import TestClient

from app.main import app


def test_propagate_returns_samples_and_metrics() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {
                "stateVector": {
                    "positionKm": [149597870.7, 0.0, 0.0],
                    "velocityKmPerSec": [0.0, 29.78, 0.0]
                }
            },
            "durationSeconds": 259200,
            "outputStepSeconds": 21600,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["samples"]) > 10
    assert "closestApproach" in data
    assert data["ephemerisSource"] == "bundled-keplerian"


def test_propagate_supports_auto_transfer_requests() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {
                "launchFromBody": {
                    "mode": "autoTransfer"
                }
            }
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["flightTimeSeconds"] > 100 * 24 * 3600
    assert len(data["samples"]) > 100
    assert "ephemerisSource" in data
    assert "missionTimeline" in data
    assert "events" in data["missionTimeline"]
    assert "phases" in data["missionTimeline"]
    assert "maneuverEvents" not in data
    assert "finalMassKg" not in data
    assert "totalPropellantUsedKg" not in data


def test_propagate_returns_ranked_gravity_assist_candidates_for_outer_planets() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "saturn",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {
                "launchFromBody": {
                    "mode": "autoTransfer"
                }
            }
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["candidates"]) >= 1
    assert len(data["sequenceBodies"]) >= 3
    assert "deltaVKmPerS" in data
    assert "flybyEvents" in data
    assert data["flybyEvents"]
    assert "missionTimeline" in data
    assert data["missionTimeline"]["phases"]
    assert "missionTimeline" in data["candidates"][0]
    assert "jupiter" in data["sequenceBodies"]
    assert data["closestApproach"]["distanceKm"] < 5_000.0


def test_propagate_returns_propulsion_fields_when_maneuvers_enabled() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/propagate",
        json={
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {
                "launchFromBody": {
                    "mode": "autoTransfer"
                }
            },
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
    assert "missionTimeline" in data
    assert "maneuverEvents" in data
    assert "finalMassKg" in data
    assert "totalPropellantUsedKg" in data
