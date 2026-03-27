import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SpaceXRecoveryPage from "./SpaceXRecoveryPage";
import type { RecoveryDemoSnapshot } from "../lib/recovery-sequence";
import type { Language } from "../../../lib/i18n";

function mockMatchMedia(prefersReducedMotion: boolean) {
  const matchMedia = vi.fn().mockImplementation((query: string) => {
    const matches = prefersReducedMotion && query.includes("prefers-reduced-motion");

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
}

function renderRecoveryPage(language: Language = "en") {
  const SceneMock = ({ snapshot }: { snapshot: RecoveryDemoSnapshot }) => (
    <div
      data-testid="recovery-scene"
      data-phase={snapshot.activePhase.id}
      data-progress={snapshot.progress.toFixed(3)}
    />
  );

  render(
    <SpaceXRecoveryPage
      language={language}
      SceneComponent={SceneMock as never}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SpaceXRecoveryPage", () => {
  it("starts autoplaying when reduced motion is not requested", async () => {
    mockMatchMedia(false);
    renderRecoveryPage();

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Liftoff" })).toBeInTheDocument();
    expect(
      screen.getByText("Both stages rise together as the stack clears the pad.").closest("li"),
    ).toBeNull();
    expect(
      screen.getByText("The launch frame stays tight to emphasize thrust and scale.").closest("li"),
    ).not.toBeNull();
    expect(screen.getByTestId("recovery-scene")).toHaveAttribute("data-phase", "liftoff");

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pitch and Ascent" })).toBeInTheDocument();
    expect(screen.getByTestId("recovery-scene")).toHaveAttribute(
      "data-phase",
      "pitch-and-ascent",
    );
  });

  it("reset returns the timeline back to liftoff after scrubbing", () => {
    mockMatchMedia(false);
    renderRecoveryPage();

    fireEvent.change(screen.getByRole("slider", { name: "Playback Step" }), {
      target: { value: "0.72" },
    });

    expect(screen.getByRole("heading", { name: "First-Stage Atmospheric Return" })).toBeInTheDocument();
    expect(screen.getByTestId("recovery-scene")).toHaveAttribute(
      "data-phase",
      "first-stage-atmospheric-return",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("heading", { name: "Liftoff" })).toBeInTheDocument();
    expect(screen.getByTestId("recovery-scene")).toHaveAttribute("data-phase", "liftoff");
    expect(screen.getByRole("slider", { name: "Playback Step" })).toHaveProperty("value", "0");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("starts paused when prefers-reduced-motion is enabled", async () => {
    mockMatchMedia(true);
    renderRecoveryPage();

    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Liftoff" })).toBeInTheDocument();
    expect(screen.getByTestId("recovery-scene")).toHaveAttribute("data-phase", "liftoff");

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByTestId("recovery-scene")).toHaveAttribute("data-phase", "liftoff");
  });

  it("renders localized Chinese phase copy when the page language is zh", () => {
    mockMatchMedia(true);
    renderRecoveryPage("zh");

    expect(screen.getByRole("heading", { name: "一级起飞" })).toBeInTheDocument();
    expect(screen.getByText("一级与二级作为整套箭体一起离开发射台。")).toBeInTheDocument();
    expect(screen.getByText("镜头保持近距离仰视，突出推力和尺度感。").closest("li")).not.toBeNull();
    expect(screen.getByRole("button", { name: "开始" })).toBeInTheDocument();
  });

  it("mounts the built-in recovery scene when no override scene is provided", () => {
    mockMatchMedia(true);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(<SpaceXRecoveryPage language="zh" />);

    expect(screen.getByTestId("spacex-recovery-scene")).toBeInTheDocument();
    expect(screen.getByText("当前环境无法显示 3D 画面。")).toBeInTheDocument();
  });

  it("describes the landing phase as an offshore drone-ship recovery in Chinese", () => {
    mockMatchMedia(true);
    renderRecoveryPage("zh");

    fireEvent.change(screen.getByRole("slider", { name: "回放步进" }), {
      target: { value: "0.82" },
    });

    expect(screen.getByRole("heading", { name: "着陆点火与落地" })).toBeInTheDocument();
    expect(screen.getByText("一级在最后阶段减速，对准海上无人船甲板完成落地。")).toBeInTheDocument();
  });
});
