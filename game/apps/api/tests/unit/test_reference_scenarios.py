from app.services.mission_service import MissionService


def test_earth_to_mars_reference_scenario_stays_within_expected_bounds(
    bundled_ephemeris,
    sample_mission_request,
) -> None:
    result = MissionService(ephemeris=bundled_ephemeris).propagate(sample_mission_request)

    assert 24 * 3600 <= result.flight_time_seconds <= 10 * 24 * 3600
    assert result.closest_approach["distanceKm"] > 0
    assert result.reference_frame == "heliocentric-inertial"


def test_earth_to_mars_auto_transfer_reference_scenario_reaches_planetary_scale_closest_approach(
    bundled_ephemeris,
) -> None:
    from app.schemas.mission import InitialStateInput, MissionRequest

    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
        durationSeconds=None,
        outputStepSeconds=None,
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    assert 100 * 24 * 3600 <= result.flight_time_seconds <= 500 * 24 * 3600
    assert result.closest_approach["distanceKm"] < 2_000_000
