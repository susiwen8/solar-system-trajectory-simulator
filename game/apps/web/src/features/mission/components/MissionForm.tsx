import { useMemo, useState } from "react";

import { planetLabel, t, type Language } from "../../../lib/i18n";
import type { BodyId, MissionRequest, MissionTourRequest, PropulsionConfig } from "../types";

export type MissionSubmission =
  | {
      kind: "trajectory";
      request: MissionRequest;
    }
  | {
      kind: "tour";
      request: MissionTourRequest;
    };

type MissionFormProps = {
  onSubmit: (submission: MissionSubmission) => void | Promise<void>;
  language: Language;
  loading: boolean;
};

const targetPlanets = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"] as const;
const visitPlanets = targetPlanets.filter((planet) => planet !== "earth") as Exclude<BodyId, "earth">[];

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
      mode: "autoTransfer"
    }
  }
};

const defaultTourRequest: MissionTourRequest = {
  departureBody: "earth",
  requiredVisitBodies: ["venus", "jupiter", "saturn"],
  launchEpoch: "2026-01-01T00:00:00Z",
  maxAssistBodiesPerLeg: 2,
  maxReturnedCandidates: 5,
  allowAssistBodies: true,
  allowRepeatedFlybys: true,
};

const defaultPropulsionConfig: PropulsionConfig = {
  initialMassKg: 1800,
  propellantMassKg: 420,
  maxThrustN: 0.8,
  ispSeconds: 3200,
};

