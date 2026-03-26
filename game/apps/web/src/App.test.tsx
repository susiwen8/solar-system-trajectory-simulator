import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

const EMPTY_PREVIEW_EPOCH = "2026-01-01T00:00:00Z";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

function hasExactTextContent(text: string) {
  return (_content: string, node: Element | null) => node?.textContent === text;
}

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createEphemerisResponse(
  overrides: {
    epoch?: string;
    ephemerisSource?: string;
    bodies?: Array<Record<string, unknown>>;
  } = {},
) {
  const epoch = overrides.epoch ?? EMPTY_PREVIEW_EPOCH;
  return createJsonResponse({
    referenceFrame: "heliocentric-inertial",
    epoch,
    ephemerisSource: overrides.ephemerisSource ?? "mixed",
    bodies:
      overrides.bodies ?? [
        {
          bodyId: "sun",
          epoch,
          positionKm: [0, 0, 0],
          velocityKmPerSec: [0, 0, 0],
          muKm3PerS2: 132712440018,
          sourceName: "keplerian-elements",
        },
        {
          bodyId: "earth",
          epoch,
          positionKm: [-24856124, 144936962, 0],
          velocityKmPerSec: [-29.837, -5.127, 0],
          muKm3PerS2: 398600.435436,
          sourceName: "jpl-horizons-file",
        },
        {
          bodyId: "mars",
          epoch,
          positionKm: [-159185432, 188245763, 7650983],
          velocityKmPerSec: [-17.235, -13.254, 0.156],
          muKm3PerS2: 42828.375816,
          sourceName: "jpl-horizons-file",
        },
      ],
  });
}

function createLaunchWindowResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return createJsonResponse({
      recommendedLaunchEpoch: "2026-01-01T00:00:00Z",
      windowStartEpoch: "2025-12-15T00:00:00Z",
      windowEndEpoch: "2026-01-15T00:00:00Z",
      candidateLaunches: [
        {
          launchEpoch: "2026-01-01T00:00:00Z",
          score: 1.2,
          deltaVKmPerS: 3.4,
          flightTimeSeconds: 259200,
        },
      ],
      searchSummary: {
        searchStartEpoch: "2026-01-01T00:00:00Z",
        searchEndEpoch: "2028-01-01T00:00:00Z",
        coarseSampleCount: 5,
        refinedCandidateCount: 2,
        scoringMode: "trajectory-delta-v-first",
      },
      warnings: [],
      ...overrides,
    });
}

function renderAtPath(pathname: string) {
  window.history.pushState({}, "", pathname);
  return render(<App />);
}

it("renders the simulator page at /", () => {
  renderAtPath("/");

  expect(screen.getByRole("heading", { name: "太阳系轨迹模拟器" })).toBeInTheDocument();
});

it("renders the recovery page at /spacex-recovery", () => {
  renderAtPath("/spacex-recovery");

  expect(screen.getByRole("heading", { name: "SpaceX 回收任务" })).toBeInTheDocument();
  expect(screen.getByText("回收任务占位页")).toBeInTheDocument();
});

it("updates browser history when switching pages from the nav", async () => {
  renderAtPath("/");

  await userEvent.click(screen.getByRole("link", { name: "回收任务" }));

  expect(window.location.pathname).toBe("/spacex-recovery");
});

it("renders the simulator heading", () => {
  render(<App />);
  expect(screen.getByText("太阳系轨迹模拟器")).toBeInTheDocument();
  expect(screen.getByLabelText("任务控制面板")).toBeInTheDocument();
  expect(screen.getByLabelText("主飞行视图")).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("data-scroll-mode", "viewport-locked");
});

it("switches visible interface copy to English", async () => {
  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: "EN" }));

  expect(screen.getByText("Solar System Trajectory Simulator")).toBeInTheDocument();
  expect(screen.getByLabelText("Mission Control Panel")).toBeInTheDocument();
  expect(screen.getByLabelText("Primary Flight View")).toBeInTheDocument();
  expect(screen.getByText("Mission Input")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Propagate Trajectory" })).toBeInTheDocument();
});

it("shows the orbit preview in the empty scene instead of the old placeholder copy", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    createEphemerisResponse({
      bodies: [
        {
          bodyId: "sun",
          epoch: EMPTY_PREVIEW_EPOCH,
          positionKm: [0, 0, 0],
          velocityKmPerSec: [0, 0, 0],
          muKm3PerS2: 132712440018,
          sourceName: "keplerian-elements",
        },
        {
          bodyId: "earth",
          epoch: EMPTY_PREVIEW_EPOCH,
          positionKm: [-24856124, 144936962, 0],
          velocityKmPerSec: [-29.837, -5.127, 0],
          muKm3PerS2: 398600.435436,
          sourceName: "jpl-horizons-file",
        },
      ],
    }),
  );

  render(<App />);

  expect(await screen.findByTestId("empty-orbit-preview")).toBeInTheDocument();
  expect(screen.queryByText("运行任务后即可描绘轨迹")).not.toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith("/ephemeris/bodies?epoch=2026-01-01T00%3A00%3A00Z");
});

