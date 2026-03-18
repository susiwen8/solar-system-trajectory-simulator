from app.services.mission_service import MissionService


def test_mission_service_returns_closest_approach_metric(bundled_ephemeris, sample_mission_request) -> None:
    service = MissionService(ephemeris=bundled_ephemeris)
    result = service.propagate(sample_mission_request)

    assert result.closest_approach["bodyId"] == "mars"
    assert result.flight_time_seconds > 0
    assert len(result.samples) > 1
