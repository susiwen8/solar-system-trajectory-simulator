import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { App } from "../../../src/app/App";


test("renders the planner shell", () => {
  render(<App />);

  expect(screen.getByText(/mission planner/i)).toBeInTheDocument();
  expect(screen.getByText(/trajectory candidates/i)).toBeInTheDocument();
  expect(screen.getByTestId("scene-shell")).toBeInTheDocument();
});
