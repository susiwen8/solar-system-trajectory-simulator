from app.services.parking_orbit_planner import ParkingOrbitPlanner


def test_plan_default_parking_orbit_returns_bound_earth_orbit() -> None:
    planner = ParkingOrbitPlanner()
    result = planner.plan_default_parking_orbit(
        launch_epoch="2026-01-01T00:00:00Z",
    )

    assert result.segment_type == "launchParkingOrbit"
    assert result.orbit_summary["isBound"] is True
    assert result.orbit_summary["periapsisKm"] > 6_378.1
    assert result.final_state["referenceBodyId"] == "earth"