it("formats long upcoming event durations as years, months, and days", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
        referenceFrame: "heliocentric-inertial",
        samples: [
          {
            epochSeconds: 0,
            positionKm: [149597870.7, 0, 0],
            velocityKmPerSec: [0, 29.78, 0],
          },
        ],
        closestApproach: {
          bodyId: "mars",
          distanceKm: 8450000,
          epochSeconds: 0,
        },
        missionTimeline: {
          missionStartEpoch: "2026-01-01T00:00:00.000Z",
          missionEndEpoch: "2027-02-05T00:00:00.000Z",
          currentObjective: "Arrive at Mars",
          events: [
            {
              id: "event-001",
              type: "targetApproach",
              epoch: "2027-02-05T00:00:00.000Z",
              title: "Mars Approach",
              description: "Begin final approach.",
            },
          ],
          phases: [
            {
              id: "phase-001",
              type: "deepSpaceCruise",
              startEpoch: "2026-01-01T00:00:00.000Z",
              endEpoch: "2027-02-05T00:00:00.000Z",
              title: "Deep-Space Cruise",
              description: "Cruise between mission events.",
              eventIds: ["event-001"],
            },
          ],
        },
        ephemerisSource: "bundled-keplerian",
        flightTimeSeconds: 400 * 86_400,
        warnings: [],
      }),
    )
    .mockResolvedValueOnce(createEphemerisResponse({ epoch: "2026-01-01T00:00:00.000Z" }));

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("下一事件: Mars Approach · 1 年 1 月 5 天后")).toBeInTheDocument();
});

