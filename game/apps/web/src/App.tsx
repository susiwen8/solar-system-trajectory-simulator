import { useEffect, useState } from "react";

import MissionForm from "./features/mission/components/MissionForm";
import MissionSummary from "./features/mission/components/MissionSummary";
import type { BodyState, MissionRequest, TrajectoryResult } from "./features/mission/types";
import SolarSystemScene from "./features/scene/components/SolarSystemScene";
import { fetchEphemerisBodies, propagateMission } from "./lib/api";

export default function App() {
  const [result, setResult] = useState<TrajectoryResult | null>(null);
  const [bodies, setBodies] = useState<BodyState[]>([]);
  const [launchEpoch, setLaunchEpoch] = useState<string | null>(null);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentEpoch =
    result && launchEpoch
      ? epochFromOffset(launchEpoch, result.samples[selectedSampleIndex]?.epochSeconds ?? 0)
      : null;

  useEffect(() => {
    if (!currentEpoch) {
      return;
    }

    let cancelled = false;
    void fetchEphemerisBodies(currentEpoch)
      .then((ephemeris) => {
        if (!cancelled) {
          setBodies(ephemeris.bodies);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Ephemeris request failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentEpoch]);

  async function handleSubmit(request: MissionRequest) {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextResult = await propagateMission(request);
      setResult(nextResult);
      setLaunchEpoch(request.launchEpoch);
      setSelectedSampleIndex(0);
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
          <SolarSystemScene
            result={result}
            bodies={bodies}
            currentEpoch={currentEpoch}
            selectedSampleIndex={selectedSampleIndex}
            onSampleIndexChange={setSelectedSampleIndex}
          />
        </>
      ) : null}
    </main>
  );
}

function epochFromOffset(baseEpoch: string, offsetSeconds: number): string {
  return new Date(new Date(baseEpoch).getTime() + offsetSeconds * 1000).toISOString();
}
