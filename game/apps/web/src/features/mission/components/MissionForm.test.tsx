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
      kind: "trajectory",
      request: expect.objectContaining({
        departureBody: "earth",
        targetBody: "mars",
        initialState: { launchFromBody: { mode: "autoTransfer" } },
        launchProfile: {
          mode: "parkingOrbit",
          parkingOrbitAltitudeKm: 300,
          parkingOrbitInclinationDeg: 28.5,
        },
      }),
    }),
  );
});

it("submits propulsion settings when finite-thrust corrections are enabled", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="zh" loading={false} />);

  await userEvent.click(screen.getByLabelText("启用有限推力修正"));
  await userEvent.clear(screen.getByLabelText("初始质量（kg）"));
  await userEvent.type(screen.getByLabelText("初始质量（kg）"), "2000");
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "trajectory",
      request: expect.objectContaining({
        propulsionConfig: expect.objectContaining({
          initialMassKg: 2000,
          propellantMassKg: 420,
          maxThrustN: 0.8,
          ispSeconds: 3200,
        }),
      }),
    }),
  );
});

it("shows a disabled loading button while propagation is running", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading />);

  expect(screen.getByRole("button", { name: "正在计算轨迹..." })).toBeDisabled();
  expect(screen.getByTestId("mission-submit-spinner")).toBeInTheDocument();
});

it("submits a multi-planet tour request", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="zh" loading={false} />);

  await userEvent.selectOptions(screen.getByLabelText("任务类型"), "tour");
  await userEvent.clear(screen.getByLabelText("发射时刻"));
  await userEvent.type(screen.getByLabelText("发射时刻"), "2026-03-01T00:00:00Z");
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "tour",
      request: expect.objectContaining({
        departureBody: "earth",
        requiredVisitBodies: ["venus", "jupiter", "saturn"],
        launchEpoch: "2026-03-01T00:00:00Z",
      }),
    }),
  );
});
