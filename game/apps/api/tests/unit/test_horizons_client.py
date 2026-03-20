from app.core.ephemeris.horizons_client import (
    HorizonsRequest,
    build_horizons_vectors_url,
    parse_horizons_vectors_response,
)


def test_build_horizons_vectors_url_includes_body_and_window() -> None:
    request = HorizonsRequest(
        body_id="earth",
        start_epoch="2026-01-01T00:00:00Z",
        stop_epoch="2026-01-03T00:00:00Z",
        step_size="12h",
    )

    url = build_horizons_vectors_url(request)

    assert "COMMAND=399" in url
    assert "EPHEM_TYPE=VECTORS" in url
    assert "STEP_SIZE=12h" in url


def test_parse_horizons_vectors_response_returns_samples() -> None:
    response_text = """Target body name: Earth (399)
$$SOE
2457388.500000000, A.D. 2026-Jan-01 00:00:00.0000, -24856124.0, 144936962.0, -6980.0, -29.837, -5.127, 0.0002
2457389.000000000, A.D. 2026-Jan-01 12:00:00.0000, -26137982.0, 144676912.0, -6967.0, -29.782, -5.385, 0.0002
$$EOE
"""

    samples = parse_horizons_vectors_response(response_text)

    assert "2026-01-01T00:00:00Z" in samples
    assert samples["2026-01-01T12:00:00Z"]["positionKm"][0] == -26_137_982.0
