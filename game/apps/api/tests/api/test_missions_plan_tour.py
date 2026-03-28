from fastapi.testclient import TestClient

from app.main import app


class FailingHorizonsClient:
    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        raise RuntimeError("network unavailable")


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


def test_plan_tour_returns_to_earth_when_enabled() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["mars"],
            "launchEpoch": "2026-01-01T00:00:00Z",
            "returnToDeparture": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["fullSequenceBodies"][0] == "earth"
    assert data["fullSequenceBodies"][-1] == "earth"
    assert data["closestApproach"]["bodyId"] == "earth"
    assert data["legs"][-1]["endBody"] == "earth"
    assert data["visitEvents"][-1]["bodyId"] == "earth"


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


def test_plan_tour_returns_navigation_payload_when_enabled() -> None:
    client = TestClient(app)
    response = client.post(
        "/missions/plan-tour",
        json={
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter"],
            "launchEpoch": "2026-01-01T00:00:00Z",
            "navigationConfig": {
                "enabled": True,
                "randomSeed": 4,
                "injectionDispersion": {
                    "positionSigmaKm": 25.0,
                    "velocitySigmaKmPerS": 0.02,
                },
                "correctionPolicy": {
                    "maxTcmCount": 2,
                    "predictedMissThresholdKm": 500.0,
                    "positionDeviationThresholdKm": 10.0,
                    "velocityDeviationThresholdKmPerS": 0.001,
                    "checkpointStepSeconds": 86_400.0,
                    "maxCorrectionDeltaVKmPerS": 0.02,
                },
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "navigationTelemetry" in data
    assert data["navigationTelemetry"]["enabled"] is True
    assert data["navigationTelemetry"]["navigationEvents"]
    assert data["samples"] == data["navigationTelemetry"]["dispersedSamples"]
    assert "navigationTelemetry" in data["candidates"][0]


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


def test_plan_tour_falls_back_cleanly_when_online_jpl_is_unavailable(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "1")
    monkeypatch.setenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.core.ephemeris.factory._build_online_client",
        lambda: FailingHorizonsClient(),
    )

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
    assert data["candidates"]
