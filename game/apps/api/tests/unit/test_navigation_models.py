from app.schemas.mission import MissionRequest, MissionTourRequest, NavigationTelemetry


def test_mission_request_accepts_navigation_config() -> None:
    request = MissionRequest.model_validate(
        {
            "departureBody": "earth",
            "targetBody": "mars",
            "launchEpoch": "2026-01-01T00:00:00Z",
            "initialState": {"launchFromBody": {"mode": "autoTransfer"}},
            "navigationConfig": {
                "enabled": True,
                "randomSeed": 7,
                "injectionDispersion": {
                    "positionSigmaKm": 25.0,
                    "velocitySigmaKmPerS": 0.02,
                },
                "correctionPolicy": {
                    "maxTcmCount": 3,
                    "predictedMissThresholdKm": 25_000.0,
                    "positionDeviationThresholdKm": 5_000.0,
                    "velocityDeviationThresholdKmPerS": 0.05,
                    "checkpointStepSeconds": 432_000.0,
                    "maxCorrectionDeltaVKmPerS": 0.03,
                },
            },
        }
    )

    assert request.navigationConfig is not None
    assert request.navigationConfig.enabled is True
    assert request.navigationConfig.randomSeed == 7


def test_tour_request_accepts_navigation_config() -> None:
    request = MissionTourRequest.model_validate(
        {
            "departureBody": "earth",
            "requiredVisitBodies": ["venus", "jupiter"],
            "launchEpoch": "2026-01-01T00:00:00Z",
            "navigationConfig": {
                "enabled": True,
                "injectionDispersion": {
                    "positionSigmaKm": 10.0,
                    "velocitySigmaKmPerS": 0.01,
                },
                "correctionPolicy": {
                    "maxTcmCount": 2,
                    "predictedMissThresholdKm": 12_000.0,
                    "positionDeviationThresholdKm": 2_500.0,
                    "velocityDeviationThresholdKmPerS": 0.02,
                    "checkpointStepSeconds": 259_200.0,
                    "maxCorrectionDeltaVKmPerS": 0.02,
                },
            },
        }
    )

    assert request.navigationConfig is not None
    assert request.navigationConfig.correctionPolicy.maxTcmCount == 2


def test_navigation_telemetry_model_round_trips_samples() -> None:
    payload = NavigationTelemetry.model_validate(
        {
            "enabled": True,
            "nominalSamples": [
                {
                    "epochSeconds": 0.0,
                    "positionKm": [1.0, 2.0, 3.0],
                    "velocityKmPerSec": [0.1, 0.2, 0.3],
                }
            ],
            "dispersedSamples": [
                {
                    "epochSeconds": 0.0,
                    "positionKm": [1.5, 2.5, 3.5],
                    "velocityKmPerSec": [0.11, 0.21, 0.31],
                }
            ],
            "navigationEvents": [],
            "tcmCount": 0,
            "cumulativeCorrectionDeltaVKmPerS": 0.0,
            "maxPredictedMissKm": 0.0,
            "maxPositionDeviationKm": 0.0,
            "maxVelocityDeviationKmPerS": 0.0,
            "finalPredictedMissKm": 0.0,
        }
    )

    assert payload.enabled is True
    assert payload.nominalSamples[0].positionKm == (1.0, 2.0, 3.0)
    assert payload.dispersedSamples[0].velocityKmPerSec == (0.11, 0.21, 0.31)
