import { useEffect, useRef, useState } from "react";

import MissionForm, { type MissionSubmission } from "./features/mission/components/MissionForm";
import MissionSummary from "./features/mission/components/MissionSummary";
import { buildArrivalCaptureModel } from "./features/scene/lib/arrival-capture";
import type {
  BodyState,
  LaunchWindowRequest,
  LaunchWindowResponse,
  MissionCandidate,
  MissionRequest,
  TrajectoryResult,
} from "./features/mission/types";
import EmptySolarPreview from "./features/scene/components/EmptySolarPreview";
import SolarSystemScene from "./features/scene/components/SolarSystemScene";
import { fetchEphemerisBodies, fetchLaunchWindow, planMissionTour, propagateMission } from "./lib/api";
import { planetLabel, t, type Language } from "./lib/i18n";

const EMPTY_PREVIEW_EPOCH = "2026-01-01T00:00:00Z";

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
  const [launchWindowResult, setLaunchWindowResult] = useState<LaunchWindowResponse | null>(null);
  const ephemerisCacheRef = useRef<Record<string, { bodies: BodyState[]; ephemerisSource: string }>>({});
  const copy = t(language);
  const activeResult = result ? resolveActiveResult(result, activeCandidateIndex) : null;
  const hasTerminalCaptureOrbit = activeResult ? buildArrivalCaptureModel(activeResult) != null : false;

  const currentEpoch =
    activeResult && launchEpoch
      ? epochFromOffset(launchEpoch, activeResult.samples[selectedSampleIndex]?.epochSeconds ?? 0)
      : null;
  const ephemerisEpoch = currentEpoch ?? EMPTY_PREVIEW_EPOCH;

  useEffect(() => {
    let cancelled = false;
    const cached = ephemerisCacheRef.current[ephemerisEpoch];
    if (cached) {
      setBodies(cached.bodies);
      setEphemerisSource(cached.ephemerisSource);
      return () => {
        cancelled = true;
      };
    }

    void fetchEphemerisBodies(ephemerisEpoch)
      .then((ephemeris) => {
        if (!cancelled) {
          ephemerisCacheRef.current[ephemerisEpoch] = {
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
  }, [ephemerisEpoch, copy.ephemerisRequestFailed]);

  useEffect(() => {
    if (!isPlaying || !activeResult) {
      return;
    }

    if (selectedSampleIndex >= activeResult.samples.length - 1) {
      if (!hasTerminalCaptureOrbit) {
        setIsPlaying(false);
      }
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
  }, [hasTerminalCaptureOrbit, isPlaying, activeResult, selectedSampleIndex]);

  async function handleSubmit(submission: MissionSubmission) {
    setLoading(true);
    setErrorMessage(null);
    setIsPlaying(false);

    try {
      const effectiveLaunchEpoch =
        submission.launchPlanning.mode === "manual"
          ? submission.request.launchEpoch
          : await resolveLaunchEpoch(submission);
      const nextResult =
        submission.kind === "tour"
          ? await planMissionTour({
              ...submission.request,
              launchEpoch: effectiveLaunchEpoch,
            })
          : await propagateMission({
              ...submission.request,
              launchEpoch: effectiveLaunchEpoch,
            } as MissionRequest);
      setResult(nextResult);
      setActiveCandidateIndex(0);
      setEphemerisSource(nextResult.ephemerisSource);
      setLaunchEpoch(effectiveLaunchEpoch);
      setSelectedSampleIndex(0);
      ephemerisCacheRef.current = {};
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : submission.kind === "tour"
            ? copy.tourPlanningRequestFailed
            : copy.propagationRequestFailed,
      );
    } finally {
      setLoading(false);
    }
  }

  async function resolveLaunchEpoch(submission: MissionSubmission): Promise<string> {
    const launchWindow = await fetchLaunchWindow(buildLaunchWindowRequest(submission));
    setLaunchWindowResult(launchWindow);
    if (submission.launchPlanning.mode === "windowSelect") {
      return submission.launchPlanning.selectedLaunchEpoch || launchWindow.recommendedLaunchEpoch;
    }
    return launchWindow.recommendedLaunchEpoch;
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
        </div>

        <MissionForm
          onSubmit={handleSubmit}
          language={language}
          loading={loading}
          launchWindowResult={launchWindowResult}
        />

        {errorMessage ? (
          <p className="alert-card" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {activeResult ? (
          <MissionSummary result={activeResult} language={language} />
        ) : (
          <section className="summary-card summary-card--placeholder" aria-label={copy.missionSummary}>
            <p className="summary-card__eyebrow">{copy.telemetrySnapshot}</p>
            <h2>{copy.readyTitle}</h2>
          </section>
        )}

        {result?.candidates?.length ? (
          <section className="summary-card" aria-label={copy.candidatePlans}>
            <p className="summary-card__eyebrow">{copy.candidatePlans}</p>
            <h2>{copy.selectedCandidateLabel}</h2>
            <div className="candidate-list">
              {result.candidates.map((candidate, index) => (
                <button
                  key={`${resolveVisitSequenceBodies(candidate).join("-")}-${index}`}
                  type="button"
                  className={`candidate-card ${index === activeCandidateIndex ? "candidate-card--active" : ""}`}
                  onClick={() => {
                    setActiveCandidateIndex(index);
                    setSelectedSampleIndex(0);
                    setIsPlaying(false);
                    ephemerisCacheRef.current = {};
                  }}
                >
                  <strong>{formatBodySequence(language, resolveVisitSequenceBodies(candidate))}</strong>
                  {candidate.visitOrder?.length ? (
                    <span>
                      {copy.visitOrderLabel}: {candidate.visitOrder.map((bodyId) => planetLabel(language, bodyId)).join(" -> ")}
                    </span>
                  ) : null}
                  {shouldShowFullSequence(candidate) ? (
                    <span>{copy.fullSequenceLabel}: {formatBodySequence(language, resolveFullSequenceBodies(candidate))}</span>
                  ) : null}
                  <span>{copy.scoreLabel}: {candidate.score.toFixed(2)}</span>
                  <span>{copy.deltaVLabel}: {candidate.deltaVKmPerS.toFixed(2)} km/s</span>
                  <span>
                    {copy.flybyCountLabel}: {Math.max(resolveFullSequenceBodies(candidate).length - (candidate.visitOrder?.length ?? 2) - 1, 0)}
                  </span>
                  {candidate.visitOrder?.length ? <span>{copy.visitCountLabel}: {candidate.visitOrder.length}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

      </aside>

      <section className="scene-stage" aria-label={copy.primaryFlightView}>
        {activeResult ? (
          <SolarSystemScene
            result={activeResult}
            bodies={bodies}
            launchEpoch={launchEpoch}
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
            <EmptySolarPreview bodies={bodies} language={language} />
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
    warnings: candidate.warnings.length ? candidate.warnings : result.warnings,
    candidates: result.candidates,
    sequenceBodies: candidate.sequenceBodies ?? result.sequenceBodies,
    visitOrder: candidate.visitOrder ?? result.visitOrder,
    fullSequenceBodies: candidate.fullSequenceBodies ?? result.fullSequenceBodies,
    visitEvents: candidate.visitEvents?.length ? candidate.visitEvents : result.visitEvents,
    legs: candidate.legs?.length ? candidate.legs : result.legs,
    score: candidate.score,
    deltaVKmPerS: candidate.deltaVKmPerS,
    flybyEvents: candidate.flybyEvents,
    segments: candidate.segments ?? result.segments,
    maneuverEvents: candidate.maneuverEvents ?? result.maneuverEvents,
    finalMassKg: candidate.finalMassKg ?? result.finalMassKg,
    totalPropellantUsedKg: candidate.totalPropellantUsedKg ?? result.totalPropellantUsedKg,
    propulsionConfig: candidate.propulsionConfig ?? result.propulsionConfig,
    missionTimeline: candidate.missionTimeline ?? result.missionTimeline,
  };
}

function resolveVisitSequenceBodies(route: Pick<MissionCandidate, "sequenceBodies" | "fullSequenceBodies" | "visitOrder">): string[] {
  if (route.visitOrder?.length) {
    return ["earth", ...route.visitOrder];
  }

  if (route.sequenceBodies?.length) {
    return route.sequenceBodies;
  }

  return route.fullSequenceBodies ?? [];
}

function buildLaunchWindowRequest(submission: MissionSubmission): LaunchWindowRequest {
  if (submission.kind === "trajectory") {
    return {
      missionType: "trajectory",
      departureBody: submission.request.departureBody,
      targetBody: submission.request.targetBody,
      earliestLaunchEpoch: submission.launchPlanning.earliestLaunchEpoch,
      propulsionConfig: submission.request.propulsionConfig,
    };
  }

  return {
    missionType: "tour",
    departureBody: submission.request.departureBody,
    requiredVisitBodies: submission.request.requiredVisitBodies,
    earliestLaunchEpoch: submission.launchPlanning.earliestLaunchEpoch,
    maxAssistBodiesPerLeg: submission.request.maxAssistBodiesPerLeg,
    maxReturnedCandidates: submission.request.maxReturnedCandidates,
    allowAssistBodies: submission.request.allowAssistBodies,
    allowRepeatedFlybys: submission.request.allowRepeatedFlybys,
    propulsionConfig: submission.request.propulsionConfig,
  };
}

function resolveFullSequenceBodies(route: Pick<MissionCandidate, "sequenceBodies" | "fullSequenceBodies">): string[] {
  if (route.fullSequenceBodies?.length) {
    return route.fullSequenceBodies;
  }

  return route.sequenceBodies ?? [];
}

function shouldShowFullSequence(candidate: MissionCandidate): boolean {
  const visitSequence = resolveVisitSequenceBodies(candidate);
  const fullSequence = resolveFullSequenceBodies(candidate);
  return fullSequence.length > 0 && fullSequence.join("|") !== visitSequence.join("|");
}

function formatBodySequence(language: Language, bodyIds: string[]): string {
  return bodyIds.map((bodyId) => planetLabel(language, bodyId)).join(" -> ");
}

function epochFromOffset(baseEpoch: string, offsetSeconds: number): string {
  return new Date(new Date(baseEpoch).getTime() + offsetSeconds * 1000).toISOString();
}
