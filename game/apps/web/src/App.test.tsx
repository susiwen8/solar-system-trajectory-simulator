import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
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

it("shows the mission metrics panel after propagation results load", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
          ephemerisSource: "jpl-horizons-file+fallback:bundled-keplerian",
          flightTimeSeconds: 259200,
          warnings: []
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("最近接近")).toBeInTheDocument();
  expect(await screen.findByLabelText("Three.js 飞行画布")).toBeInTheDocument();
  expect(await screen.findByLabelText("缩放")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "开始" })).toBeInTheDocument();
  expect(
    (await screen.findAllByText("jpl-horizons-file+fallback:bundled-keplerian")).length,
  ).toBeGreaterThan(0);
  expect(await screen.findByText("3 天")).toBeInTheDocument();
  expect(await screen.findByText("当前时刻: 2026-01-01T00:00:00.000Z")).toBeInTheDocument();
  const earthLabel = await screen.findByText("天体: 地球");
  expect(await screen.findByText("天体: 火星")).toBeInTheDocument();
  await userEvent.hover(earthLabel);
  expect(earthLabel.closest(".scene-body-chip")).toHaveAttribute("data-active", "true");

  fireEvent.change(screen.getByLabelText("回放步进"), { target: { value: "1" } });

  expect(await screen.findByText("当前时刻: 2026-01-01T06:00:00.000Z")).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenLastCalledWith("/ephemeris/bodies?epoch=2026-01-01T06%3A00%3A00.000Z");
});

it("renders gravity-assist candidates and switches the active plan", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
              flybyEvents: []
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
              flybyEvents: []
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("引力辅助候选方案")).toBeInTheDocument();
  expect(await screen.findByText("地球 -> 木星 -> 土星")).toBeInTheDocument();
  expect(await screen.findByText("地球 -> 金星 -> 木星 -> 土星")).toBeInTheDocument();
  expect(await screen.findByText("200 天")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /地球 -> 金星 -> 木星 -> 土星/ }));

  expect(await screen.findByText("240 天")).toBeInTheDocument();
});

it("plans a multi-planet tour and renders ranked tour candidates", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    );

  render(<App />);
  await userEvent.selectOptions(screen.getByLabelText("任务类型"), "tour");
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("引力辅助候选方案")).toBeInTheDocument();
  expect(await screen.findByText("地球 -> 金星 -> 地球 -> 木星 -> 土星")).toBeInTheDocument();
  expect(await screen.findByText(/拜访顺序: 金星 -> 木星 -> 土星/)).toBeInTheDocument();
  expect(await screen.findByText("900 天")).toBeInTheDocument();
  expect(await screen.findByText("拜访事件")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /地球 -> 木星 -> 金星 -> 土星/ }));

  expect(await screen.findByText("1,040 天")).toBeInTheDocument();
});

it("shows speed telemetry in the scene and switches components", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        },
      ),
    );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(await screen.findByText("速度遥测")).toBeInTheDocument();
  expect(await screen.findByText("当前速度")).toBeInTheDocument();
  expect(await screen.findByText("29.78 km/s")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "vx" }));

  expect(await screen.findByText("当前速度分量")).toBeInTheDocument();
  expect(await screen.findByText("0.00 km/s")).toBeInTheDocument();
});
