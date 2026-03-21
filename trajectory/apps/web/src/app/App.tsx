import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { apiClient, type MissionSolveInput } from "../api/client";
import { CandidateList } from "../components/CandidateList";
import { MissionForm } from "../components/MissionForm";
import { TelemetryHud } from "../components/TelemetryHud";
import { TimeControls } from "../components/TimeControls";
import { SceneRoot } from "../scene/SceneRoot";
import { createMissionStore } from "../state/missionStore";
import "../styles/app.css";

const missionStore = createMissionStore();

export function App() {
  const state = useSyncExternalStore(missionStore.subscribe, missionStore.getState);
  const [isLoading, setIsLoading] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const previousTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    apiClient
      .getBodies()
      .then((payload) => {
        missionStore.setBodies(payload.bodies);
      })
      .catch(() => {
        missionStore.setWarnings([
          "Body catalog is unavailable right now. Showing the planner shell without live body data."
        ]);
      });
  }, []);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (previousTimestampRef.current !== null) {
        const deltaSeconds = (timestamp - previousTimestampRef.current) / 1000;
        missionStore.tick(deltaSeconds);
      }
      previousTimestampRef.current = timestamp;
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const selectedCandidate =
    state.candidates.find((candidate) => candidate.id === state.selectedCandidateId) ?? null;

  async function handleSolve(input: MissionSolveInput) {
    setIsLoading(true);
    try {
      const response = await apiClient.solveMission(input);
      missionStore.setCandidates(response.candidates);
      missionStore.setWarnings(response.warnings);
      missionStore.setFidelity(response.fidelity);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="left-panel">
        <MissionForm bodies={state.bodies} isLoading={isLoading} onSolve={handleSolve} />
      </aside>
      <main className="center-panel">
        <SceneRoot
          bodies={state.bodies}
          candidate={selectedCandidate}
          cameraMode={state.cameraMode}
          playbackTimeSeconds={state.playback.currentTimeSeconds}
          onToggleCamera={() =>
            missionStore.setCameraMode(
              state.cameraMode === "overview" ? "first_person" : "overview"
            )
          }
        />
      </main>
      <aside className="right-panel">
        <CandidateList
          candidates={state.candidates}
          selectedCandidateId={state.selectedCandidateId}
          onSelect={(candidateId) => missionStore.selectCandidate(candidateId)}
        />
        <TelemetryHud
          cameraMode={state.cameraMode}
          fidelity={state.fidelity}
          warnings={state.warnings}
        />
      </aside>
      <footer className="bottom-panel">
        <TimeControls
          isPaused={state.playback.isPaused}
          speed={state.playback.speed}
          onTogglePaused={() => missionStore.togglePaused()}
          onSetSpeed={(speed) => missionStore.setPlaybackSpeed(speed)}
        />
      </footer>
    </div>
  );
}
