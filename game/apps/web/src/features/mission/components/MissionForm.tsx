import { useEffect, useState } from "react";

import { planetLabel, t, type Language } from "../../../lib/i18n";
import type {
  BodyId,
  LaunchPlanningMode,
  LaunchWindowResponse,
  MissionRequest,
  MissionTourRequest,
  NavigationConfig,
  PropulsionConfig,
} from "../types";

export type MissionLaunchPlanning = {
  mode: LaunchPlanningMode;
  earliestLaunchEpoch: string;
  selectedLaunchEpoch?: string | null;
};

export type MissionSubmission =
  | {
      kind: "trajectory";
      request: MissionRequest;
      launchPlanning: MissionLaunchPlanning;
    }
  | {
      kind: "tour";
      request: MissionTourRequest;
      launchPlanning: MissionLaunchPlanning;
    };

type MissionFormProps = {
  onSubmit: (submission: MissionSubmission) => void | Promise<void>;
  language: Language;
  loading: boolean;
  launchWindowResult?: LaunchWindowResponse | null;
};

const visitPlanets = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"] as const satisfies readonly Exclude<BodyId, "earth">[];

const defaultTrajectoryRequest: MissionRequest = {
  departureBody: "earth",
  targetBody: "mars",
  launchEpoch: "2026-01-01T00:00:00Z",
  launchProfile: {
    mode: "parkingOrbit",
    parkingOrbitAltitudeKm: 300,
    parkingOrbitInclinationDeg: 28.5,
  },
  initialState: {
    launchFromBody: {
      mode: "autoTransfer",
    },
  },
};

const defaultPlannerOptions = {
  maxAssistBodiesPerLeg: 2,
  maxReturnedCandidates: 5,
  allowAssistBodies: true,
  allowRepeatedFlybys: true,
} as const;

const defaultPropulsionConfig: PropulsionConfig = {
  initialMassKg: 1800,
  propellantMassKg: 420,
  maxThrustN: 0.8,
  ispSeconds: 3200,
};

const defaultNavigationConfig: NavigationConfig = {
  enabled: true,
  randomSeed: null,
  injectionDispersion: {
    positionSigmaKm: 25,
    velocitySigmaKmPerS: 0.02,
  },
  correctionPolicy: {
    maxTcmCount: 3,
    predictedMissThresholdKm: 25000,
    positionDeviationThresholdKm: 5000,
    velocityDeviationThresholdKmPerS: 0.05,
    checkpointStepSeconds: 432000,
    maxCorrectionDeltaVKmPerS: 0.03,
  },
};

function isoEpochToDateInputValue(epoch: string): string {
  return epoch.includes("T") ? epoch.slice(0, 10) : epoch;
}

function dateInputValueToIsoEpoch(value: string): string {
  return value ? `${value}T00:00:00Z` : value;
}

