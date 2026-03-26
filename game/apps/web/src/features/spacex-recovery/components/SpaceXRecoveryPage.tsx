import { useEffect, useState, type ComponentType } from "react";

import { t, type Language } from "../../../lib/i18n";
import {
  RECOVERY_DEMO_DURATION_SECONDS,
  getRecoveryDemoSnapshot,
  type RecoveryDemoSnapshot,
} from "../lib/recovery-sequence";
import RecoveryPhaseCard from "./RecoveryPhaseCard";
import RecoveryPlaybackControls from "./RecoveryPlaybackControls";

type RecoverySceneProps = {
  language: Language;
  snapshot: RecoveryDemoSnapshot;
};

type SpaceXRecoveryPageProps = {
  language: Language;
  SceneComponent?: ComponentType<RecoverySceneProps>;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function DefaultRecoveryScene({ language, snapshot }: RecoverySceneProps) {
  const copy = t(language);

  return (
    <section className="recovery-scene" aria-label={copy.recoverySceneLabel}>
      <p className="eyebrow">{copy.recoverySceneLabel}</p>
      <p>{snapshot.activePhase.label}</p>
      <p>{snapshot.camera.mode}</p>
    </section>
  );
}

export default function SpaceXRecoveryPage({
  language,
  SceneComponent = DefaultRecoveryScene,
}: SpaceXRecoveryPageProps) {
  const copy = t(language);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const snapshot = getRecoveryDemoSnapshot(progress);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const step = 1 / RECOVERY_DEMO_DURATION_SECONDS;
    const interval = window.setInterval(() => {
      setProgress((currentProgress) => Math.min(currentProgress + step, 1));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (progress >= 1 && isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying, progress]);

  const handleReset = () => {
    setProgress(0);
  };

  return (
    <main className="recovery-page" aria-label={copy.spacexRecoveryTitle}>
      <header className="recovery-page__header">
        <p className="eyebrow">{copy.recoveryNavLabel}</p>
        <h1>{copy.spacexRecoveryTitle}</h1>
        <p>{copy.spacexRecoverySubtitle}</p>
        <p>{copy.recoveryPageBody}</p>
      </header>

      <RecoveryPhaseCard language={language} snapshot={snapshot} />
      <SceneComponent language={language} snapshot={snapshot} />
      <RecoveryPlaybackControls
        language={language}
        isPlaying={isPlaying}
        progress={progress}
        onTogglePlayback={() => {
          setIsPlaying((current) => !current);
        }}
        onReset={handleReset}
        onProgressChange={(nextProgress) => {
          setProgress(nextProgress);
        }}
      />
    </main>
  );
}
