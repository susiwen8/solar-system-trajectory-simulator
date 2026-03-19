import type {
  EphemerisBodiesResponse,
  MissionRequest,
  MissionTourRequest,
  TrajectoryResult
} from "../features/mission/types";

export function createApiUrl(path: string, baseUrl = import.meta.env.VITE_API_BASE_URL ?? ""): string {
  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

export async function propagateMission(request: MissionRequest): Promise<TrajectoryResult> {
  const response = await fetch(createApiUrl("/missions/propagate"), {
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

export async function fetchEphemerisBodies(epoch: string): Promise<EphemerisBodiesResponse> {
  const response = await fetch(createApiUrl(`/ephemeris/bodies?epoch=${encodeURIComponent(epoch)}`));
  if (!response.ok) {
    throw new Error(`Ephemeris request failed with status ${response.status}`);
  }

  return (await response.json()) as EphemerisBodiesResponse;
}

export async function planMissionTour(request: MissionTourRequest): Promise<TrajectoryResult> {
  const response = await fetch(createApiUrl("/missions/plan-tour"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Tour planning request failed with status ${response.status}`);
  }

  return (await response.json()) as TrajectoryResult;
}
