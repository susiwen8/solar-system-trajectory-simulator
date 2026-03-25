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


def test_launch_window_search_uses_lightweight_transfer_estimates_for_trajectory_candidates(
    bundled_ephemeris,
) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)
    sampled_epochs: list[str] = []

    class StubTransferPlanner:
        def plan_auto_transfer(self, departure_body: str, target_body: str, launch_epoch: str):
            raise AssertionError("launch window search should not call the full transfer propagator")

        def estimate_window_candidate(self, departure_body: str, target_body: str, launch_epoch: str):
            sampled_epochs.append(launch_epoch)
            return {
                "duration_seconds": 180.0 * 86_400.0,
                "delta_v_km_per_s": 4.2,
            }

    service.transfer_planner = StubTransferPlanner()

    result = service.search_trajectory_window(
        departure_body="earth",
        target_body="mars",
        earliest_launch_epoch="2026-01-01T00:00:00Z",
    )

    assert sampled_epochs
    assert result.candidate_launches
    assert result.candidate_launches[0].target_body == "mars"


def test_launch_window_search_uses_lightweight_tour_estimates_for_tour_candidates(
    bundled_ephemeris,
) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)
    sampled_epochs: list[str] = []

    class StubTourPlanner:
        def plan_tour(self, **kwargs):
            raise AssertionError("launch window search should not call the full tour planner")

        def estimate_tour_candidates(
            self,
            *,
            departure_body,
            required_visit_bodies,
            launch_epoch,
            max_assist_bodies_per_leg,
            max_returned_candidates,
            allow_assist_bodies,
            allow_repeated_flybys,
            propulsion_config,
        ):
            del departure_body, max_assist_bodies_per_leg, max_returned_candidates
            del allow_assist_bodies, allow_repeated_flybys, propulsion_config
            sampled_epochs.append(launch_epoch)
            return [
                type(
                    "Estimate",
                    (),
                    {
                        "score": 12.5,
                        "total_delta_v_km_per_s": 12.5,
                        "total_flight_time_seconds": 320.0 * 86_400.0,
                        "visit_order": tuple(required_visit_bodies),
                        "full_sequence_bodies": ("earth", *tuple(required_visit_bodies)),
                    },
                )()
            ]

    service.tour_planner = StubTourPlanner()

    result = service.search_tour_window(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        earliest_launch_epoch="2026-01-01T00:00:00Z",
    )

    assert sampled_epochs
    assert result.candidate_launches
    assert result.candidate_launches[0].visit_order == ("venus", "jupiter", "saturn")


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


def test_launch_window_search_reuses_overlapping_tour_epoch_estimates(bundled_ephemeris) -> None:
    service = LaunchWindowSearchService(ephemeris=bundled_ephemeris)
    sampled_epochs: list[str] = []
    search_start = "2026-01-01T00:00:00Z"
    coarse_epochs = service._candidate_epochs(search_start, service._search_horizon_days(mission_type="tour", target_body=None), 540)
    overlapped_epoch = coarse_epochs[-1]

    class StubTourPlanner:
        def estimate_tour_candidates(
            self,
            *,
            departure_body,
            required_visit_bodies,
            launch_epoch,
            max_assist_bodies_per_leg,
            max_returned_candidates,
            allow_assist_bodies,
            allow_repeated_flybys,
            propulsion_config,
        ):
            del departure_body, max_assist_bodies_per_leg, max_returned_candidates
            del allow_assist_bodies, allow_repeated_flybys, propulsion_config
            sampled_epochs.append(launch_epoch)
            score = 1.0 if launch_epoch == overlapped_epoch else 10.0
            return [
                type(
                    "Estimate",
                    (),
                    {
                        "score": score,
                        "total_delta_v_km_per_s": score,
                        "total_flight_time_seconds": 320.0 * 86_400.0,
                        "visit_order": tuple(required_visit_bodies),
                        "full_sequence_bodies": ("earth", *tuple(required_visit_bodies)),
                    },
                )()
            ]

    service.tour_planner = StubTourPlanner()

    result = service.search_tour_window(
        departure_body="earth",
        required_visit_bodies=("venus", "jupiter", "saturn"),
        earliest_launch_epoch=search_start,
    )

    assert result.candidate_launches
    assert sampled_epochs.count(overlapped_epoch) == 1
