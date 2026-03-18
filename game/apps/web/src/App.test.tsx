import { render, screen } from "@testing-library/react";

import App from "./App";

it("renders the simulator heading", () => {
  render(<App />);
  expect(screen.getByText("Solar System Trajectory Simulator")).toBeInTheDocument();
});
