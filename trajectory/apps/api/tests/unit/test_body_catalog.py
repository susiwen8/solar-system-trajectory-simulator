from app.core.body_catalog import BODY_CATALOG


def test_body_catalog_contains_planets_and_dwarf_planets() -> None:
    assert "earth" in BODY_CATALOG
    assert "jupiter" in BODY_CATALOG
    assert "pluto" in BODY_CATALOG
    assert "ceres" in BODY_CATALOG
    assert BODY_CATALOG["earth"].radius_km > BODY_CATALOG["pluto"].radius_km
    assert BODY_CATALOG["jupiter"].mu_km3_s2 > BODY_CATALOG["mars"].mu_km3_s2

