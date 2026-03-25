import { buildMissionTimelinePhaseMarkers, getMissionTimelineSnapshot } from "./mission-timeline";

it("finds the current phase and next event for a playback epoch", () => {
  const timeline = {
    missionStartEpoch: "2026-01-01T00:00:00.000Z",
    missionEndEpoch: "2026-01-11T00:00:00.000Z",
    currentObjective: "Arrive at Mars",
    events: [
      {
        id: "event-001",
        type: "launch",
        epoch: "2026-01-01T00:00:00.000Z",
        title: "Launch",
        description: "Depart Earth.",
      },
      {
        id: "event-002",
        type: "maneuver",
        epoch: "2026-01-06T00:00:00.000Z",
        title: "DSM",
        description: "Mid-course correction.",
      },
    ],
    phases: [
      {
        id: "phase-001",
        type: "launch",
        startEpoch: "2026-01-01T00:00:00.000Z",
        endEpoch: "2026-01-01T06:00:00.000Z",
        title: "Launch",
        description: "Initial departure.",
        eventIds: ["event-001"],
      },
      {
        id: "phase-002",
        type: "deepSpaceCruise",
        startEpoch: "2026-01-01T06:00:00.000Z",
        endEpoch: "2026-01-10T00:00:00.000Z",
        title: "Deep-Space Cruise",
        description: "Cruise phase.",
        eventIds: [],
      },
    ],
  };

  const snapshot = getMissionTimelineSnapshot(timeline, "2026-01-04T00:00:00.000Z");

  expect(snapshot.currentPhase?.type).toBe("deepSpaceCruise");
  expect(snapshot.nextEvent?.type).toBe("maneuver");
  expect(snapshot.progress).toBeGreaterThan(0.2);
});

it("treats a shared phase boundary as the start of the next phase", () => {
  const timeline = {
    missionStartEpoch: "2026-01-01T00:00:00.000Z",
    missionEndEpoch: "2026-01-02T00:00:00.000Z",
    currentObjective: "Arrive at Mars",
    events: [],
    phases: [
      {
        id: "phase-001",
        type: "launch",
        startEpoch: "2026-01-01T00:00:00.000Z",
        endEpoch: "2026-01-01T12:00:00.000Z",
        title: "Launch",
        description: "Initial departure.",
        eventIds: [],
      },
      {
        id: "phase-002",
        type: "deepSpaceCruise",
        startEpoch: "2026-01-01T12:00:00.000Z",
        endEpoch: "2026-01-02T00:00:00.000Z",
        title: "Deep-Space Cruise",
        description: "Cruise phase.",
        eventIds: [],
      },
    ],
  };

  const snapshot = getMissionTimelineSnapshot(timeline, "2026-01-01T12:00:00.000Z");

  expect(snapshot.currentPhase?.id).toBe("phase-002");
});

it("maps mission phases to playback markers and highlights the active phase", () => {
  const timeline = {
    missionStartEpoch: "2026-01-01T00:00:00.000Z",
    missionEndEpoch: "2026-01-02T00:00:00.000Z",
    currentObjective: "Arrive at Mars",
    events: [],
    phases: [
      {
        id: "phase-001",
        type: "launch",
        startEpoch: "2026-01-01T00:00:00.000Z",
        endEpoch: "2026-01-01T12:00:00.000Z",
        title: "Launch",
        description: "Initial departure.",
        eventIds: [],
      },
      {
        id: "phase-002",
        type: "deepSpaceCruise",
        startEpoch: "2026-01-01T12:00:00.000Z",
        endEpoch: "2026-01-02T00:00:00.000Z",
        title: "Deep-Space Cruise",
        description: "Cruise phase.",
        eventIds: [],
      },
    ],
  };

  const markers = buildMissionTimelinePhaseMarkers(
    timeline,
    [
      { epochSeconds: 0 },
      { epochSeconds: 12 * 3600 },
      { epochSeconds: 24 * 3600 },
    ],
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T18:00:00.000Z",
  );

  expect(markers).toEqual([
    expect.objectContaining({
      id: "phase-001",
      sampleIndex: 0,
      progress: 0,
      isActive: false,
    }),
    expect.objectContaining({
      id: "phase-002",
      sampleIndex: 1,
      progress: 0.5,
      isActive: true,
    }),
  ]);
});
