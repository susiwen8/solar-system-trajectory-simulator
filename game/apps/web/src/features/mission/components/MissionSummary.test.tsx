import { render, screen } from "@testing-library/react";

import MissionSummary from "./MissionSummary";

function hasExactTextContent(text: string) {
  return (_content: string, node: Element | null) => node?.textContent === text;
}

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
      segmentType: "flybyEncounter",
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

const resultWithNavigationTelemetry = {
  ...result,
  navigationTelemetry: {
    enabled: true,
    nominalSamples: result.samples,
    dispersedSamples: result.samples,
    navigationEvents: [
      {
        type: "dispersionInjected",
        epoch: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "tcmExecuted",
        epoch: "2026-01-02T00:00:00.000Z",
        reason: "predictedMiss",
        predictedMissBeforeKm: 84500,
        predictedMissAfterKm: 1200,
        positionDeviationBeforeKm: 1200,
        positionDeviationAfterKm: 120,
        velocityDeviationBeforeKmPerS: 0.08,
        velocityDeviationAfterKmPerS: 0.01,
        deltaVKmPerS: 0.002,
      },
    ],
    tcmCount: 1,
    cumulativeCorrectionDeltaVKmPerS: 0.002,
    maxPredictedMissKm: 84500,
    maxPositionDeviationKm: 1200,
    maxVelocityDeviationKmPerS: 0.08,
    finalPredictedMissKm: 1200,
  },
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

  it("shows long flight time as years, months, and days", () => {
    render(
      <MissionSummary
        result={{
          ...result,
          flightTimeSeconds: 900 * 86_400,
        }}
        language="zh"
      />,
    );

    expect(screen.getByText("2 年 5 月 20 天")).toBeInTheDocument();
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

  it("shows the closed-loop route when the mission returns to earth", () => {
    render(
      <MissionSummary
        result={{
          ...result,
          closestApproach: {
            bodyId: "earth",
            distanceKm: 1200,
            epochSeconds: 900000,
          },
          visitOrder: ["mars"],
          fullSequenceBodies: ["earth", "mars", "earth"],
        }}
        language="en"
      />,
    );

    expect(screen.getByText(hasExactTextContent(": earth -> mars -> earth"))).toBeInTheDocument();
  });

  it("renders navigation metrics when telemetry is enabled", () => {
    render(<MissionSummary result={resultWithNavigationTelemetry} language="zh" />);

    expect(screen.getByText("导航")).toBeInTheDocument();
    expect(screen.getByText("累计修正 Delta-v")).toBeInTheDocument();
    expect(screen.getByText("最大预测偏差")).toBeInTheDocument();
    expect(screen.getByText("最终预测偏差")).toBeInTheDocument();
  });
});
