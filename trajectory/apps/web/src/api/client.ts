export type BodyOption = {
  id: string;
  name: string;
  horizonsId?: string;
  radiusKm?: number;
  colorHex?: string;
};

export type SpacecraftSample = {
  timestamp: number;
  positionKm: number[];
};

export type MissionCandidate = {
  id: string;
  summary: {
    label: string;
    totalDurationDays: number;
    totalDeltaV: number;
    score?: number;
  };
  legs?: Array<Record<string, unknown>>;
  samples?: {
    spacecraft: SpacecraftSample[];
  };
  warnings?: string[];
};

export type SolveMissionResponse = {
  candidates: MissionCandidate[];
  warnings: string[];
  fidelity: {
    ephemeris: string;
    transfer: string;
    flyby: string;
  };
  relevantBodies?: string[];
  bodySamples?: Record<string, SpacecraftSample[]>;
};

export type MissionSolveInput = {
  targets: string[];
  launch_window_start: string;
  launch_window_end: string;
  max_duration_days: number;
  min_leg_duration_days: number;
  max_leg_duration_days: number;
  time_weight: number;
  allow_gravity_assists: boolean;
  flyby_altitude_multiplier: number;
};

function toAbsoluteUrl(path: string) {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  return new URL(path, origin).toString();
}

function mapCandidate(candidate: any): MissionCandidate {
  return {
    id: candidate.id,
    summary: {
      label: candidate.summary.label,
      totalDurationDays: candidate.summary.total_duration_days ?? candidate.summary.totalDurationDays,
      totalDeltaV: candidate.summary.total_delta_v ?? candidate.summary.totalDeltaV,
      score: candidate.summary.score
    },
    legs: candidate.legs ?? [],
    samples: {
      spacecraft: candidate.samples?.spacecraft ?? []
    },
    warnings: candidate.warnings ?? []
  };
}

export const apiClient = {
  async getBodies(): Promise<{ bodies: BodyOption[] }> {
    const response = await fetch(toAbsoluteUrl("/api/bodies"));
    const payload = await response.json();
    return {
      bodies: (payload.bodies ?? []).map((body: any) => ({
        id: body.id,
        name: body.name,
        horizonsId: body.horizons_id,
        radiusKm: body.radius_km,
        colorHex: body.color_hex
      }))
    };
  },

  async solveMission(input: MissionSolveInput): Promise<SolveMissionResponse> {
    const response = await fetch(toAbsoluteUrl("/api/missions/solve"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const payload = await response.json();
    return {
      candidates: (payload.candidates ?? []).map(mapCandidate),
      warnings: payload.warnings ?? [],
      fidelity: payload.fidelity ?? {
        ephemeris: "unknown",
        transfer: "unknown",
        flyby: "unknown"
      },
      relevantBodies: payload.relevantBodies ?? [],
      bodySamples: payload.bodySamples ?? {}
    };
  }
};