it("shows the mission metrics panel after propagation results load", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          samples: [
            {
              epochSeconds: 0,
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0]
            },
            {
              epochSeconds: 21600,
              positionKm: [149500000, 643248, 0],
              velocityKmPerSec: [-0.1, 29.77, 0]
            }
          ],
          closestApproach: {
            bodyId: "mars",
            distanceKm: 8450000,
            epochSeconds: 21600
          },
          segments: [
            {
              segmentType: "launchParkingOrbit",
              startEpoch: "2026-01-01T00:00:00.000Z",
              endEpoch: "2026-01-01T01:30:00.000Z",
              samples: [],
              initialState: {
                epoch: "2026-01-01T00:00:00.000Z",
                referenceFrame: "earth-centered-inertial",
                referenceBodyId: "earth",
                positionKm: [6678.1, 0, 0],
                velocityKmPerSec: [0, 7.7, 0]
              },
              finalState: {
                epoch: "2026-01-01T01:30:00.000Z",
                referenceFrame: "earth-centered-inertial",
                referenceBodyId: "earth",
                positionKm: [6678.1, 0, 0],
                velocityKmPerSec: [0, 7.7, 0]
              },
              events: [],
              orbitSummary: {
                isBound: true,
                periapsisKm: 6678.1,
                apoapsisKm: 6678.1,
                inclinationDeg: 28.5
              }
            },
            {
              segmentType: "earthEscape",
              startEpoch: "2026-01-01T01:30:00.000Z",
              endEpoch: "2026-01-01T07:30:00.000Z",
              samples: [],
              initialState: {
                epoch: "2026-01-01T01:30:00.000Z",
                referenceFrame: "earth-centered-inertial",
                referenceBodyId: "earth",
                positionKm: [6678.1, 0, 0],
                velocityKmPerSec: [0, 10.9, 0]
              },
              finalState: {
                epoch: "2026-01-01T07:30:00.000Z",
                referenceFrame: "heliocentric-inertial",
                positionKm: [149597870.7, 0, 0],
                velocityKmPerSec: [0, 32.7, 0]
              },
              events: []
            },
            {
              segmentType: "heliocentricCruise",
              startEpoch: "2026-01-01T07:30:00.000Z",
              endEpoch: "2026-01-04T00:00:00.000Z",
              samples: [],
              initialState: {
                epoch: "2026-01-01T07:30:00.000Z",
                referenceFrame: "heliocentric-inertial",
                positionKm: [149597870.7, 0, 0],
                velocityKmPerSec: [0, 32.7, 0]
              },
              finalState: {
                epoch: "2026-01-04T00:00:00.000Z",
                referenceFrame: "heliocentric-inertial",
                positionKm: [149500000, 643248, 0],
                velocityKmPerSec: [-0.1, 29.77, 0]
              },
              events: []
            },
            {
              segmentType: "arrivalHyperbolicApproach",
              startEpoch: "2026-01-04T00:00:00.000Z",
              endEpoch: "2026-01-04T00:00:00.000Z",
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [9800, 0, -4800],
                  velocityKmPerSec: [0, 0, 3.4]
                },
                {
                  epochSeconds: 1800,
                  positionKm: [5600, 0, -1500],
                  velocityKmPerSec: [0, 0, 3.1]
                },
                {
                  epochSeconds: 3600,
                  positionKm: [4200, 0, 0],
                  velocityKmPerSec: [0, 0, 2.8]
                }
              ],
              initialState: {
                epoch: "2026-01-04T00:00:00.000Z",
                referenceFrame: "mars-centered-inertial",
                referenceBodyId: "mars",
                positionKm: [9800, 0, -4800],
                velocityKmPerSec: [0, 0, 3.4]
              },
              finalState: {
                epoch: "2026-01-04T00:00:00.000Z",
                referenceFrame: "mars-centered-inertial",
                referenceBodyId: "mars",
                positionKm: [4200, 0, 0],
                velocityKmPerSec: [0, 0, 2.8]
              },
              events: [
                {
                  id: "mars-soi-entry",
                  type: "sphereOfInfluenceEntry",
                  epoch: "2026-01-03T23:00:00.000Z",
                  title: "Mars SOI Entry",
                  description: "Enter the encounter corridor around Mars.",
                  relatedBody: "mars"
                },
                {
                  id: "mars-hyperbolic-periapsis",
                  type: "hyperbolicPeriapsis",
                  epoch: "2026-01-04T00:00:00.000Z",
                  title: "Mars Hyperbolic Periapsis",
                  description: "Reach capture periapsis at Mars.",
                  relatedBody: "mars"
                }
              ],
              metadata: {
                bodyId: "mars",
                encounterType: "capture",
                sphereOfInfluenceRadiusKm: 577000,
                incomingVInfinityKmPerS: 3.4,
                periapsisRadiusKm: 4200
              }
            },
            {
              segmentType: "orbitInsertionBurn",
              startEpoch: "2026-01-04T00:00:00.000Z",
              endEpoch: "2026-01-04T00:15:00.000Z",
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [4200, 0, 0],
                  velocityKmPerSec: [0, 0, 2.8]
                },
                {
                  epochSeconds: 900,
                  positionKm: [4200, 0, 0],
                  velocityKmPerSec: [0, 3.2, 0]
                }
              ],
              initialState: {
                epoch: "2026-01-04T00:00:00.000Z",
                referenceFrame: "mars-centered-inertial",
                referenceBodyId: "mars",
                positionKm: [4200, 0, 0],
                velocityKmPerSec: [0, 0, 2.8]
              },
              finalState: {
                epoch: "2026-01-04T00:15:00.000Z",
                referenceFrame: "mars-centered-inertial",
                referenceBodyId: "mars",
                positionKm: [4200, 0, 0],
                velocityKmPerSec: [0, 3.2, 0]
              },
              events: [
                {
                  id: "mars-orbit-insertion-burn-start",
                  type: "orbitInsertionBurnStart",
                  epoch: "2026-01-04T00:00:00.000Z",
                  title: "Orbit Insertion Burn Start",
                  description: "Begin primary capture burn at Mars.",
                  relatedBody: "mars"
                },
                {
                  id: "mars-orbit-insertion-burn-end",
                  type: "orbitInsertionBurnEnd",
                  epoch: "2026-01-04T00:15:00.000Z",
                  title: "Orbit Insertion Burn End",
                  description: "Complete primary capture burn at Mars.",
                  relatedBody: "mars"
                }
              ],
              metadata: {
                bodyId: "mars",
                encounterType: "capture",
                insertionDeltaVKmPerS: 0.6,
                periapsisRadiusKm: 4200
              }
            },
            {
              segmentType: "parkingOrbit",
              startEpoch: "2026-01-04T00:15:00.000Z",
              endEpoch: "2026-01-04T06:00:00.000Z",
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [4200, 0, 0],
                  velocityKmPerSec: [0, 3.4, 0]
                },
                {
                  epochSeconds: 1800,
                  positionKm: [2100, 0, 3600],
                  velocityKmPerSec: [-2.4, 0.6, 1.1]
                },
                {
                  epochSeconds: 3600,
                  positionKm: [-1800, 0, 3900],
                  velocityKmPerSec: [-2.6, -0.4, 0.5]
                },
                {
                  epochSeconds: 5400,
                  positionKm: [-1200, 0, 4700],
                  velocityKmPerSec: [-2.8, -0.2, 0.3]
                }
              ],
              initialState: {
                epoch: "2026-01-04T00:15:00.000Z",
                referenceFrame: "mars-centered-inertial",
                referenceBodyId: "mars",
                positionKm: [4200, 0, 0],
                velocityKmPerSec: [0, 3.4, 0]
              },
              finalState: {
                epoch: "2026-01-04T06:00:00.000Z",
                referenceFrame: "mars-centered-inertial",
                referenceBodyId: "mars",
                positionKm: [0, 0, 4200],
                velocityKmPerSec: [-3.4, 0, 0]
              },
              events: [
                {
                  id: "mars-capture-established",
                  type: "captureEstablished",
                  epoch: "2026-01-04T00:30:00.000Z",
                  title: "Capture Established",
                  description: "The spacecraft is now bound to Mars.",
                  relatedBody: "mars"
                }
              ],
              orbitSummary: {
                isBound: true,
                periapsisKm: 4200,
                apoapsisKm: 7200,
                inclinationDeg: 25
              },
              metadata: {
                bodyId: "mars"
              }
            }
          ],
          missionTimeline: {
            missionStartEpoch: "2026-01-01T00:00:00.000Z",
            missionEndEpoch: "2026-01-04T00:00:00.000Z",
            currentObjective: "Arrive at Mars",
            events: [
              {
                id: "event-001",
                type: "launch",
                epoch: "2026-01-01T00:00:00.000Z",
                title: "Launch",
                description: "Depart Earth."
              },
              {
                id: "event-002",
                type: "targetApproach",
                epoch: "2026-01-02T12:00:00.000Z",
                title: "Mars Approach",
                description: "Begin final approach."
              }
            ],
            phases: [
              {
                id: "phase-001",
                type: "launch",
                startEpoch: "2026-01-01T00:00:00.000Z",
                endEpoch: "2026-01-01T06:00:00.000Z",
                title: "Launch",
                description: "Initial departure.",
                eventIds: ["event-001"]
              },
              {
                id: "phase-002",
                type: "deepSpaceCruise",
                startEpoch: "2026-01-01T06:00:00.000Z",
                endEpoch: "2026-01-04T00:00:00.000Z",
                title: "Deep-Space Cruise",
                description: "Cruise between mission events.",
                eventIds: []
              }
            ]
          },
          ephemerisSource: "jpl-horizons-file+fallback:bundled-keplerian",
          flightTimeSeconds: 259200,
          warnings: []
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T00:00:00.000Z",
          ephemerisSource: "jpl-horizons-file+fallback:bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "keplerian-elements"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [-24856124, 144936962, 0],
              velocityKmPerSec: [-29.837, -5.127, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "jpl-horizons-file"
            },
            {
              bodyId: "mars",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [-159185432, 188245763, 7650983],
              velocityKmPerSec: [-17.235, -13.254, 0.156],
              muKm3PerS2: 42828.375816,
              sourceName: "jpl-horizons-file"
            }
          ]
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T06:00:00.000Z",
          ephemerisSource: "jpl-horizons-file+fallback:bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T06:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "keplerian-elements"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T06:00:00.000Z",
              positionKm: [-25500000, 144500000, 0],
              velocityKmPerSec: [-29.8, -5.2, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "jpl-horizons-file"
            },
            {
              bodyId: "mars",
              epoch: "2026-01-01T06:00:00.000Z",
              positionKm: [-159300000, 188100000, 7650000],
              velocityKmPerSec: [-17.2, -13.2, 0.15],
              muKm3PerS2: 42828.375816,
              sourceName: "jpl-horizons-file"
            }
          ]
        }),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("最近接近")).toBeInTheDocument();
  expect(await screen.findByLabelText("Three.js 飞行画布")).toBeInTheDocument();
  expect(await screen.findByLabelText("缩放")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "开始" })).toBeInTheDocument();
  expect(await screen.findByTestId("trajectory-inset-map")).toBeInTheDocument();
  expect(await screen.findByTestId("arrival-capture-orbit")).toHaveAttribute("data-source", "segment-samples");
  expect(await screen.findByTestId("arrival-capture-orbit")).toHaveAttribute("data-probe-mode", "transfer");
  expect(await screen.findByText("当前目标: Arrive at Mars")).toBeInTheDocument();
  expect(await screen.findByText("下一事件: Mars Approach · 1.5 天后")).toBeInTheDocument();
  expect(await screen.findByTestId("playback-phase-jump-bar")).toBeInTheDocument();
  expect(await screen.findByTestId("playback-phase-jump-phase-001")).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByTestId("playback-phase-jump-phase-002")).toHaveAttribute("aria-pressed", "false");
  expect(await screen.findByText(hasExactTextContent("序列: 地球 -> 火星"))).toBeInTheDocument();
  expect((await screen.findAllByText("停泊轨道")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("地球逃逸")).length).toBeGreaterThan(0);
  expect(
    (await screen.findAllByText("jpl-horizons-file+fallback:bundled-keplerian")).length,
  ).toBeGreaterThan(0);
  expect(await screen.findByText("3 天")).toBeInTheDocument();
  expect(await screen.findByText("当前时刻: 2026-01-01T00:00:00.000Z")).toBeInTheDocument();
  const earthLabel = await screen.findByText("天体: 地球");
  expect(await screen.findByText("天体: 火星")).toBeInTheDocument();
  await userEvent.hover(earthLabel);
  expect(earthLabel.closest(".scene-body-chip")).toHaveAttribute("data-active", "true");

  await userEvent.click(await screen.findByTestId("playback-phase-jump-phase-002"));

  expect(await screen.findByText("当前时刻: 2026-01-01T06:00:00.000Z")).toBeInTheDocument();
  expect(await screen.findByTestId("arrival-capture-orbit")).toHaveAttribute("data-probe-mode", "capture-orbit");
  expect(await screen.findByTestId("playback-phase-jump-phase-001")).toHaveAttribute("aria-pressed", "false");
  expect(await screen.findByTestId("playback-phase-jump-phase-002")).toHaveAttribute("aria-pressed", "true");
  expect(fetchSpy).toHaveBeenLastCalledWith("/ephemeris/bodies?epoch=2026-01-01T06%3A00%3A00.000Z");
});

