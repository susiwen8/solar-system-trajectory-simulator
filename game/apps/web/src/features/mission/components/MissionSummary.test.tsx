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
  segments: [
    {
      segmentType: "launchParkingOrbit",
      startEpoch: "2026-01-01T00:00:00.000Z",
      endEpoch: "2026-01-01T01:30:00.000Z",
      samples: [],
      initialState: {
        epoch: "2026-01-01T00:00:00.000Z",
        referenceFrame: "earth-centered-inertial",
        referenceBodyId: "earth",
        positionKm: [6678.1, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 7.7, 0] as [number, number, number],
      },
      finalState: {
        epoch: "2026-01-01T01:30:00.000Z",
        referenceFrame: "earth-centered-inertial",
        referenceBodyId: "earth",
        positionKm: [6678.1, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 7.7, 0] as [number, number, number],
      },
      events: [],
      orbitSummary: {
        isBound: true,
        periapsisKm: 6678.1,
        apoapsisKm: 6678.1,
        inclinationDeg: 28.5,
      },
    },
    {
      segmentType: "earthEscape",
      startEpoch: "2026-01-01T01:30:00.000Z",
      endEpoch: "2026-01-01T07:30:00.000Z",
      samples: [],
      initialState: {
        epoch: "2026-01-01T01:30:00.000Z",
        referenceFrame: "earth-centered-inertial",
        referenceBodyId: "earth",
        positionKm: [6678.1, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 10.9, 0] as [number, number, number],
      },
      finalState: {
        epoch: "2026-01-01T07:30:00.000Z",
        referenceFrame: "heliocentric-inertial",
        positionKm: [149597870.7, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 32.7, 0] as [number, number, number],
      },
      events: [],
    },
    {
      segmentType: "heliocentricCruise",
      startEpoch: "2026-01-01T07:30:00.000Z",
      endEpoch: "2026-01-05T07:30:00.000Z",
      samples: [],
      initialState: {
        epoch: "2026-01-01T07:30:00.000Z",
        referenceFrame: "heliocentric-inertial",
        positionKm: [149597870.7, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 32.7, 0] as [number, number, number],
      },
      finalState: {
        epoch: "2026-01-05T07:30:00.000Z",
        referenceFrame: "heliocentric-inertial",
        positionKm: [151000000, 3500000, 0] as [number, number, number],
        velocityKmPerSec: [-0.2, 31.9, 0] as [number, number, number],
      },
      events: [],
      metadata: {
        targetBody: "mars",
        maneuverCount: 2,
        deltaVTotalKmPerS: 0.0079,
      },
      massSummary: {
        massBeforeKg: 1800,
        massAfterKg: 1795.2,
        propellantUsedKg: 4.8,
      },
    },
    {
      segmentType: "gravityAssistFlyby",
      startEpoch: "2026-07-01T00:00:00.000Z",
      endEpoch: "2026-07-02T00:00:00.000Z",
      samples: [],
      initialState: {
        epoch: "2026-07-01T00:00:00.000Z",
        referenceFrame: "heliocentric-inertial",
        referenceBodyId: "jupiter",
        positionKm: [778500000, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 6.1, 0] as [number, number, number],
      },
      finalState: {
        epoch: "2026-07-02T00:00:00.000Z",
        referenceFrame: "heliocentric-inertial",
        referenceBodyId: "jupiter",
        positionKm: [778500000, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 6.0, 0] as [number, number, number],
      },
      events: [],
      metadata: {
        bodyId: "jupiter",
        periapsisAltitudeKm: 75000,
        turnAngleDeg: 28,
        inboundVInfinityKmPerS: 6.1,
        outboundVInfinityKmPerS: 6.0,
      },
    },
  ],
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

  it("renders localized mission segment labels", () => {
    render(<MissionSummary result={result} language="en" />);

    expect(screen.getByText("Mission Segments")).toBeInTheDocument();
    expect(screen.getByText("Parking Orbit")).toBeInTheDocument();
    expect(screen.getByText("Earth Escape")).toBeInTheDocument();
  });

  it("renders cruise and flyby detail text", () => {
    render(<MissionSummary result={result} language="en" />);

    expect(screen.getByText(/Maneuvers: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Delta-v: 0.0079 km\/s/)).toBeInTheDocument();
    expect(screen.getByText(/Turn Angle: 28/)).toBeInTheDocument();
    expect(screen.getByText(/Periapsis Altitude: 75,000 km/)).toBeInTheDocument();
  });
});
