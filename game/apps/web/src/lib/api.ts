import type { MissionRequest, TrajectoryResult } from "../features/mission/types";

export async function propagateMission(request: MissionRequest): Promise<TrajectoryResult> {
  const response = await fetch("/missions/propagate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Propagation request failed with status ${response.status}`);
  }

  return (await response.json()) as TrajectoryResult;
}