it("includes returnToDeparture in launch-window and plan-tour requests", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
        referenceFrame: "heliocentric-inertial",
        ephemerisSource: "bundled-keplerian",
        samples: [
          {
            epochSeconds: 0,
            positionKm: [149597870.7, 0, 0],
            velocityKmPerSec: [0, 29.78, 0],
          },
        ],
        closestApproach: {
          bodyId: "earth",
          distanceKm: 1200,
          epochSeconds: 0,
        },
        flightTimeSeconds: 86_400,
        warnings: [],
        visitOrder: ["mars"],
        fullSequenceBodies: ["earth", "mars", "earth"],
        score: 4.2,
        deltaVKmPerS: 3.1,
        flybyEvents: [],
        visitEvents: [],
        legs: [],
        segments: [],
        candidates: [],
      }),
    )
    .mockResolvedValueOnce(createEphemerisResponse({ epoch: "2026-01-01T00:00:00.000Z" }));

  render(<App />);

  await userEvent.click(screen.getByRole("checkbox", { name: "返回地球" }));
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(4));

  expect(fetchSpy.mock.calls[1]?.[0]).toBe("/missions/launch-window");
  expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual(
    expect.objectContaining({
      missionType: "tour",
      departureBody: "earth",
      requiredVisitBodies: ["mars"],
      returnToDeparture: true,
    }),
  );

  expect(fetchSpy.mock.calls[2]?.[0]).toBe("/missions/plan-tour");
  expect(JSON.parse(String(fetchSpy.mock.calls[2]?.[1]?.body))).toEqual(
    expect.objectContaining({
      departureBody: "earth",
      requiredVisitBodies: ["mars"],
      returnToDeparture: true,
    }),
  );

  expect(await screen.findByText(hasExactTextContent("序列: 地球 -> 火星 -> 地球"))).toBeInTheDocument();
});

