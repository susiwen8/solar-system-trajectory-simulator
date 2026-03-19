import { render, screen } from "@testing-library/react";

import MissionSummary from "./MissionSummary";

const result = {
  referenceFrame: "heliocentric-inertial",
  ephemerisSource: "bundled-keplerian",
  samples: [
    {
      epochSeconds: 0,
      positionKm: [0, 0, 0] as [number, number, number],
      velocityKmPerSec: [0, 0, 0] as [number, number, number],
    },
  ],
  closestApproach: {
    bodyId: "mars",
    distanceKm: 8450000,
    epochSeconds: 21600,
  },
  flightTimeSeconds: 259200,
  warnings: [],
  maneuverEvents: [
    {
      type: "TCM",
      startEpoch: "2026-01-02T00:00:00.000Z",
      durationSeconds: 3600,
      thrustDirection: "prograde",
      deltaVEstimateKmPerS: 0.002,
      propellantUsedKg: 1.2,
      massBeforeKg: 1800,
      massAfterKg: 1798.8,
    },
  ],
  finalMassKg: 1798.8,
  totalPropellantUsedKg: 1.2,
};

describe("MissionSummary", () => {
  it("shows flight time in days for English", () => {
    render(<MissionSummary result={result} language="en" />);

    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("shows flight time in days for Chinese", () => {
    render(<MissionSummary result={result} language="zh" />);

    expect(screen.getByText("3 天")).toBeInTheDocument();
  });

  it("renders propellant usage and final mass", () => {
    render(<MissionSummary result={result} language="zh" />);

    expect(screen.getByText("推进剂消耗")).toBeInTheDocument();
    expect(screen.getByText("最终质量")).toBeInTheDocument();
    expect(screen.getByText("机动次数")).toBeInTheDocument();
  });
});