export default function MissionForm({ onSubmit, language, loading }: MissionFormProps) {
  const [missionType, setMissionType] = useState<"trajectory" | "tour">("trajectory");
  const [trajectoryRequest, setTrajectoryRequest] = useState<MissionRequest>(defaultTrajectoryRequest);
  const [tourRequest, setTourRequest] = useState<MissionTourRequest>(defaultTourRequest);
  const [pendingVisitBody, setPendingVisitBody] = useState<Exclude<BodyId, "earth">>("mars");
  const copy = t(language);
  const trajectoryMode = trajectoryRequest.initialState.launchFromBody ? "autoTransfer" : "stateVector";

  const availableVisitBodies = useMemo(
    () => visitPlanets.filter((planet) => !tourRequest.requiredVisitBodies.includes(planet)),
    [tourRequest.requiredVisitBodies],
  );

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
            positionKm: next
          }
        }
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
            velocityKmPerSec: next
          }
        }
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
              mode: "autoTransfer"
            }
          }
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
              velocityKmPerSec: [0, 29.78, 0]
            }
        }
      };
    });
  }

  function addVisitBody() {
    if (!availableVisitBodies.includes(pendingVisitBody)) {
      return;
    }

    setTourRequest((current) => ({
      ...current,
      requiredVisitBodies: [...current.requiredVisitBodies, pendingVisitBody],
    }));

    const nextBody = availableVisitBodies.find((planet) => planet !== pendingVisitBody);
    if (nextBody) {
      setPendingVisitBody(nextBody);
    }
  }

  function removeVisitBody(bodyId: Exclude<BodyId, "earth">) {
    setTourRequest((current) => ({
      ...current,
      requiredVisitBodies: current.requiredVisitBodies.filter((planet) => planet !== bodyId),
    }));
    setPendingVisitBody(bodyId);
  }

  function toggleTrajectoryPropulsion(enabled: boolean) {
    setTrajectoryRequest((current) => ({
      ...current,
      propulsionConfig: enabled ? current.propulsionConfig ?? defaultPropulsionConfig : undefined,
    }));
  }

  function toggleTourPropulsion(enabled: boolean) {
    setTourRequest((current) => ({
      ...current,
      propulsionConfig: enabled ? current.propulsionConfig ?? defaultPropulsionConfig : undefined,
    }));
  }

  function updateTrajectoryPropulsion<K extends keyof PropulsionConfig>(key: K, value: number) {
    setTrajectoryRequest((current) => ({
      ...current,
      propulsionConfig: {
        ...(current.propulsionConfig ?? defaultPropulsionConfig),
        [key]: value,
      },
    }));
  }

  function updateTourPropulsion<K extends keyof PropulsionConfig>(key: K, value: number) {
    setTourRequest((current) => ({
      ...current,
      propulsionConfig: {
        ...(current.propulsionConfig ?? defaultPropulsionConfig),
        [key]: value,
      },
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (missionType === "tour") {
      await onSubmit({
        kind: "tour",
        request: tourRequest,
      });
      return;
    }

    await onSubmit({
      kind: "trajectory",
      request: trajectoryRequest,
    });
  }

  return (
    <form className="mission-form" onSubmit={handleSubmit}>
      <fieldset className="mission-form__fieldset">
        <legend>{copy.missionInput}</legend>
        <p className="mission-form__hint">
          {missionType === "trajectory" ? copy.missionHint : copy.tourMissionHint}
        </p>

        <div className="mission-form__group">
          <div className="mission-form__group-header">
            <h3>{copy.missionSetup}</h3>
            <p>{copy.missionSetupBody}</p>
          </div>

          <div className="mission-form__grid mission-form__grid--two">
            <label className="mission-field">
              <span>{copy.missionType}</span>
              <select
                aria-label={copy.missionType}
                value={missionType}
                disabled={loading}
                onChange={(event) => setMissionType(event.target.value as "trajectory" | "tour")}
              >
                <option value="trajectory">{copy.missionTypeSingle}</option>
                <option value="tour">{copy.missionTypeTour}</option>
              </select>
            </label>

            <label className="mission-field">
              <span>{copy.departureBody}</span>
              <input name="departureBody" value={planetLabel(language, "earth")} readOnly />
            </label>
          </div>

          {missionType === "trajectory" ? (
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

                <label className="mission-field">
                  <span>{copy.targetPlanet}</span>
                  <select
                    aria-label={copy.targetPlanet}
                    value={trajectoryRequest.targetBody}
                    disabled={loading}
                    onChange={(event) =>
                      setTrajectoryRequest((current) => ({
                        ...current,
                        targetBody: event.target.value as MissionRequest["targetBody"]
                      }))
                    }
                  >
                    {targetPlanets.map((planet) => (
                      <option key={planet} value={planet}>
                        {planetLabel(language, planet)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mission-form__grid">
                <label className="mission-field">
                  <span>{copy.launchEpoch}</span>
                  <input
                    aria-label={copy.launchEpoch}
                    value={trajectoryRequest.launchEpoch}
                    disabled={loading}
                    onChange={(event) =>
                      setTrajectoryRequest((current) => ({ ...current, launchEpoch: event.target.value }))
                    }
                  />
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
                          outputStepSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="summary-card summary-card--placeholder">
                  <p className="summary-card__eyebrow">{copy.autoTransfer}</p>
                  <p>{copy.autoTransferBody}</p>
                </div>
              )}

              <div className="summary-card summary-card--placeholder">
                <p className="summary-card__eyebrow">{copy.propulsionSettings}</p>
                <p>{copy.propulsionHint}</p>
                <label className="mission-field mission-field--checkbox">
                  <span>{copy.enableFiniteThrust}</span>
                  <input
                    aria-label={copy.enableFiniteThrust}
                    type="checkbox"
                    checked={trajectoryRequest.propulsionConfig != null}
                    disabled={loading}
                    onChange={(event) => toggleTrajectoryPropulsion(event.target.checked)}
                  />
                </label>
                {trajectoryRequest.propulsionConfig ? (
                  <div className="mission-form__grid mission-form__grid--two">
                    <label className="mission-field">
                      <span>{copy.initialMass}</span>
                      <input
                        aria-label={copy.initialMass}
                        type="number"
                        value={trajectoryRequest.propulsionConfig.initialMassKg}
                        disabled={loading}
                        onChange={(event) => updateTrajectoryPropulsion("initialMassKg", Number(event.target.value))}
                      />
                    </label>
                    <label className="mission-field">
                      <span>{copy.propellantMass}</span>
                      <input
                        aria-label={copy.propellantMass}
                        type="number"
                        value={trajectoryRequest.propulsionConfig.propellantMassKg}
                        disabled={loading}
                        onChange={(event) => updateTrajectoryPropulsion("propellantMassKg", Number(event.target.value))}
                      />
                    </label>
                    <label className="mission-field">
                      <span>{copy.maxThrust}</span>
                      <input
                        aria-label={copy.maxThrust}
                        type="number"
                        step="0.1"
                        value={trajectoryRequest.propulsionConfig.maxThrustN}
                        disabled={loading}
                        onChange={(event) => updateTrajectoryPropulsion("maxThrustN", Number(event.target.value))}
                      />
                    </label>
                    <label className="mission-field">
                      <span>{copy.ispSeconds}</span>
                      <input
                        aria-label={copy.ispSeconds}
                        type="number"
                        value={trajectoryRequest.propulsionConfig.ispSeconds}
                        disabled={loading}
                        onChange={(event) => updateTrajectoryPropulsion("ispSeconds", Number(event.target.value))}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="mission-form__grid">
                <label className="mission-field">
                  <span>{copy.launchEpoch}</span>
                  <input
                    aria-label={copy.launchEpoch}
                    value={tourRequest.launchEpoch}
                    disabled={loading}
                    onChange={(event) => setTourRequest((current) => ({ ...current, launchEpoch: event.target.value }))}
                  />
                </label>
              </div>

              <div className="summary-card summary-card--placeholder">
                <p className="summary-card__eyebrow">{copy.requiredVisits}</p>
                <p>{copy.requiredVisitsBody}</p>
                <div className="mission-chip-list">
                  {tourRequest.requiredVisitBodies.map((bodyId) => (
                    <button
                      key={bodyId}
                      type="button"
                      className="mission-chip"
                      onClick={() => removeVisitBody(bodyId)}
                      disabled={loading}
                    >
                      {planetLabel(language, bodyId)}
                    </button>
                  ))}
                </div>

                <div className="mission-form__grid mission-form__grid--two">
                  <label className="mission-field">
                    <span>{copy.addVisitBody}</span>
                    <select
                      aria-label={copy.addVisitBody}
                      value={availableVisitBodies.includes(pendingVisitBody) ? pendingVisitBody : availableVisitBodies[0] ?? ""}
                      disabled={loading || availableVisitBodies.length === 0}
                      onChange={(event) => setPendingVisitBody(event.target.value as Exclude<BodyId, "earth">)}
                    >
                      {availableVisitBodies.map((planet) => (
                        <option key={planet} value={planet}>
                          {planetLabel(language, planet)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mission-field mission-field--action">
                    <span>{copy.requiredVisits}</span>
                    <button
                      type="button"
                      className="scene-action-button scene-action-button--ghost"
                      onClick={addVisitBody}
                      disabled={loading || availableVisitBodies.length === 0}
                    >
                      {copy.addVisitBody}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mission-form__grid mission-form__grid--two">
                <label className="mission-field mission-field--checkbox">
                  <span>{copy.allowAssistBodies}</span>
                  <input
                    aria-label={copy.allowAssistBodies}
                    type="checkbox"
                    checked={tourRequest.allowAssistBodies ?? true}
                    disabled={loading}
                    onChange={(event) =>
                      setTourRequest((current) => ({
                        ...current,
                        allowAssistBodies: event.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="mission-field mission-field--checkbox">
                  <span>{copy.allowRepeatedFlybys}</span>
                  <input
                    aria-label={copy.allowRepeatedFlybys}
                    type="checkbox"
                    checked={tourRequest.allowRepeatedFlybys ?? true}
                    disabled={loading}
                    onChange={(event) =>
                      setTourRequest((current) => ({
                        ...current,
                        allowRepeatedFlybys: event.target.checked,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mission-form__grid mission-form__grid--two">
                <label className="mission-field">
                  <span>{copy.maxAssistBodiesPerLeg}</span>
                  <input
                    aria-label={copy.maxAssistBodiesPerLeg}
                    type="number"
                    min={0}
                    max={2}
                    disabled={loading}
                    value={tourRequest.maxAssistBodiesPerLeg ?? 2}
                    onChange={(event) =>
                      setTourRequest((current) => ({
                        ...current,
                        maxAssistBodiesPerLeg: Number(event.target.value),
                      }))
                    }
                  />
                </label>

                <label className="mission-field">
                  <span>{copy.maxReturnedCandidates}</span>
                  <input
                    aria-label={copy.maxReturnedCandidates}
                    type="number"
                    min={1}
                    max={10}
                    disabled={loading}
                    value={tourRequest.maxReturnedCandidates ?? 5}
                    onChange={(event) =>
                      setTourRequest((current) => ({
                        ...current,
                        maxReturnedCandidates: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="summary-card summary-card--placeholder">
                <p className="summary-card__eyebrow">{copy.propulsionSettings}</p>
                <p>{copy.propulsionHint}</p>
                <label className="mission-field mission-field--checkbox">
                  <span>{copy.enableFiniteThrust}</span>
                  <input
                    aria-label={copy.enableFiniteThrust}
                    type="checkbox"
                    checked={tourRequest.propulsionConfig != null}
                    disabled={loading}
                    onChange={(event) => toggleTourPropulsion(event.target.checked)}
                  />
                </label>
                {tourRequest.propulsionConfig ? (
                  <div className="mission-form__grid mission-form__grid--two">
                    <label className="mission-field">
                      <span>{copy.initialMass}</span>
                      <input
                        aria-label={copy.initialMass}
                        type="number"
                        value={tourRequest.propulsionConfig.initialMassKg}
                        disabled={loading}
                        onChange={(event) => updateTourPropulsion("initialMassKg", Number(event.target.value))}
                      />
                    </label>
                    <label className="mission-field">
                      <span>{copy.propellantMass}</span>
                      <input
                        aria-label={copy.propellantMass}
                        type="number"
                        value={tourRequest.propulsionConfig.propellantMassKg}
                        disabled={loading}
                        onChange={(event) => updateTourPropulsion("propellantMassKg", Number(event.target.value))}
                      />
                    </label>
                    <label className="mission-field">
                      <span>{copy.maxThrust}</span>
                      <input
                        aria-label={copy.maxThrust}
                        type="number"
                        step="0.1"
                        value={tourRequest.propulsionConfig.maxThrustN}
                        disabled={loading}
                        onChange={(event) => updateTourPropulsion("maxThrustN", Number(event.target.value))}
                      />
                    </label>
                    <label className="mission-field">
                      <span>{copy.ispSeconds}</span>
                      <input
                        aria-label={copy.ispSeconds}
                        type="number"
                        value={tourRequest.propulsionConfig.ispSeconds}
                        disabled={loading}
                        onChange={(event) => updateTourPropulsion("ispSeconds", Number(event.target.value))}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {missionType === "trajectory" && trajectoryMode === "stateVector" ? (
          <div className="mission-form__group">
            <div className="mission-form__group-header">
              <h3>{copy.initialStateVector}</h3>
              <p>{copy.initialStateBody}</p>
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

        <button className="mission-submit-button" type="submit" disabled={loading}>
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