it("keeps the clicked phase jump highlighted when a short phase has no dedicated sample", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
        referenceFrame: "heliocentric-inertial",
        samples: [
          {
            epochSeconds: 0,
            positionKm: [149597870.7, 0, 0],
            velocityKmPerSec: [0, 29.78, 0],
          },
          {
            epochSeconds: 7200,
            positionKm: [149500000, 643248, 0],
            velocityKmPerSec: [-0.1, 29.77, 0],
          },
        ],
        closestApproach: {
          bodyId: "mars",
          distanceKm: 8450000,
          epochSeconds: 7200,
        },
        missionTimeline: {
          missionStartEpoch: "2026-01-01T00:00:00.000Z",
          missionEndEpoch: "2026-01-01T03:00:00.000Z",
          currentObjective: "Arrive at Mars",
          events: [],
          phases: [
            {
              id: "phase-001",
              type: "launch",
              startEpoch: "2026-01-01T00:00:00.000Z",
              endEpoch: "2026-01-01T00:50:00.000Z",
              title: "Launch",
              description: "Initial departure.",
              eventIds: [],
            },
            {
              id: "phase-002",
              type: "maneuverExecution",
              startEpoch: "2026-01-01T00:50:00.000Z",
              endEpoch: "2026-01-01T01:10:00.000Z",
              title: "TCM-1",
              description: "Trim maneuver.",
              eventIds: [],
            },
            {
              id: "phase-003",
              type: "deepSpaceCruise",
              startEpoch: "2026-01-01T01:10:00.000Z",
              endEpoch: "2026-01-01T03:00:00.000Z",
              title: "Deep-Space Cruise",
              description: "Cruise onward.",
              eventIds: [],
            },
          ],
        },
        ephemerisSource: "bundled-keplerian",
        flightTimeSeconds: 10_800,
        warnings: [],
      }),
    )
    .mockResolvedValueOnce(createEphemerisResponse({ epoch: "2026-01-01T00:00:00.000Z" }));

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  await userEvent.click(await screen.findByTestId("playback-phase-jump-phase-002"));

  expect(await screen.findByTestId("playback-phase-jump-phase-002")).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByTestId("playback-phase-jump-phase-001")).toHaveAttribute("aria-pressed", "false");
  expect(await screen.findByText("任务分段: 轨道机动")).toBeInTheDocument();
});

it("keeps the clicked phase jump highlighted for candidate-backed results", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
        referenceFrame: "heliocentric-inertial",
        ephemerisSource: "bundled-keplerian",
        samples: [
          {
            epochSeconds: 0,
            positionKm: [149597870.7, 0, 0],
            velocityKmPerSec: [0, 29.78, 0],
          },
        ],
        closestApproach: {
          bodyId: "mars",
          distanceKm: 8450000,
          epochSeconds: 0,
        },
        flightTimeSeconds: 10_800,
        warnings: [],
        candidates: [
          {
            sequenceBodies: ["earth", "mars"],
            score: 1.2,
            deltaVKmPerS: 3.4,
            flightTimeSeconds: 10_800,
            warnings: [],
            flybyEvents: [],
            samples: [
              {
                epochSeconds: 0,
                positionKm: [149597870.7, 0, 0],
                velocityKmPerSec: [0, 29.78, 0],
              },
              {
                epochSeconds: 7200,
                positionKm: [149500000, 643248, 0],
                velocityKmPerSec: [-0.1, 29.77, 0],
              },
            ],
            closestApproach: {
              bodyId: "mars",
              distanceKm: 8450000,
              epochSeconds: 7200,
            },
            missionTimeline: {
              missionStartEpoch: "2026-01-01T00:00:00.000Z",
              missionEndEpoch: "2026-01-01T03:00:00.000Z",
              currentObjective: "Arrive at Mars",
              events: [],
              phases: [
                {
                  id: "phase-001",
                  type: "launch",
                  startEpoch: "2026-01-01T00:00:00.000Z",
                  endEpoch: "2026-01-01T00:50:00.000Z",
                  title: "Launch",
                  description: "Initial departure.",
                  eventIds: [],
                },
                {
                  id: "phase-002",
                  type: "maneuverExecution",
                  startEpoch: "2026-01-01T00:50:00.000Z",
                  endEpoch: "2026-01-01T01:10:00.000Z",
                  title: "TCM-1",
                  description: "Trim maneuver.",
                  eventIds: [],
                },
                {
                  id: "phase-003",
                  type: "deepSpaceCruise",
                  startEpoch: "2026-01-01T01:10:00.000Z",
                  endEpoch: "2026-01-01T03:00:00.000Z",
                  title: "Deep-Space Cruise",
                  description: "Cruise onward.",
                  eventIds: [],
                },
              ],
            },
          },
        ],
      }),
    )
    .mockResolvedValueOnce(createEphemerisResponse({ epoch: "2026-01-01T00:00:00.000Z" }));

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  await userEvent.click(await screen.findByTestId("playback-phase-jump-phase-002"));

  expect(await screen.findByTestId("playback-phase-jump-phase-002")).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByTestId("playback-phase-jump-phase-001")).toHaveAttribute("aria-pressed", "false");
  expect(await screen.findByText("任务分段: 轨道机动")).toBeInTheDocument();
});