export default function MissionForm({ onSubmit, language, loading, launchWindowResult = null }: MissionFormProps) {
  const [selectedBodies, setSelectedBodies] = useState<Exclude<BodyId, "earth">[]>(["mars"]);
  const [trajectoryRequest, setTrajectoryRequest] = useState<MissionRequest>(defaultTrajectoryRequest);
  const [propulsionConfig, setPropulsionConfig] = useState<PropulsionConfig | null>(null);
  const [navigationConfig, setNavigationConfig] = useState<NavigationConfig | null>(null);
  const [launchPlanningMode, setLaunchPlanningMode] = useState<LaunchPlanningMode>("recommendedWindow");
  const [selectedWindowLaunchEpoch, setSelectedWindowLaunchEpoch] = useState("");
  const copy = t(language);
  const isSingleDestination = selectedBodies.length <= 1;
  const trajectoryMode = trajectoryRequest.initialState.launchFromBody ? "autoTransfer" : "stateVector";

  useEffect(() => {
    if (launchWindowResult?.recommendedLaunchEpoch) {
      setSelectedWindowLaunchEpoch((current) => current || launchWindowResult.recommendedLaunchEpoch);
    }
  }, [launchWindowResult]);

  function updateLaunchEpoch(value: string) {
    setTrajectoryRequest((current) => ({ ...current, launchEpoch: dateInputValueToIsoEpoch(value) }));
  }

  function toggleVisitBody(bodyId: Exclude<BodyId, "earth">) {
    setSelectedBodies((current) => {
      if (current.includes(bodyId)) {
        return current.filter((body) => body !== bodyId);
      }
      return [...current, bodyId];
    });
  }

  function updatePosition(index: 0 | 1 | 2, value: number) {
    setTrajectoryRequest((current) => {
      const currentStateVector = current.initialState.stateVector ?? {
        positionKm: [149597870.7, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 29.78, 0] as [number, number, number],
      };
      const next = [...currentStateVector.positionKm] as [number, number, number];
      next[index] = value;
      return {
        ...current,
        initialState: {
          stateVector: {
            ...currentStateVector,
            positionKm: next,
          },
        },
      };
    });
  }

  function updateVelocity(index: 0 | 1 | 2, value: number) {
    setTrajectoryRequest((current) => {
      const currentStateVector = current.initialState.stateVector ?? {
        positionKm: [149597870.7, 0, 0] as [number, number, number],
        velocityKmPerSec: [0, 29.78, 0] as [number, number, number],
      };
      const next = [...currentStateVector.velocityKmPerSec] as [number, number, number];
      next[index] = value;
      return {
        ...current,
        initialState: {
          stateVector: {
            ...currentStateVector,
            velocityKmPerSec: next,
          },
        },
      };
    });
  }

  function setTrajectoryMode(mode: "autoTransfer" | "stateVector") {
    setTrajectoryRequest((current) => {
      if (mode === "autoTransfer") {
        return {
          ...current,
          durationSeconds: undefined,
          outputStepSeconds: undefined,
          initialState: {
            launchFromBody: {
              mode: "autoTransfer",
            },
          },
        };
      }

      return {
        ...current,
        durationSeconds: current.durationSeconds ?? 259200,
        outputStepSeconds: current.outputStepSeconds ?? 21600,
        initialState: {
          stateVector:
            current.initialState.stateVector ?? {
              positionKm: [149597870.7, 0, 0],
              velocityKmPerSec: [0, 29.78, 0],
            },
        },
      };
    });
  }

  function togglePropulsion(enabled: boolean) {
    setPropulsionConfig(enabled ? propulsionConfig ?? defaultPropulsionConfig : null);
  }

  function updatePropulsion<K extends keyof PropulsionConfig>(key: K, value: number) {
    setPropulsionConfig({
      ...(propulsionConfig ?? defaultPropulsionConfig),
      [key]: value,
    });
  }

  function toggleNavigation(enabled: boolean) {
    setNavigationConfig(enabled ? navigationConfig ?? defaultNavigationConfig : null);
  }

  function updateNavigationSeed(value: string) {
    setNavigationConfig({
      ...(navigationConfig ?? defaultNavigationConfig),
      randomSeed: value === "" ? null : Number(value),
    });
  }

  function updateNavigationInjection<K extends keyof NavigationConfig["injectionDispersion"]>(key: K, value: number) {
    setNavigationConfig({
      ...(navigationConfig ?? defaultNavigationConfig),
      injectionDispersion: {
        ...(navigationConfig ?? defaultNavigationConfig).injectionDispersion,
        [key]: value,
      },
    });
  }

  function updateNavigationPolicy<K extends keyof NavigationConfig["correctionPolicy"]>(key: K, value: number) {
    setNavigationConfig({
      ...(navigationConfig ?? defaultNavigationConfig),
      correctionPolicy: {
        ...(navigationConfig ?? defaultNavigationConfig).correctionPolicy,
        [key]: value,
      },
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedBodies.length === 0) {
      return;
    }

    const launchPlanning: MissionLaunchPlanning = {
      mode: launchPlanningMode,
      earliestLaunchEpoch: trajectoryRequest.launchEpoch,
      selectedLaunchEpoch:
        launchPlanningMode === "windowSelect"
          ? selectedWindowLaunchEpoch || launchWindowResult?.recommendedLaunchEpoch || trajectoryRequest.launchEpoch
          : null,
    };

    if (selectedBodies.length === 1) {
      await onSubmit({
        kind: "trajectory",
        request: {
          ...trajectoryRequest,
          targetBody: selectedBodies[0],
          propulsionConfig: propulsionConfig ?? undefined,
          navigationConfig: navigationConfig ?? undefined,
        },
        launchPlanning,
      });
      return;
    }

    await onSubmit({
      kind: "tour",
      request: {
        departureBody: "earth",
        requiredVisitBodies: selectedBodies,
        launchEpoch: trajectoryRequest.launchEpoch,
        propulsionConfig: propulsionConfig ?? undefined,
        navigationConfig: navigationConfig ?? undefined,
        ...defaultPlannerOptions,
      },
      launchPlanning,
    });
  }

  return (
    <form className="mission-form" onSubmit={handleSubmit}>
      <fieldset className="mission-form__fieldset">
        <legend>{copy.missionInput}</legend>

        <div className="mission-form__group">
          <div className="mission-form__group-header">
            <h3>{copy.missionSetup}</h3>
          </div>

          <div className="mission-form__grid mission-form__grid--two">
            <label className="mission-field">
              <span>{copy.departureBody}</span>
              <input name="departureBody" value={planetLabel(language, "earth")} readOnly />
            </label>

            <label className="mission-field">
              <span>{launchPlanningMode === "manual" ? copy.launchEpoch : copy.earliestLaunchEpoch}</span>
              <input
                aria-label={launchPlanningMode === "manual" ? copy.launchEpoch : copy.earliestLaunchEpoch}
                type="date"
                value={isoEpochToDateInputValue(trajectoryRequest.launchEpoch)}
                disabled={loading}
                onChange={(event) => updateLaunchEpoch(event.target.value)}
              />
            </label>
          </div>

          <div className="mission-form__grid mission-form__grid--two">
            <label className="mission-field">
              <span>{copy.launchPlanningMode}</span>
              <select
                aria-label={copy.launchPlanningMode}
                value={launchPlanningMode}
                disabled={loading}
                onChange={(event) => setLaunchPlanningMode(event.target.value as LaunchPlanningMode)}
              >
                <option value="recommendedWindow">{copy.recommendedWindowMode}</option>
                <option value="windowSelect">{copy.windowSelectMode}</option>
                <option value="manual">{copy.manualLaunchMode}</option>
              </select>
            </label>

            {launchPlanningMode === "windowSelect" ? (
              <label className="mission-field">
                <span>{copy.selectedLaunchEpoch}</span>
                <input
                  aria-label={copy.selectedLaunchEpoch}
                  value={selectedWindowLaunchEpoch}
                  disabled={loading}
                  onChange={(event) => setSelectedWindowLaunchEpoch(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          {launchWindowResult && launchPlanningMode !== "manual" ? (
            <div className="summary-card summary-card--placeholder">
              <p className="summary-card__eyebrow">{copy.recommendedLaunchWindow}</p>
              <p>{`${copy.recommendedLaunchWindow}: ${launchWindowResult.windowStartEpoch} -> ${launchWindowResult.windowEndEpoch}`}</p>
              <p>{`${copy.recommendedLaunchDate}: ${launchWindowResult.recommendedLaunchEpoch}`}</p>
              <p>{`${copy.launchWindowCandidates}: ${launchWindowResult.candidateLaunches.length}`}</p>
            </div>
          ) : null}

          <div className="summary-card summary-card--placeholder">
            <p className="summary-card__eyebrow">{copy.visitPlanets}</p>
            <p className="mission-form__hint">{copy.visitPlanetsHint}</p>
            <div className="mission-chip-list mission-chip-list--selectable">
              {visitPlanets.map((planet) => {
                const checked = selectedBodies.includes(planet);
                return (
                  <label
                    key={planet}
                    className={`mission-choice-chip ${checked ? "mission-choice-chip--active" : ""}`}
                  >
                    <input
                      className="mission-choice-chip__input"
                      type="checkbox"
                      aria-label={planetLabel(language, planet)}
                      checked={checked}
                      disabled={loading}
                      onChange={() => toggleVisitBody(planet)}
                    />
                    <span>{planetLabel(language, planet)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {isSingleDestination ? (
            <>
              <div className="mission-form__grid mission-form__grid--two">
                <label className="mission-field">
                  <span>{copy.trajectoryMode}</span>
                  <select
                    aria-label={copy.trajectoryMode}
                    value={trajectoryMode}
                    disabled={loading}
                    onChange={(event) => setTrajectoryMode(event.target.value as "autoTransfer" | "stateVector")}
                  >
                    <option value="autoTransfer">{copy.autoTransfer}</option>
                    <option value="stateVector">{copy.stateVector}</option>
                  </select>
                </label>
              </div>

              {trajectoryMode === "stateVector" ? (
                <div className="mission-form__grid mission-form__grid--two">
                  <label className="mission-field">
                    <span>{copy.missionDuration}</span>
                    <input
                      aria-label={copy.missionDuration}
                      type="number"
                      disabled={loading}
                      value={trajectoryRequest.durationSeconds ?? 259200}
                      onChange={(event) =>
                        setTrajectoryRequest((current) => ({ ...current, durationSeconds: Number(event.target.value) }))
                      }
                    />
                  </label>

                  <label className="mission-field">
                    <span>{copy.outputStep}</span>
                    <input
                      aria-label={copy.outputStep}
                      type="number"
                      disabled={loading}
                      value={trajectoryRequest.outputStepSeconds ?? 21600}
                      onChange={(event) =>
                        setTrajectoryRequest((current) => ({
                          ...current,
                          outputStepSeconds: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="summary-card summary-card--placeholder">
            <p className="summary-card__eyebrow">{copy.navigationDispersionSettings}</p>
            <label className="mission-field mission-field--checkbox">
              <span>{copy.enableNavigationDispersion}</span>
              <input
                aria-label={copy.enableNavigationDispersion}
                type="checkbox"
                checked={navigationConfig != null}
                disabled={loading}
                onChange={(event) => toggleNavigation(event.target.checked)}
              />
            </label>
            {navigationConfig ? (
              <div className="mission-form__grid mission-form__grid--two">
                <label className="mission-field">
                  <span>{copy.fixedRandomSeed}</span>
                  <input
                    aria-label={copy.fixedRandomSeed}
                    type="number"
                    value={navigationConfig.randomSeed ?? ""}
                    disabled={loading}
                    onChange={(event) => updateNavigationSeed(event.target.value)}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.positionSigmaKm}</span>
                  <input
                    aria-label={copy.positionSigmaKm}
                    type="number"
                    value={navigationConfig.injectionDispersion.positionSigmaKm}
                    disabled={loading}
                    onChange={(event) => updateNavigationInjection("positionSigmaKm", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.velocitySigmaKmPerS}</span>
                  <input
                    aria-label={copy.velocitySigmaKmPerS}
                    type="number"
                    step="0.001"
                    value={navigationConfig.injectionDispersion.velocitySigmaKmPerS}
                    disabled={loading}
                    onChange={(event) => updateNavigationInjection("velocitySigmaKmPerS", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.maxTcmCount}</span>
                  <input
                    aria-label={copy.maxTcmCount}
                    type="number"
                    value={navigationConfig.correctionPolicy.maxTcmCount}
                    disabled={loading}
                    onChange={(event) => updateNavigationPolicy("maxTcmCount", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.predictedMissThresholdKm}</span>
                  <input
                    aria-label={copy.predictedMissThresholdKm}
                    type="number"
                    value={navigationConfig.correctionPolicy.predictedMissThresholdKm}
                    disabled={loading}
                    onChange={(event) => updateNavigationPolicy("predictedMissThresholdKm", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.positionDeviationThresholdKm}</span>
                  <input
                    aria-label={copy.positionDeviationThresholdKm}
                    type="number"
                    value={navigationConfig.correctionPolicy.positionDeviationThresholdKm}
                    disabled={loading}
                    onChange={(event) => updateNavigationPolicy("positionDeviationThresholdKm", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.velocityDeviationThresholdKmPerS}</span>
                  <input
                    aria-label={copy.velocityDeviationThresholdKmPerS}
                    type="number"
                    step="0.001"
                    value={navigationConfig.correctionPolicy.velocityDeviationThresholdKmPerS}
                    disabled={loading}
                    onChange={(event) =>
                      updateNavigationPolicy("velocityDeviationThresholdKmPerS", Number(event.target.value))
                    }
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.checkpointStepSeconds}</span>
                  <input
                    aria-label={copy.checkpointStepSeconds}
                    type="number"
                    value={navigationConfig.correctionPolicy.checkpointStepSeconds}
                    disabled={loading}
                    onChange={(event) => updateNavigationPolicy("checkpointStepSeconds", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.maxCorrectionDeltaV}</span>
                  <input
                    aria-label={copy.maxCorrectionDeltaV}
                    type="number"
                    step="0.001"
                    value={navigationConfig.correctionPolicy.maxCorrectionDeltaVKmPerS}
                    disabled={loading}
                    onChange={(event) => updateNavigationPolicy("maxCorrectionDeltaVKmPerS", Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="summary-card summary-card--placeholder">
            <p className="summary-card__eyebrow">{copy.propulsionSettings}</p>
            <label className="mission-field mission-field--checkbox">
              <span>{copy.enableFiniteThrust}</span>
              <input
                aria-label={copy.enableFiniteThrust}
                type="checkbox"
                checked={propulsionConfig != null}
                disabled={loading}
                onChange={(event) => togglePropulsion(event.target.checked)}
              />
            </label>
            {propulsionConfig ? (
              <div className="mission-form__grid mission-form__grid--two">
                <label className="mission-field">
                  <span>{copy.initialMass}</span>
                  <input
                    aria-label={copy.initialMass}
                    type="number"
                    value={propulsionConfig.initialMassKg}
                    disabled={loading}
                    onChange={(event) => updatePropulsion("initialMassKg", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.propellantMass}</span>
                  <input
                    aria-label={copy.propellantMass}
                    type="number"
                    value={propulsionConfig.propellantMassKg}
                    disabled={loading}
                    onChange={(event) => updatePropulsion("propellantMassKg", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.maxThrust}</span>
                  <input
                    aria-label={copy.maxThrust}
                    type="number"
                    step="0.1"
                    value={propulsionConfig.maxThrustN}
                    disabled={loading}
                    onChange={(event) => updatePropulsion("maxThrustN", Number(event.target.value))}
                  />
                </label>
                <label className="mission-field">
                  <span>{copy.ispSeconds}</span>
                  <input
                    aria-label={copy.ispSeconds}
                    type="number"
                    value={propulsionConfig.ispSeconds}
                    disabled={loading}
                    onChange={(event) => updatePropulsion("ispSeconds", Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {isSingleDestination && trajectoryMode === "stateVector" ? (
          <div className="mission-form__group">
            <div className="mission-form__group-header">
              <h3>{copy.initialStateVector}</h3>
            </div>

            <div className="mission-form__grid mission-form__grid--three">
              <label className="mission-field">
                <span>{copy.positionX}</span>
                <input
                  aria-label={copy.positionX}
                  type="number"
                  disabled={loading}
                  value={trajectoryRequest.initialState.stateVector?.positionKm[0] ?? 149597870.7}
                  onChange={(event) => updatePosition(0, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.positionY}</span>
                <input
                  aria-label={copy.positionY}
                  type="number"
                  disabled={loading}
                  value={trajectoryRequest.initialState.stateVector?.positionKm[1] ?? 0}
                  onChange={(event) => updatePosition(1, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.positionZ}</span>
                <input
                  aria-label={copy.positionZ}
                  type="number"
                  disabled={loading}
                  value={trajectoryRequest.initialState.stateVector?.positionKm[2] ?? 0}
                  onChange={(event) => updatePosition(2, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.velocityX}</span>
                <input
                  aria-label={copy.velocityX}
                  type="number"
                  disabled={loading}
                  value={trajectoryRequest.initialState.stateVector?.velocityKmPerSec[0] ?? 0}
                  onChange={(event) => updateVelocity(0, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.velocityY}</span>
                <input
                  aria-label={copy.velocityY}
                  type="number"
                  disabled={loading}
                  value={trajectoryRequest.initialState.stateVector?.velocityKmPerSec[1] ?? 29.78}
                  onChange={(event) => updateVelocity(1, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.velocityZ}</span>
                <input
                  aria-label={copy.velocityZ}
                  type="number"
                  disabled={loading}
                  value={trajectoryRequest.initialState.stateVector?.velocityKmPerSec[2] ?? 0}
                  onChange={(event) => updateVelocity(2, Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        ) : null}

        <button className="mission-submit-button" type="submit" disabled={loading || selectedBodies.length === 0}>
          {loading ? (
            <>
              <span className="mission-submit-button__spinner" data-testid="mission-submit-spinner" aria-hidden="true" />
              {copy.propagateTrajectoryLoading}
            </>
          ) : (
            copy.propagateTrajectory
          )}
        </button>
      </fieldset>
    </form>
  );
}
