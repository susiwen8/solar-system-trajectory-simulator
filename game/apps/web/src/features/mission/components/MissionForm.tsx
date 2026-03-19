import { useState } from "react";

import { planetLabel, t, type Language } from "../../../lib/i18n";
import type { MissionRequest } from "../types";

type MissionFormProps = {
  onSubmit: (request: MissionRequest) => void | Promise<void>;
  language: Language;
  loading: boolean;
};

const targetPlanets = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"] as const;

const defaultRequest: MissionRequest = {
  departureBody: "earth",
  targetBody: "mars",
  launchEpoch: "2026-01-01T00:00:00Z",
  initialState: {
    launchFromBody: {
      mode: "autoTransfer"
    }
  }
};

export default function MissionForm({ onSubmit, language, loading }: MissionFormProps) {
  const [request, setRequest] = useState<MissionRequest>(defaultRequest);
  const trajectoryMode = request.initialState.launchFromBody ? "autoTransfer" : "stateVector";
  const copy = t(language);

  function updatePosition(index: 0 | 1 | 2, value: number) {
    setRequest((current) => {
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
    setRequest((current) => {
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
    setRequest((current) => {
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(request);
  }

  return (
    <form className="mission-form" onSubmit={handleSubmit}>
      <fieldset className="mission-form__fieldset">
        <legend>{copy.missionInput}</legend>
        <p className="mission-form__hint">{copy.missionHint}</p>

        <div className="mission-form__group">
          <div className="mission-form__group-header">
            <h3>{copy.missionSetup}</h3>
            <p>{copy.missionSetupBody}</p>
          </div>

          <div className="mission-form__grid mission-form__grid--two">
            <label className="mission-field">
              <span>{copy.departureBody}</span>
              <input name="departureBody" value={planetLabel(language, "earth")} readOnly />
            </label>

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

          <div className="mission-form__grid mission-form__grid--two">
            <label className="mission-field">
              <span>{copy.targetPlanet}</span>
              <select
                aria-label={copy.targetPlanet}
                value={request.targetBody}
                disabled={loading}
                onChange={(event) =>
                  setRequest((current) => ({
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
                value={request.launchEpoch}
                disabled={loading}
                onChange={(event) => setRequest((current) => ({ ...current, launchEpoch: event.target.value }))}
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
                  value={request.durationSeconds ?? 259200}
                  onChange={(event) =>
                    setRequest((current) => ({ ...current, durationSeconds: Number(event.target.value) }))
                  }
                />
              </label>

              <label className="mission-field">
                <span>{copy.outputStep}</span>
                <input
                  aria-label={copy.outputStep}
                  type="number"
                  disabled={loading}
                  value={request.outputStepSeconds ?? 21600}
                  onChange={(event) =>
                    setRequest((current) => ({ ...current, outputStepSeconds: Number(event.target.value) }))
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
        </div>

        {trajectoryMode === "stateVector" ? (
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
                  value={request.initialState.stateVector?.positionKm[0] ?? 149597870.7}
                  onChange={(event) => updatePosition(0, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.positionY}</span>
                <input
                  aria-label={copy.positionY}
                  type="number"
                  disabled={loading}
                  value={request.initialState.stateVector?.positionKm[1] ?? 0}
                  onChange={(event) => updatePosition(1, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.positionZ}</span>
                <input
                  aria-label={copy.positionZ}
                  type="number"
                  disabled={loading}
                  value={request.initialState.stateVector?.positionKm[2] ?? 0}
                  onChange={(event) => updatePosition(2, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.velocityX}</span>
                <input
                  aria-label={copy.velocityX}
                  type="number"
                  disabled={loading}
                  value={request.initialState.stateVector?.velocityKmPerSec[0] ?? 0}
                  onChange={(event) => updateVelocity(0, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.velocityY}</span>
                <input
                  aria-label={copy.velocityY}
                  type="number"
                  disabled={loading}
                  value={request.initialState.stateVector?.velocityKmPerSec[1] ?? 29.78}
                  onChange={(event) => updateVelocity(1, Number(event.target.value))}
                />
              </label>

              <label className="mission-field">
                <span>{copy.velocityZ}</span>
                <input
                  aria-label={copy.velocityZ}
                  type="number"
                  disabled={loading}
                  value={request.initialState.stateVector?.velocityKmPerSec[2] ?? 0}
                  onChange={(event) => updateVelocity(2, Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        ) : null}

        <button className="mission-form__submit" type="submit" disabled={loading}>
          {loading ? <span className="mission-form__submit-spinner" data-testid="mission-submit-spinner" aria-hidden="true" /> : null}
          <span>{loading ? copy.propagateTrajectoryLoading : copy.propagateTrajectory}</span>
        </button>
      </fieldset>
    </form>
  );
}