it("renders gravity-assist candidates and switches the active plan", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          ephemerisSource: "bundled-keplerian",
          samples: [
            {
              epochSeconds: 0,
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0]
            }
          ],
          closestApproach: {
            bodyId: "saturn",
            distanceKm: 1200,
            epochSeconds: 0
          },
          flightTimeSeconds: 200 * 86400,
          warnings: ["Gravity-assist search returned 2 ranked candidates"],
          sequenceBodies: ["earth", "jupiter", "saturn"],
          score: 4.2,
          deltaVKmPerS: 18.4,
          flybyEvents: [
            {
              bodyId: "jupiter",
              epoch: "2026-07-01T00:00:00.000Z",
              positionKm: [778500000, 0, 0],
              periapsisAltitudeKm: 75000,
              turnAngleDeg: 28,
              inboundVInfinityKmPerS: 6.1,
              outboundVInfinityKmPerS: 6.1
            }
          ],
          segments: [
            {
              segmentType: "flybyEncounter",
              startEpoch: "2026-07-01T00:00:00.000Z",
              endEpoch: "2026-07-02T00:00:00.000Z",
              samples: [],
              initialState: {
                epoch: "2026-07-01T00:00:00.000Z",
                referenceFrame: "heliocentric-inertial",
                referenceBodyId: "jupiter",
                positionKm: [778500000, 0, 0],
                velocityKmPerSec: [0, 6.1, 0]
              },
              finalState: {
                epoch: "2026-07-02T00:00:00.000Z",
                referenceFrame: "heliocentric-inertial",
                referenceBodyId: "jupiter",
                positionKm: [778500000, 0, 0],
                velocityKmPerSec: [0, 6.1, 0]
              },
              events: [
                {
                  id: "jupiter-soi-entry",
                  type: "sphereOfInfluenceEntry",
                  epoch: "2026-07-01T00:00:00.000Z",
                  title: "Jupiter SOI Entry",
                  description: "Enter the primary encounter corridor around Jupiter.",
                  relatedBody: "jupiter"
                },
                {
                  id: "jupiter-flyby-periapsis",
                  type: "hyperbolicPeriapsis",
                  epoch: "2026-07-01T12:00:00.000Z",
                  title: "Jupiter Flyby Periapsis",
                  description: "Pass periapsis during the Jupiter gravity assist.",
                  relatedBody: "jupiter"
                },
                {
                  id: "jupiter-soi-exit",
                  type: "sphereOfInfluenceExit",
                  epoch: "2026-07-02T00:00:00.000Z",
                  title: "Jupiter SOI Exit",
                  description: "Exit the primary encounter corridor after the Jupiter assist.",
                  relatedBody: "jupiter"
                }
              ],
              metadata: {
                bodyId: "jupiter",
                periapsisAltitudeKm: 75000,
                turnAngleDeg: 28,
                encounterType: "flyby",
                sphereOfInfluenceRadiusKm: 48200000,
                periapsisRadiusKm: 146492,
                incomingVInfinityKmPerS: 6.1,
                outgoingVInfinityKmPerS: 6.1,
                inboundVInfinityKmPerS: 6.1,
                outboundVInfinityKmPerS: 6.1
              }
            }
          ],
          candidates: [
            {
              sequenceBodies: ["earth", "jupiter", "saturn"],
              score: 4.2,
              deltaVKmPerS: 18.4,
              flightTimeSeconds: 200 * 86400,
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [149597870.7, 0, 0],
                  velocityKmPerSec: [0, 29.78, 0]
                }
              ],
              closestApproach: {
                bodyId: "saturn",
                distanceKm: 1200,
                epochSeconds: 0
              },
              warnings: [],
              flybyEvents: [],
              segments: []
            },
            {
              sequenceBodies: ["earth", "venus", "jupiter", "saturn"],
              score: 4.8,
              deltaVKmPerS: 17.9,
              flightTimeSeconds: 240 * 86400,
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [149597870.7, 0, 0],
                  velocityKmPerSec: [0, 29.78, 0]
                }
              ],
              closestApproach: {
                bodyId: "saturn",
                distanceKm: 3200,
                epochSeconds: 0
              },
              warnings: [],
              flybyEvents: [
                {
                  bodyId: "jupiter",
                  epoch: "2026-07-01T00:00:00.000Z",
                  positionKm: [778500000, 0, 0],
                  periapsisAltitudeKm: 75000,
                  turnAngleDeg: 28,
                  inboundVInfinityKmPerS: 6.1,
                  outboundVInfinityKmPerS: 6.1
                }
              ],
              segments: [
                {
                  segmentType: "flybyEncounter",
                  startEpoch: "2026-07-01T00:00:00.000Z",
                  endEpoch: "2026-07-02T00:00:00.000Z",
                  samples: [],
                  initialState: {
                    epoch: "2026-07-01T00:00:00.000Z",
                    referenceFrame: "heliocentric-inertial",
                    referenceBodyId: "jupiter",
                    positionKm: [778500000, 0, 0],
                    velocityKmPerSec: [0, 6.1, 0]
                  },
                  finalState: {
                    epoch: "2026-07-02T00:00:00.000Z",
                    referenceFrame: "heliocentric-inertial",
                    referenceBodyId: "jupiter",
                    positionKm: [778500000, 0, 0],
                    velocityKmPerSec: [0, 6.1, 0]
                  },
                  events: [
                    {
                      id: "jupiter-soi-entry-alt",
                      type: "sphereOfInfluenceEntry",
                      epoch: "2026-07-01T00:00:00.000Z",
                      title: "Jupiter SOI Entry",
                      description: "Enter the primary encounter corridor around Jupiter.",
                      relatedBody: "jupiter"
                    },
                    {
                      id: "jupiter-flyby-periapsis-alt",
                      type: "hyperbolicPeriapsis",
                      epoch: "2026-07-01T12:00:00.000Z",
                      title: "Jupiter Flyby Periapsis",
                      description: "Pass periapsis during the Jupiter gravity assist.",
                      relatedBody: "jupiter"
                    },
                    {
                      id: "jupiter-soi-exit-alt",
                      type: "sphereOfInfluenceExit",
                      epoch: "2026-07-02T00:00:00.000Z",
                      title: "Jupiter SOI Exit",
                      description: "Exit the primary encounter corridor after the Jupiter assist.",
                      relatedBody: "jupiter"
                    }
                  ],
                  metadata: {
                    bodyId: "jupiter",
                    periapsisAltitudeKm: 75000,
                    turnAngleDeg: 28,
                    encounterType: "flyby",
                    sphereOfInfluenceRadiusKm: 48200000,
                    periapsisRadiusKm: 146492,
                    incomingVInfinityKmPerS: 6.1,
                    outgoingVInfinityKmPerS: 6.1,
                    inboundVInfinityKmPerS: 6.1,
                    outboundVInfinityKmPerS: 6.1
                  }
                }
              ]
            }
          ]
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T00:00:00.000Z",
          ephemerisSource: "bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "saturn",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [1400000000, 0, 0],
              velocityKmPerSec: [0, 9.6, 0],
              muKm3PerS2: 37931187,
              sourceName: "keplerian-elements"
            }
          ]
        }),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("引力辅助候选方案")).toBeInTheDocument();
  expect(await screen.findByText(hasExactTextContent("序列: 地球 -> 木星 -> 土星"))).toBeInTheDocument();
  expect(await screen.findByText("地球 -> 木星 -> 土星")).toBeInTheDocument();
  expect(await screen.findByText("地球 -> 金星 -> 木星 -> 土星")).toBeInTheDocument();
  expect(await screen.findByText("200 天")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /地球 -> 金星 -> 木星 -> 土星/ }));

  expect(await screen.findByText(hasExactTextContent("序列: 地球 -> 金星 -> 木星 -> 土星"))).toBeInTheDocument();
  expect(await screen.findByText("240 天")).toBeInTheDocument();
  expect(await screen.findByTestId("trajectory-inset-map")).toHaveTextContent("木星");
});

