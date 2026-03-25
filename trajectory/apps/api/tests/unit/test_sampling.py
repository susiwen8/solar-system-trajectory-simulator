from app.mission.models import MissionCandidate, MissionLegCandidate, MissionSummary
from app.mission.sampling import sample_candidate


def test_sample_candidate_returns_monotonic_timestamps() -> None:
    example_candidate = MissionCandidate(
        id="candidate-a",
        summary=MissionSummary(
            label="recommended",
            total_duration_days=200.0,
            total_delta_v=5.0,
            score=0.8,
        ),
        legs=[
            MissionLegCandidate(
                departure_body_id="earth",
                arrival_body_id="mars",
                departure_time="2030-01-01T00:00:00Z",
                arrival_time="2030-07-20T00:00:00Z",
                departure_position_km=[149_597_870.7, 0.0, 0.0],
                arrival_position_km=[120_000_000.0, 190_000_000.0, 0.0],
                departure_velocity_km_s=[0.0, 29.78, 0.0],
                arrival_velocity_km_s=[-20.0, 15.0, 0.0],
                transfer_v1_km_s=[12.0, 20.0, 0.0],
                transfer_v2_km_s=[-18.0, 13.0, 0.0],
                delta_v_km_s=5.0,
            )
        ],
        warnings=[],
    )

    samples = sample_candidate(example_candidate, step_seconds=86400)

    timestamps = [sample.timestamp for sample in samples.spacecraft]
    assert timestamps == sorted(timestamps)
    assert len(samples.spacecraft) > 2

