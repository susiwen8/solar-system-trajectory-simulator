import { useEffect, useRef, useState } from "react";

import MissionForm from "./features/mission/components/MissionForm";
import MissionSummary from "./features/mission/components/MissionSummary";
import type { BodyState, MissionCandidate, MissionRequest, TrajectoryResult } from "./features/mission/types";
import SolarSystemScene from "./features/scene/components/SolarSystemScene";
import { fetchEphemerisBodies, propagateMission } from "./lib/api";
import { planetLabel, t, type Language } from "./lib/i18n";

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [result, setResult] = useState<TrajectoryResult | null>(null);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [bodies, setBodies] = useState<BodyState[]>([]);
  const [ephemerisSource, setEphemerisSource] = useState<string | null>(null);
  const [launchEpoch, setLaunchEpoch] = useState<string | null>(null);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ephemerisCacheRef = useRef<Record<string, { bodies: BodyState[]; ephemerisSource: string }>>({});
  const copy = t(language);
  const activeResult = result ? resolveActiveResult(result, activeCandidateIndex) : null;

  const currentEpoch =
    activeResult && launchEpoch
      ? epochFromOffset(launchEpoch, activeResult.samples[selectedSampleIndex]?.epochSeconds ?? 0)
      : null;

  useEffect(() => {
    if (!currentEpoch) {
      return;
    }

    let cancelled = false;
    const cached = ephemerisCacheRef.current[currentEpoch];
    if (cached) {
      setBodies(cached.bodies);
      setEphemerisSource(cached.ephemerisSource);
      return () => {
        cancelled = true;
      };
    }

    void fetchEphemerisBodies(currentEpoch)
      .then((ephemeris) => {
        if (!cancelled) {
          ephemerisCacheRef.current[currentEpoch] = {
            bodies: ephemeris.bodies,
            ephemerisSource: ephemeris.ephemerisSource,
          };
          setBodies(ephemeris.bodies);
          setEphemerisSource(ephemeris.ephemerisSource);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : copy.ephemerisRequestFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentEpoch]);

  useEffect(() => {
    if (!isPlaying || !activeResult) {
      return;
    }

    if (selectedSampleIndex >= activeResult.samples.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectedSampleIndex((currentIndex) => {
        if (currentIndex >= activeResult.samples.length - 1) {
          setIsPlaying(false);
          return currentIndex;
        }
        return currentIndex + 1;
      });
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isPlaying, activeResult, selectedSampleIndex]);

  async function handleSubmit(request: MissionRequest) {
    setLoading(true);
    setErrorMessage(null);
    setIsPlaying(false);

    try {
      const nextResult = await propagateMission(request);
      setResult(nextResult);
      setActiveCandidateIndex(0);
      setEphemerisSource(nextResult.ephemerisSource);
      setLaunchEpoch(request.launchEpoch);
      setSelectedSampleIndex(0);
      ephemerisCacheRef.current = {};
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.propagationRequestFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell" data-scroll-mode="viewport-locked">
      <aside className="mission-panel" aria-label={copy.missionControlPanel}>
        <div className="mission-panel__header">
          <div className="mission-panel__header-top">
            <p className="eyebrow">{copy.deckEyebrow}</p>
            <div className="language-toggle" aria-label={copy.languageToggle}>
              <button
                type="button"
                className={`language-toggle__button ${language === "zh" ? "language-toggle__button--active" : ""}`}
                onClick={() => setLanguage("zh")}
              >
                {copy.languageZh}
              </button>
              <button
                type="button"
                className={`language-toggle__button ${language === "en" ? "language-toggle__button--active" : ""}`}
                onClick={() => setLanguage("en")}
              >
                {copy.languageEn}
              </button>
            </div>
          </div>
          <h1>{copy.appTitle}</h1>
          <p className="mission-panel__lede">{copy.appLede}</p>
        </div>

        <MissionForm onSubmit={handleSubmit} language={language} loading={loading} />

        <div className="status-strip" aria-label={copy.missionStatus}>
          <div className="status-pill">
            <span className="status-pill__label">{copy.referenceFrame}</span>
            <strong>{activeResult?.referenceFrame ?? "heliocentric-inertial"}</strong>
          </div>
        <div className="status-pill">
          <span className="status-pill__label">{copy.currentEpoch}</span>
          <strong>{currentEpoch ?? copy.awaitingPropagation}</strong>
        </div>
        <div className="status-pill">
          <span className="status-pill__label">{copy.ephemerisSource}</span>
          <strong>{ephemerisSource ?? "bundled-keplerian"}</strong>
        </div>
        <div className={`status-pill ${loading ? "status-pill--active" : ""}`}>
          <span className="status-pill__label">{copy.propagation}</span>
          <strong>{loading ? copy.running : copy.standby}</strong>
          </div>
        </div>

        {errorMessage ? (
          <p className="alert-card" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {loading ? <p className="loading-copy">{copy.runningPropagation}</p> : null}

        {activeResult ? (
          <MissionSummary result={activeResult} language={language} />
        ) : (
          <section className="summary-card summary-card--placeholder" aria-label={copy.missionSummary}>
            <p className="summary-card__eyebrow">{copy.telemetrySnapshot}</p>
            <h2>{copy.readyTitle}</h2>
            <p>{copy.readyBody}</p>
          </section>
        )}

        {result?.candidates?.length ? (
          <section className="summary-card" aria-label={copy.candidatePlans}>
            <p className="summary-card__eyebrow">{copy.candidatePlans}</p>
            <h2>{copy.selectedCandidateLabel}</h2>
            <p>{copy.candidatePlansBody}</p>
            <div className="candidate-list">
              {result.candidates.map((candidate, index) => (
                <button
                  key={`${candidate.sequenceBodies.join("-")}-${index}`}
                  type="button"
                  className={`candidate-card ${index === activeCandidateIndex ? "candidate-card--active" : ""}`}
                  onClick={() => {
                    setActiveCandidateIndex(index);
                    setSelectedSampleIndex(0);
                    setIsPlaying(false);
                    ephemerisCacheRef.current = {};
                  }}
                >
                  <strong>{candidate.sequenceBodies.map((bodyId) => planetLabel(language, bodyId)).join(" -> ")}</strong>
                  <span>{copy.scoreLabel}: {candidate.score.toFixed(2)}</span>
                  <span>{copy.deltaVLabel}: {candidate.deltaVKmPerS.toFixed(2)} km/s</span>
                  <span>{copy.flybyCountLabel}: {Math.max(candidate.sequenceBodies.length - 2, 0)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

      </aside>

      <section className="scene-stage" aria-label={copy.primaryFlightView}>
        <div className="scene-stage__header">
          <div>
            <p className="eyebrow">{copy.primaryView}</p>
            <h2>{copy.theatreTitle}</h2>
          </div>
          <p className="scene-stage__copy">{copy.theatreCopy}</p>
        </div>

        {activeResult ? (
          <SolarSystemScene
            result={activeResult}
            bodies={bodies}
            currentEpoch={currentEpoch}
            selectedSampleIndex={selectedSampleIndex}
            onSampleIndexChange={setSelectedSampleIndex}
            isPlaying={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onReset={() => {
              setIsPlaying(false);
              setSelectedSampleIndex(0);
            }}
            language={language}
          />
        ) : (
          <section className="scene-shell scene-shell--empty" aria-label={copy.trajectoryScene}>
            <div className="scene-shell__backdrop" aria-hidden="true">
              <span className="scene-orbit scene-orbit--one" />
              <span className="scene-orbit scene-orbit--two" />
              <span className="scene-orbit scene-orbit--three" />
              <span className="scene-sun" />
            </div>
            <div className="scene-empty-copy">
              <p className="eyebrow">{copy.visualStandby}</p>
              <h3>{copy.paintTrajectory}</h3>
              <p>{copy.standbyBody}</p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function resolveActiveResult(result: TrajectoryResult, activeCandidateIndex: number): TrajectoryResult {
  const candidate = result.candidates?.[activeCandidateIndex];
  if (!candidate) {
    return result;
  }

  return materializeCandidate(result, candidate);
}

function materializeCandidate(result: TrajectoryResult, candidate: MissionCandidate): TrajectoryResult {
  return {
    referenceFrame: result.referenceFrame,
    ephemerisSource: result.ephemerisSource,
    samples: candidate.samples,
    closestApproach: candidate.closestApproach,
    flightTimeSeconds: candidate.flightTimeSeconds,
    warnings: candidate.warnings,
    candidates: result.candidates,
    sequenceBodies: candidate.sequenceBodies,
    score: candidate.score,
    deltaVKmPerS: candidate.deltaVKmPerS,
    flybyEvents: candidate.flybyEvents,
  };
}

function epochFromOffset(baseEpoch: string, offsetSeconds: number): string {
  return new Date(new Date(baseEpoch).getTime() + offsetSeconds * 1000).toISOString();
}
