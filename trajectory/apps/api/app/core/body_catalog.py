from dataclasses import dataclass


@dataclass(frozen=True)
class BodyDefinition:
    id: str
    name: str
    horizons_id: str
    radius_km: float
    mu_km3_s2: float
    color_hex: str


BODY_CATALOG = {
    "mercury": BodyDefinition(
        id="mercury",
        name="Mercury",
        horizons_id="199",
        radius_km=2439.7,
        mu_km3_s2=22031.86855,
        color_hex="#a8a39a",
    ),
    "venus": BodyDefinition(
        id="venus",
        name="Venus",
        horizons_id="299",
        radius_km=6051.8,
        mu_km3_s2=324858.592,
        color_hex="#d9b38c",
    ),
    "earth": BodyDefinition(
        id="earth",
        name="Earth",
        horizons_id="399",
        radius_km=6378.1366,
        mu_km3_s2=398600.435436,
        color_hex="#4f83ff",
    ),
    "mars": BodyDefinition(
        id="mars",
        name="Mars",
        horizons_id="499",
        radius_km=3389.5,
        mu_km3_s2=42828.375214,
        color_hex="#c96b4a",
    ),
    "jupiter": BodyDefinition(
        id="jupiter",
        name="Jupiter",
        horizons_id="599",
        radius_km=69911.0,
        mu_km3_s2=126686534.0,
        color_hex="#d6b08f",
    ),
    "saturn": BodyDefinition(
        id="saturn",
        name="Saturn",
        horizons_id="699",
        radius_km=58232.0,
        mu_km3_s2=37931207.8,
        color_hex="#e3d2a2",
    ),
    "uranus": BodyDefinition(
        id="uranus",
        name="Uranus",
        horizons_id="799",
        radius_km=25362.0,
        mu_km3_s2=5793951.3,
        color_hex="#8ddde0",
    ),
    "neptune": BodyDefinition(
        id="neptune",
        name="Neptune",
        horizons_id="899",
        radius_km=24622.0,
        mu_km3_s2=6835099.5,
        color_hex="#507bff",
    ),
    "ceres": BodyDefinition(
        id="ceres",
        name="Ceres",
        horizons_id="Ceres",
        radius_km=473.0,
        mu_km3_s2=62.63,
        color_hex="#b4b4b4",
    ),
    "pluto": BodyDefinition(
        id="pluto",
        name="Pluto",
        horizons_id="999",
        radius_km=1188.3,
        mu_km3_s2=869.61,
        color_hex="#c8b5a0",
    ),
    "haumea": BodyDefinition(
        id="haumea",
        name="Haumea",
        horizons_id="Haumea",
        radius_km=816.0,
        mu_km3_s2=267.0,
        color_hex="#d6d6e5",
    ),
    "makemake": BodyDefinition(
        id="makemake",
        name="Makemake",
        horizons_id="Makemake",
        radius_km=715.0,
        mu_km3_s2=290.0,
        color_hex="#c98f6b",
    ),
    "eris": BodyDefinition(
        id="eris",
        name="Eris",
        horizons_id="Eris",
        radius_km=1163.0,
        mu_km3_s2=1108.0,
        color_hex="#d9e2e8",
    ),
}

