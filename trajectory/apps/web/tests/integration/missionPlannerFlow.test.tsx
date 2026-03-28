import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { App } from "../../src/app/App";


vi.mock("../../src/api/client", () => ({
  apiClient: {
    getBodies: vi.fn().mockResolvedValue({
      bodies: [
        { id: "earth", name: "Earth" },
        { id: "mars", name: "Mars" },
        { id: "jupiter", name: "Jupiter" }
      ]
    }),
    solveMission: vi.fn().mockResolvedValue({
      candidates: [
        {
          id: "candidate-a",
          summary: {
            label: "recommended",
            totalDurationDays: 240,
            totalDeltaV: 5.8
          },
          legs: [],
          samples: { spacecraft: [] }
        }
      ],
      warnings: [],
      fidelity: {
        ephemeris: "high",
        transfer: "engineering approximation",
        flyby: "patched-conic approximation"
      }
    })
  }
}));


test("submits a mission and auto-selects the recommended candidate", async () => {
  render(<App />);

  await screen.findByLabelText(/first target/i);
  fireEvent.change(screen.getByLabelText(/first target/i), {
    target: { value: "mars" }
  });
  fireEvent.change(screen.getByLabelText(/second target/i), {
    target: { value: "jupiter" }
  });
  fireEvent.click(screen.getByRole("button", { name: /solve trajectory/i }));

  await waitFor(() => {
    expect(screen.getByText(/recommended/i)).toBeInTheDocument();
  });

  expect(screen.getByText(/240 days/i)).toBeInTheDocument();
});
