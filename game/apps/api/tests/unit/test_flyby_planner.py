from app.services.flyby_planner import FlybyPlanner


def test_flyby_planner_builds_geometry_rich_segment() -> None:
    planner = FlybyPlanner()

    segment = planner.plan_segment(
        body_id="jupiter",
        periapsis_epoch="2027-03-01T12:00:00.000Z",
        periapsis_altitude_km=75_000.0,
        turn_angle_deg=28.0,
        inbound_v_infinity_km_per_s=6.1,
        outbound_v_infinity_km_per_s=6.0,
        position_km=(778_500_000.0, 0.0, 0.0),
    )

    assert segment.segment_type == "gravityAssistFlyby"
    assert segment.metadata["bodyId"] == "jupiter"
    assert segment.metadata["turnAngleDeg"] == 28.0
    assert segment.metadata["periapsisAltitudeKm"] == 75_000.0
    assert "bPlaneLike" in segment.metadata
    assert segment.events[1]["type"] == "flybyPeriapsis"
