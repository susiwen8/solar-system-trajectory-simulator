import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getRecoveryDemoSnapshot } from "../lib/recovery-sequence";
import SpaceXRecoveryScene from "./SpaceXRecoveryScene";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SpaceXRecoveryScene", () => {
  it("renders a named recovery-scene region", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(<SpaceXRecoveryScene snapshot={getRecoveryDemoSnapshot(0.2)} language="zh" />);

    expect(screen.getByTestId("spacex-recovery-scene")).toBeInTheDocument();
    expect(screen.getByLabelText("回收场景")).toBeInTheDocument();
  });

  it("renders a fallback explainer when WebGL is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(<SpaceXRecoveryScene snapshot={getRecoveryDemoSnapshot(0.75)} language="zh" />);

    expect(screen.getByText("当前环境无法显示 3D 画面。")).toBeInTheDocument();
    expect(screen.getByText("一级大气层返回")).toBeInTheDocument();
    expect(
      screen.getByText("即使 WebGL 不可用，当前阶段和海上无人船回收叙事也会继续显示。"),
    ).toBeInTheDocument();
  });
});
