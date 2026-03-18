import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MissionForm from "./MissionForm";

it("submits a request for an Earth to Mars mission", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} />);

  await userEvent.selectOptions(screen.getByLabelText("Target Planet"), "mars");
  await userEvent.clear(screen.getByLabelText("Launch Epoch"));
  await userEvent.type(screen.getByLabelText("Launch Epoch"), "2026-10-15T00:00:00Z");
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ departureBody: "earth", targetBody: "mars" }),
  );
});
