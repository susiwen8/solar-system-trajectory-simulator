from fastapi.testclient import TestClient

from app.main import app


class FailingHorizonsClient:
    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        raise RuntimeError("network unavailable")


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
    cruise_segment = next(segment for segment in data["segments"] if segment["segmentType"] == "heliocentricCruise")
    assert cruise_segment["metadata"]["maneuverCount"] == len(data["maneuverEvents"])
    assert cruise_segment["massSummary"]["massAfterKg"] == data["finalMassKg"]
    assert cruise_segment["massSummary"]["propellantUsedKg"] == data["totalPropellantUsedKg"]


def test_propagate_returns_navigation_payload_when_enabled() -> None:
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
                    "velocityKmPerSec": [0.0, 29.78, 0.0],
                }
            },
            "durationSeconds": 259200,
            "outputStepSeconds": 21600,
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
                    "checkpointStepSeconds": 21600,
                    "maxCorrectionDeltaVKmPerS": 0.02,
                },
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "navigationTelemetry" in data
    assert data["navigationTelemetry"]["enabled"] is True
    assert data["navigationTelemetry"]["nominalSamples"]
    assert data["navigationTelemetry"]["dispersedSamples"]
    assert data["samples"] == data["navigationTelemetry"]["dispersedSamples"]


def test_propagate_returns_launch_and_escape_segments() -> None:
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
    assert "segments" in data
    assert data["segments"][0]["segmentType"] == "launchParkingOrbit"
    segment_types = [segment["segmentType"] for segment in data["segments"]]
    assert "launchParkingOrbit" in segment_types
    assert "earthEscape" in segment_types
    assert "heliocentricCruise" in segment_types
    assert "arrivalHyperbolicApproach" in segment_types
    assert "orbitInsertionBurn" in segment_types
    assert "parkingOrbit" in segment_types
    cruise_segment = next(segment for segment in data["segments"] if segment["segmentType"] == "heliocentricCruise")
    arrival_approach_segment = next(segment for segment in data["segments"] if segment["segmentType"] == "arrivalHyperbolicApproach")
    insertion_burn_segment = next(segment for segment in data["segments"] if segment["segmentType"] == "orbitInsertionBurn")
    parking_orbit_segment = next(segment for segment in data["segments"] if segment["segmentType"] == "parkingOrbit")
    assert cruise_segment["metadata"]["targetBody"] == "mars"
    assert "massSummary" in cruise_segment
    assert any(event["type"] == "earthSoiExit" for event in data["missionTimeline"]["events"])
    assert any(event["type"] == "hyperbolicPeriapsis" for event in arrival_approach_segment["events"])
    assert any(event["type"] == "orbitInsertionBurnStart" for event in insertion_burn_segment["events"])
    assert parking_orbit_segment["orbitSummary"]["isBound"] is True
    assert parking_orbit_segment["samples"]
    assert any(event["type"] == "captureEstablished" for event in data["missionTimeline"]["events"])


def test_propagate_falls_back_cleanly_when_online_jpl_is_unavailable(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "1")
    monkeypatch.setenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.core.ephemeris.factory._build_online_client",
        lambda: FailingHorizonsClient(),
    )

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
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["samples"]) > 100
