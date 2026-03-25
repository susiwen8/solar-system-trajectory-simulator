import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MissionForm from "./MissionForm";

it("renders a unified visit selector instead of a mission-type dropdown", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.queryByLabelText("任务类型")).not.toBeInTheDocument();
  expect(screen.getByText("拜访星球")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "火星" })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "地球" })).not.toBeInTheDocument();
  expect(screen.getByText("系统将自动优化访问顺序")).toBeInTheDocument();
  expect(screen.queryByText("单目标任务")).not.toBeInTheDocument();
  expect(screen.queryByText("多星球巡游")).not.toBeInTheDocument();
});

it("starts with mars selected by default", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByRole("checkbox", { name: "火星" })).toBeChecked();
});

it("defaults to recommended launch window mode", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByLabelText("发射方案")).toHaveValue("recommendedWindow");
});

it("renders the earliest launch input as a date picker", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByLabelText("最早发射时刻")).toHaveAttribute("type", "date");
  expect(screen.getByLabelText("最早发射时刻")).toHaveValue("2026-01-01");
});

it("submits a trajectory request in manual mode when exactly one body is selected", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="en" loading={false} />);

  expect(screen.getByLabelText("Trajectory Mode")).toHaveValue("autoTransfer");
  await userEvent.selectOptions(screen.getByLabelText("Launch Planning"), "manual");
  fireEvent.change(screen.getByLabelText("Launch Epoch"), { target: { value: "2026-10-15" } });
  await userEvent.click(screen.getByRole("button", { name: "Propagate Trajectory" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "trajectory",
      request: expect.objectContaining({
        departureBody: "earth",
        targetBody: "mars",
        launchEpoch: "2026-10-15T00:00:00Z",
        initialState: { launchFromBody: { mode: "autoTransfer" } },
      }),
      launchPlanning: expect.objectContaining({
        mode: "manual",
        earliestLaunchEpoch: "2026-10-15T00:00:00Z",
      }),
    }),
  );
});

it("submits a tour request in manual mode when multiple bodies are selected", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="zh" loading={false} />);

  await userEvent.click(screen.getByRole("checkbox", { name: "金星" }));
  await userEvent.selectOptions(screen.getByLabelText("发射方案"), "manual");
  fireEvent.change(screen.getByLabelText("发射时刻"), { target: { value: "2026-03-01" } });
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "tour",
      request: expect.objectContaining({
        departureBody: "earth",
        requiredVisitBodies: ["mars", "venus"],
        launchEpoch: "2026-03-01T00:00:00Z",
      }),
      launchPlanning: expect.objectContaining({
        mode: "manual",
        earliestLaunchEpoch: "2026-03-01T00:00:00Z",
      }),
    }),
  );
});

it("submits propulsion settings for unified single-destination missions", async () => {
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

it("submits navigationConfig when dispersion is enabled", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="zh" loading={false} />);

  await userEvent.click(screen.getByLabelText("启用导航离散"));
  await userEvent.clear(screen.getByLabelText("固定随机种子"));
  await userEvent.type(screen.getByLabelText("固定随机种子"), "42");
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "trajectory",
      request: expect.objectContaining({
        navigationConfig: expect.objectContaining({
          enabled: true,
          randomSeed: 42,
          injectionDispersion: expect.objectContaining({
            positionSigmaKm: 25,
            velocitySigmaKmPerS: 0.02,
          }),
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
