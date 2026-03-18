import { useState } from "react";

import type { MissionRequest } from "../types";

type MissionFormProps = {
  onSubmit: (request: MissionRequest) => void | Promise<void>;
};

const targetPlanets = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"] as const;

const defaultRequest: MissionRequest = {
  departureBody: "earth",
  targetBody: "mars",
  launchEpoch: "2026-01-01T00:00:00Z",
  initialState: {
    stateVector: {
      positionKm: [149597870.7, 0, 0],
      velocityKmPerSec: [0, 29.78, 0]
    }
  },
  durationSeconds: 259200,
  outputStepSeconds: 21600
};

export default function MissionForm({ onSubmit }: MissionFormProps) {
  const [request, setRequest] = useState<MissionRequest>(defaultRequest);

  function updatePosition(index: 0 | 1 | 2, value: number) {
    setRequest((current) => {
      const next = [...current.initialState.stateVector.positionKm] as [number, number, number];
      next[index] = value;
      return {
        ...current,
        initialState: {
          stateVector: {
            ...current.initialState.stateVector,
            positionKm: next
          }
        }
      };
    });
  }

  function updateVelocity(index: 0 | 1 | 2, value: number) {
    setRequest((current) => {
      const next = [...current.initialState.stateVector.velocityKmPerSec] as [number, number, number];
      next[index] = value;
      return {
        ...current,
        initialState: {
          stateVector: {
            ...current.initialState.stateVector,
            velocityKmPerSec: next
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
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>Mission Input</legend>

        <label>
          Departure Body
          <input name="departureBody" value="earth" readOnly />
        </label>

        <label>
          Target Planet
          <select
            aria-label="Target Planet"
            value={request.targetBody}
            onChange={(event) =>
              setRequest((current) => ({ ...current, targetBody: event.target.value as MissionRequest["targetBody"] }))
            }
          >
            {targetPlanets.map((planet) => (
              <option key={planet} value={planet}>
                {planet}
              </option>
            ))}
          </select>
        </label>

        <label>
          Launch Epoch
          <input
            aria-label="Launch Epoch"
            value={request.launchEpoch}
            onChange={(event) => setRequest((current) => ({ ...current, launchEpoch: event.target.value }))}
          />
        </label>

        <label>
          Mission Duration (s)
          <input
            aria-label="Mission Duration (s)"
            type="number"
            value={request.durationSeconds}
            onChange={(event) =>
              setRequest((current) => ({ ...current, durationSeconds: Number(event.target.value) }))
            }
          />
        </label>

        <label>
          Output Step (s)
          <input
            aria-label="Output Step (s)"
            type="number"
            value={request.outputStepSeconds}
            onChange={(event) =>
              setRequest((current) => ({ ...current, outputStepSeconds: Number(event.target.value) }))
            }
          />
        </label>

        <label>
          Position X (km)
          <input
            aria-label="Position X (km)"
            type="number"
            value={request.initialState.stateVector.positionKm[0]}
            onChange={(event) => updatePosition(0, Number(event.target.value))}
          />
        </label>

        <label>
          Position Y (km)
          <input
            aria-label="Position Y (km)"
            type="number"
            value={request.initialState.stateVector.positionKm[1]}
            onChange={(event) => updatePosition(1, Number(event.target.value))}
          />
        </label>

        <label>
          Position Z (km)
          <input
            aria-label="Position Z (km)"
            type="number"
            value={request.initialState.stateVector.positionKm[2]}
            onChange={(event) => updatePosition(2, Number(event.target.value))}
          />
        </label>

        <label>
          Velocity X (km/s)
          <input
            aria-label="Velocity X (km/s)"
            type="number"
            value={request.initialState.stateVector.velocityKmPerSec[0]}
            onChange={(event) => updateVelocity(0, Number(event.target.value))}
          />
        </label>

        <label>
          Velocity Y (km/s)
          <input
            aria-label="Velocity Y (km/s)"
            type="number"
            value={request.initialState.stateVector.velocityKmPerSec[1]}
            onChange={(event) => updateVelocity(1, Number(event.target.value))}
          />
        </label>

        <label>
          Velocity Z (km/s)
          <input
            aria-label="Velocity Z (km/s)"
            type="number"
            value={request.initialState.stateVector.velocityKmPerSec[2]}
            onChange={(event) => updateVelocity(2, Number(event.target.value))}
          />
        </label>

        <button type="submit">Propagate Trajectory</button>
      </fieldset>
    </form>
  );
}
