from app.services.launch_window_search import LaunchWindowSearchService


def test_launch_window_search_uses_shorter_horizon_for_inner_planets(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)

    horizon_days = service._search_horizon_days(mission_type="trajectory", target_body="mars")

    assert horizon_days == 730


def test_launch_window_search_returns_ranked_single_target_candidates(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)

    result = service.search_trajectory_window(
        departure_body="earth",
        target_body="mars",
        earliest_launch_epoch="2026-01-01T00:00:00Z",
    )

    assert result.recommended_launch_epoch.endswith("Z")
    assert result.window_start_epoch <= result.recommended_launch_epoch <= result.window_end_epoch
    assert len(result.candidate_launches) >= 1
    assert all(candidate.target_body == "mars" for candidate in result.candidate_launches)


def test_launch_window_search_returns_ranked_tour_candidates(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)

    result = service.search_tour_window(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        earliest_launch_epoch="2026-01-01T00:00:00Z",
    )

    assert result.recommended_launch_epoch.endswith("Z")
    assert result.window_start_epoch <= result.recommended_launch_epoch <= result.window_end_epoch
    assert result.candidate_launches
    assert result.candidate_launches[0].visit_order == ("venus", "jupiter", "saturn")
