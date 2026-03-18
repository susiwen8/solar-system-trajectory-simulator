import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
});

it("renders the simulator heading", () => {
  render(<App />);
  expect(screen.getByText("Solar System Trajectory Simulator")).toBeInTheDocument();
});

it("shows the mission metrics panel after propagation results load", async () => {
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
              velocityKmPerSec: [-0.1, 29.77, 0]
            }
          ],
          closestApproach: {
            bodyId: "mars",
            distanceKm: 8450000,
            epochSeconds: 21600
          },
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
          epoch: "2026-01-01T00:00:00Z",
          bodies: [
            {
              bodyId: "sun",
              epoch: "2026-01-01T00:00:00Z",
              positionKm: [0, 0, 0],
              velocityKmPerSec: [0, 0, 0],
              muKm3PerS2: 132712440018
            },
            {
              bodyId: "earth",
              epoch: "2026-01-01T00:00:00Z",
              positionKm: [-24856124, 144936962, 0],
              velocityKmPerSec: [-29.837, -5.127, 0],
              muKm3PerS2: 398600.435436
            },
            {
              bodyId: "mars",
              epoch: "2026-01-01T00:00:00Z",
              positionKm: [-159185432, 188245763, 7650983],
              velocityKmPerSec: [-17.235, -13.254, 0.156],
              muKm3PerS2: 42828.375816
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
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(await screen.findByText("Closest Approach")).toBeInTheDocument();
  expect(await screen.findByText("Body: earth")).toBeInTheDocument();
  expect(await screen.findByText("Body: mars")).toBeInTheDocument();
});
