from app.services.mission_service import MissionService


def test_mission_service_returns_closest_approach_metric(bundled_ephemeris, sample_mission_request) -> None:
    service = MissionService(ephemeris=bundled_ephemeris)
    result = service.propagate(sample_mission_request)

    assert result.closest_approach["bodyId"] == "mars"
    assert result.flight_time_seconds > 0
    assert len(result.samples) > 1


def test_mission_service_warns_for_extreme_probe_distance(bundled_ephemeris, sample_mission_request) -> None:
    service = MissionService(ephemeris=bundled_ephemeris)
    request = sample_mission_request.model_copy(
        update={
            "initialState": sample_mission_request.initialState.model_copy(
                update={
                    "stateVector": sample_mission_request.initialState.stateVector.model_copy(
                        update={
                            "positionKm": (5_000_000_000.0, 0.0, 0.0),
                            "velocityKmPerSec": (0.0, 0.0, 0.0)
                        }
                    )
                }
            )
        }
    )

    result = service.propagate(request)

    assert any("distance" in warning.lower() for warning in result.warnings)
