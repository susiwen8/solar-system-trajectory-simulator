from app.services.mission_service import MissionService


def test_earth_to_mars_reference_scenario_stays_within_expected_bounds(
    bundled_ephemeris,
    sample_mission_request,
) -> None:
    result = MissionService(ephemeris=bundled_ephemeris).propagate(sample_mission_request)

    assert 24 * 3600 <= result.flight_time_seconds <= 10 * 24 * 3600
    assert result.closest_approach["distanceKm"] > 0
    assert result.reference_frame == "heliocentric-inertial"