it("plans a multi-planet tour from the unified selector and renders ranked tour candidates", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(
      createLaunchWindowResponse({
        candidateLaunches: [
          {
            launchEpoch: "2026-01-01T00:00:00Z",
            score: 88.4,
            deltaVKmPerS: 31.7,
            flightTimeSeconds: 900 * 86400,
            visitOrder: ["venus", "jupiter", "saturn"],
            fullSequenceBodies: ["earth", "venus", "earth", "jupiter", "saturn"],
          },
        ],
        searchSummary: {
          searchStartEpoch: "2026-01-01T00:00:00Z",
          searchEndEpoch: "2031-01-01T00:00:00Z",
          coarseSampleCount: 4,
          refinedCandidateCount: 1,
          scoringMode: "tour-delta-v-first",
        },
      }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          ephemerisSource: "bundled-keplerian",
          samples: [
            {
              epochSeconds: 0,
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0]
            }
          ],
          closestApproach: {
            bodyId: "saturn",
            distanceKm: 42,
            epochSeconds: 100
          },
          flightTimeSeconds: 900 * 86400,
          warnings: ["Patched-conic gravity-assist candidate"],
          visitOrder: ["venus", "jupiter", "saturn"],
          fullSequenceBodies: ["earth", "venus", "earth", "jupiter", "saturn"],
          score: 88.4,
          deltaVKmPerS: 31.7,
          flybyEvents: [],
          visitEvents: [
            {
              bodyId: "venus",
              epoch: "2026-05-01T00:00:00.000Z",
              positionKm: [108000000, 0, 0]
            }
          ],
          legs: [
            {
              startBody: "earth",
              endBody: "venus",
              assistBodies: [],
              durationSeconds: 120 * 86400,
              deltaVKmPerS: 8.2,
              closestApproachKm: 15
            }
          ],
          candidates: [
            {
              visitOrder: ["venus", "jupiter", "saturn"],
              fullSequenceBodies: ["earth", "venus", "earth", "jupiter", "saturn"],
              score: 88.4,
              deltaVKmPerS: 31.7,
              flightTimeSeconds: 900 * 86400,
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [149597870.7, 0, 0],
                  velocityKmPerSec: [0, 29.78, 0]
                }
              ],
              closestApproach: {
                bodyId: "saturn",
                distanceKm: 42,
                epochSeconds: 100
              },
              warnings: [],
              flybyEvents: [],
              visitEvents: [],
              legs: []
            },
            {
              visitOrder: ["jupiter", "venus", "saturn"],
              fullSequenceBodies: ["earth", "jupiter", "venus", "saturn"],
              score: 95.1,
              deltaVKmPerS: 36.2,
              flightTimeSeconds: 1040 * 86400,
              samples: [
                {
                  epochSeconds: 0,
                  positionKm: [149597870.7, 0, 0],
                  velocityKmPerSec: [0, 29.78, 0]
                }
              ],
              closestApproach: {
                bodyId: "saturn",
                distanceKm: 75,
                epochSeconds: 100
              },
              warnings: [],
              flybyEvents: [],
              visitEvents: [],
              legs: []
            }
          ]
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T00:00:00.000Z",
          ephemerisSource: "bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "saturn",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [1400000000, 0, 0],
              velocityKmPerSec: [0, 9.6, 0],
              muKm3PerS2: 37931187,
              sourceName: "keplerian-elements"
            }
          ]
        }),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("checkbox", { name: "火星" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "金星" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "木星" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "土星" }));
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(fetchSpy.mock.calls[1]?.[0]).toBe("/missions/launch-window");
  expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({
    missionType: "tour",
    departureBody: "earth",
    requiredVisitBodies: ["venus", "jupiter", "saturn"],
    earliestLaunchEpoch: "2026-01-01T00:00:00Z",
    maxAssistBodiesPerLeg: 2,
    maxReturnedCandidates: 5,
    allowAssistBodies: true,
    allowRepeatedFlybys: true,
    returnToDeparture: false,
  });

  expect(fetchSpy.mock.calls[2]?.[0]).toBe("/missions/plan-tour");
  expect(JSON.parse(String(fetchSpy.mock.calls[2]?.[1]?.body))).toEqual({
    departureBody: "earth",
    requiredVisitBodies: ["venus", "jupiter", "saturn"],
    launchEpoch: "2026-01-01T00:00:00Z",
    returnToDeparture: false,
    maxAssistBodiesPerLeg: 2,
    maxReturnedCandidates: 5,
    allowAssistBodies: true,
    allowRepeatedFlybys: true,
  });

  expect(await screen.findByText("引力辅助候选方案")).toBeInTheDocument();
  expect(await screen.findByText(hasExactTextContent("序列: 地球 -> 金星 -> 木星 -> 土星"))).toBeInTheDocument();
  expect((await screen.findAllByText(hasExactTextContent("完整序列: 地球 -> 金星 -> 地球 -> 木星 -> 土星"))).length).toBeGreaterThan(0);
  expect(await screen.findByText(/拜访顺序: 金星 -> 木星 -> 土星/)).toBeInTheDocument();
  expect(await screen.findByText("2 年 5 月 20 天")).toBeInTheDocument();
  expect(await screen.findByText("当前方案")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /地球 -> 木星 -> 金星 -> 土星/ }));

  expect(await screen.findByText("2 年 10 月 10 天")).toBeInTheDocument();
});

