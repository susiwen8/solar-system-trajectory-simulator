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
      screen.getByText("Liftoff: both stages rise together as the stack clears the pad.").closest("li"),
    ).toBeNull();
    expect(
      screen.getByText("Liftoff: the demo starts with the launch frame held close to the tower.").closest("li"),
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
});
