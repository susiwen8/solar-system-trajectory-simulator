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
});
