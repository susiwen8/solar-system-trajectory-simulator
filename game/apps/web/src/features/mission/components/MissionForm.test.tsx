import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MissionForm from "./MissionForm";

it("submits a request for an Earth to Mars mission", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="en" loading={false} />);

  expect(screen.getByLabelText("Trajectory Mode")).toHaveValue("autoTransfer");
  await userEvent.selectOptions(screen.getByLabelText("Target Planet"), "mars");
  await userEvent.clear(screen.getByLabelText("Launch Epoch"));
  await userEvent.type(screen.getByLabelText("Launch Epoch"), "2026-10-15T00:00:00Z");
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      departureBody: "earth",
      targetBody: "mars",
      initialState: { launchFromBody: { mode: "autoTransfer" } }
    }),
  );
});

it("shows a disabled loading button while propagation is running", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading />);

  expect(screen.getByRole("button", { name: "正在计算轨迹..." })).toBeDisabled();
  expect(screen.getByTestId("mission-submit-spinner")).toBeInTheDocument();
});
