import { createMissionStore } from "../../../src/state/missionStore";


test("selects a returned candidate and resets playback to the new mission", () => {
  const store = createMissionStore();

  store.setCandidates([
    {
      id: "candidate-a",
      summary: { label: "recommended", totalDurationDays: 240, totalDeltaV: 5.8 }
    },
    {
      id: "candidate-b",
      summary: { label: "fuel_efficient", totalDurationDays: 310, totalDeltaV: 4.9 }
    }
  ]);

  store.selectCandidate("candidate-b");

  expect(store.getState().selectedCandidateId).toBe("candidate-b");
  expect(store.getState().playback.currentTimeSeconds).toBe(0);
});

