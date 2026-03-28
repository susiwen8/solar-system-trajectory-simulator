from app.services.navigation_thresholds import (
    classify_breach_reason,
    compute_state_deviation,
    summarize_predicted_miss,
)


def test_classify_breach_reason_handles_dual_thresholds() -> None:
    reason = classify_breach_reason(
        predicted_miss_km=50_000.0,
        predicted_miss_threshold_km=25_000.0,
        position_deviation_km=7_000.0,
        position_threshold_km=5_000.0,
        velocity_deviation_km_per_s=0.02,
        velocity_threshold_km_per_s=0.05,
    )

    assert reason == "both"


def test_classify_breach_reason_uses_velocity_threshold_for_state_breach() -> None:
    reason = classify_breach_reason(
        predicted_miss_km=10_000.0,
        predicted_miss_threshold_km=25_000.0,
        position_deviation_km=2_000.0,
        position_threshold_km=5_000.0,
        velocity_deviation_km_per_s=0.08,
        velocity_threshold_km_per_s=0.05,
    )

    assert reason == "stateDeviation"


def test_compute_state_deviation_returns_position_and_velocity_norms() -> None:
    metrics = compute_state_deviation(
        nominal_state=[10.0, 0.0, 0.0, 0.0, 5.0, 0.0],
        actual_state=[13.0, 4.0, 0.0, 0.0, 4.0, 0.0],
    )

    assert round(metrics.position_deviation_km, 6) == 5.0
    assert round(metrics.velocity_deviation_km_per_s, 6) == 1.0


def test_summarize_predicted_miss_uses_closest_sample_distance() -> None:
    predicted_miss_km = summarize_predicted_miss(
        sample_positions_km=[
            [100.0, 0.0, 0.0],
            [25.0, 0.0, 0.0],
            [80.0, 0.0, 0.0],
        ],
        body_positions_km=[
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
        ],
    )

    assert predicted_miss_km == 25.0
