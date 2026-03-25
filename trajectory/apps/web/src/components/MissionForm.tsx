import { useMemo, useState } from "react";

import type { BodyOption, MissionSolveInput } from "../api/client";

type MissionFormProps = {
  bodies: BodyOption[];
  isLoading: boolean;
  onSolve: (input: MissionSolveInput) => void;
};

export function MissionForm({ bodies, isLoading, onSolve }: MissionFormProps) {
  const targetOptions = useMemo(
    () => bodies.filter((body) => body.id !== "earth"),
    [bodies]
  );
  const [firstTarget, setFirstTarget] = useState("mars");
  const [secondTarget, setSecondTarget] = useState("jupiter");

  return (
    <form
      className="panel-card mission-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSolve({
          targets: [firstTarget, secondTarget].filter(Boolean),
          launch_window_start: "2030-01-01T00:00:00Z",
          launch_window_end: "2030-03-01T00:00:00Z",
          max_duration_days: 3000,
          min_leg_duration_days: 90,
          max_leg_duration_days: 1200,
          time_weight: 0.6,
          allow_gravity_assists: true,
          flyby_altitude_multiplier: 2
        });
      }}
    >
      <h2>Mission Planner</h2>
      <label>
        First target
        <select
          aria-label="First target"
          value={firstTarget}
          onChange={(event) => setFirstTarget(event.target.value)}
        >
          {targetOptions.map((body) => (
            <option key={body.id} value={body.id}>
              {body.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Second target
        <select
          aria-label="Second target"
          value={secondTarget}
          onChange={(event) => setSecondTarget(event.target.value)}
        >
          <option value="">None</option>
          {targetOptions.map((body) => (
            <option key={body.id} value={body.id}>
              {body.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Solving..." : "Solve Trajectory"}
      </button>
    </form>
  );
}

