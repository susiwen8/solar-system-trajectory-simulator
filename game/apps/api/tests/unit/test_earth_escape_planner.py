from app.services.earth_escape_planner import EarthEscapePlanner
from app.services.parking_orbit_planner import ParkingOrbitPlanner


def test_plan_earth_escape_returns_heliocentric_boundary_state(bundled_ephemeris) -> None:
    parking_result = ParkingOrbitPlanner().plan_default_parking_orbit(
        launch_epoch="2026-01-01T00:00:00Z",
    )
    planner = EarthEscapePlanner(ephemeris=bundled_ephemeris)

    result = planner.plan_escape(
        launch_epoch="2026-01-01T00:00:00Z",
        parking_final_state=parking_result.final_state,
        target_body="mars",
    )

    assert result.segment_type == "earthEscape"
    assert result.final_state["referenceFrame"] == "heliocentric-inertial"
    assert result.events[-1]["type"] == "earthSoiExit"
