import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

it("renders the simulator heading", () => {
  render(<App />);
  expect(screen.getByText("Solar System Trajectory Simulator")).toBeInTheDocument();
});

it("shows the mission metrics panel after propagation results load", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
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
  );

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(await screen.findByText("Closest Approach")).toBeInTheDocument();
});