it("shows speed telemetry in the scene and switches components", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          samples: [
            {
              epochSeconds: 0,
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0]
            },
            {
              epochSeconds: 21600,
              positionKm: [149500000, 643248, 0],
              velocityKmPerSec: [-0.1, 29.88, 0.2]
            }
          ],
          closestApproach: {
            bodyId: "mars",
            distanceKm: 8450000,
            epochSeconds: 21600
          },
          ephemerisSource: "bundled-keplerian",
          flightTimeSeconds: 259200,
          warnings: []
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T00:00:00.000Z",
          ephemerisSource: "bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [-24856124, 144936962, 0],
              velocityKmPerSec: [-29.837, -5.127, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "mars",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [-159185432, 188245763, 7650983],
              velocityKmPerSec: [-17.235, -13.254, 0.156],
              muKm3PerS2: 42828.375816,
              sourceName: "bundled-ephemeris"
            }
          ]
        }),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("当前速度: 29.78 km/s")).toBeInTheDocument();
  expect(screen.queryByText("速度遥测")).not.toBeInTheDocument();
  expect(screen.queryByText("当前速度分量")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "vx" })).not.toBeInTheDocument();
});

it("renders maneuver markers and highlights active burn windows during playback", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(createEphemerisResponse())
    .mockResolvedValueOnce(createLaunchWindowResponse())
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          samples: [
            {
              epochSeconds: 0,
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0],
              massKg: 1800,
            },
            {
              epochSeconds: 3600,
              positionKm: [149597000, 107208, 0],
              velocityKmPerSec: [0.02, 29.79, 0],
              massKg: 1799.4,
            }
          ],
          closestApproach: {
            bodyId: "mars",
            distanceKm: 8450000,
            epochSeconds: 3600
          },
          ephemerisSource: "bundled-keplerian",
          flightTimeSeconds: 259200,
          warnings: [],
          maneuverEvents: [
            {
              type: "TCM",
              startEpoch: "2026-01-01T01:00:00.000Z",
              durationSeconds: 7200,
              thrustDirection: "prograde",
              deltaVEstimateKmPerS: 0.002,
              propellantUsedKg: 0.6,
              massBeforeKg: 1800,
              massAfterKg: 1799.4
            }
          ],
          finalMassKg: 1799.4,
          totalPropellantUsedKg: 0.6
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T00:00:00.000Z",
          ephemerisSource: "bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [-24856124, 144936962, 0],
              velocityKmPerSec: [-29.837, -5.127, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "mars",
              epoch: "2026-01-01T00:00:00.000Z",
              positionKm: [-159185432, 188245763, 7650983],
              velocityKmPerSec: [-17.235, -13.254, 0.156],
              muKm3PerS2: 42828.375816,
              sourceName: "bundled-ephemeris"
            }
          ]
        }),
    )
    .mockResolvedValueOnce(
      createJsonResponse({
          referenceFrame: "heliocentric-inertial",
          epoch: "2026-01-01T01:00:00.000Z",
          ephemerisSource: "bundled-keplerian",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T01:00:00.000Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T01:00:00.000Z",
              positionKm: [-24850000, 144930000, 0],
              velocityKmPerSec: [-29.837, -5.127, 0],
              muKm3PerS2: 398600.435436,
              sourceName: "bundled-ephemeris"
            },
            {
              bodyId: "mars",
              epoch: "2026-01-01T01:00:00.000Z",
              positionKm: [-159180000, 188240000, 7651000],
              velocityKmPerSec: [-17.235, -13.254, 0.156],
              muKm3PerS2: 42828.375816,
              sourceName: "bundled-ephemeris"
            }
          ]
        }),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("下一次机动")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("回放步进"), { target: { value: "1" } });

  expect(await screen.findByText("当前机动")).toBeInTheDocument();
  expect(await screen.findByText("TCM")).toBeInTheDocument();
});
