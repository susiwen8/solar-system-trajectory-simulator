import { useState } from "react";

import MissionForm from "./features/mission/components/MissionForm";
import MissionSummary from "./features/mission/components/MissionSummary";
import type { BodyState, MissionRequest, TrajectoryResult } from "./features/mission/types";
import SolarSystemScene from "./features/scene/components/SolarSystemScene";
import { fetchEphemerisBodies, propagateMission } from "./lib/api";

export default function App() {
  const [result, setResult] = useState<TrajectoryResult | null>(null);
  const [bodies, setBodies] = useState<BodyState[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(request: MissionRequest) {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [nextResult, ephemeris] = await Promise.all([
        propagateMission(request),
        fetchEphemerisBodies(request.launchEpoch)
      ]);
      setResult(nextResult);
      setBodies(ephemeris.bodies);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Propagation request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        display: "grid",
        gap: "1.5rem",
        padding: "2rem",
        color: "#1e2125",
        background:
          "linear-gradient(180deg, #f4efe5 0%, #f2e7d5 32%, #d9e4ee 100%)",
        minHeight: "100vh"
      }}
    >
      <h1>Solar System Trajectory Simulator</h1>
      <MissionForm onSubmit={handleSubmit} />
      {loading ? <p>Running propagation...</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {result ? (
        <>
          <MissionSummary result={result} />
          <SolarSystemScene result={result} bodies={bodies} />
        </>
      ) : null}
    </main>
  );
}
