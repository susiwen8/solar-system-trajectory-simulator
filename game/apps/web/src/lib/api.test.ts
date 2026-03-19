import { createApiUrl } from "./api";
import { propagateMission } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

it("keeps relative api paths when no base url is provided", () => {
  expect(createApiUrl("/missions/propagate", "")).toBe("/missions/propagate");
});

it("joins a configured api base url with the request path", () => {
  expect(createApiUrl("/ephemeris/bodies?epoch=2026-01-01T00%3A00%3A00Z", "http://127.0.0.1:8000/")).toBe(
    "http://127.0.0.1:8000/ephemeris/bodies?epoch=2026-01-01T00%3A00%3A00Z",
  );
});

it("parses maneuver events and propulsion metrics from mission results", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        referenceFrame: "heliocentric-inertial",
        ephemerisSource: "bundled-keplerian",
        samples: [],
        closestApproach: {
          bodyId: "mars",
          distanceKm: 10,
          epochSeconds: 100,
        },
        flightTimeSeconds: 1000,
        warnings: [],
        maneuverEvents: [
          {
            type: "TCM",
            startEpoch: "2026-01-02T00:00:00.000Z",
            durationSeconds: 3600,
            thrustDirection: "prograde",
            deltaVEstimateKmPerS: 0.002,
            propellantUsedKg: 1.2,
            massBeforeKg: 1800,
            massAfterKg: 1798.8,
          },
        ],
        finalMassKg: 1798.8,
        totalPropellantUsedKg: 1.2,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    ),
  );

  const result = await propagateMission({
    departureBody: "earth",
    targetBody: "mars",
    launchEpoch: "2026-01-01T00:00:00Z",
    initialState: {
      launchFromBody: { mode: "autoTransfer" },
    },
  });

  expect(result.maneuverEvents?.[0].type).toBe("TCM");
  expect(result.finalMassKg).toBeGreaterThan(0);
  expect(result.totalPropellantUsedKg).toBeGreaterThan(0);
});
