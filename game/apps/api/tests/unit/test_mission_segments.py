from app.services.mission_segments import merge_segment_samples


def test_merge_segment_samples_offsets_epochs_monotonically() -> None:
    merged = merge_segment_samples(
        [
            {"segmentType": "launchParkingOrbit", "samples": [{"epochSeconds": 0.0}, {"epochSeconds": 10.0}]},
            {"segmentType": "earthEscape", "samples": [{"epochSeconds": 0.0}, {"epochSeconds": 5.0}]},
        ]
    )

    assert merged[0]["epochSeconds"] == 0.0
    assert merged[-1]["epochSeconds"] >= merged[0]["epochSeconds"]
    assert merged[-1]["epochSeconds"] > merged[1]["epochSeconds"]
