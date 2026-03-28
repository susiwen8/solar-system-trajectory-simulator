import type { BodyOption, MissionCandidate } from "../api/client";

type CameraMode = "overview" | "first_person";

type MissionStoreState = {
  bodies: BodyOption[];
  bodySamples: Record<string, { timestamp: number; positionKm: number[] }[]>;
  candidates: MissionCandidate[];
  selectedCandidateId: string | null;
  playback: {
    currentTimeSeconds: number;
    speed: number;
    isPaused: boolean;
  };
  cameraMode: CameraMode;
  fidelity: {
    ephemeris: string;
    transfer: string;
    flyby: string;
  } | null;
  warnings: string[];
};

type Listener = () => void;

function getRecommendedCandidateId(candidates: MissionCandidate[]): string | null {
  const recommended = candidates.find((candidate) => candidate.summary.label === "recommended");
  return recommended?.id ?? candidates[0]?.id ?? null;
}

export function createMissionStore() {
  let state: MissionStoreState = {
    bodies: [],
    bodySamples: {},
    candidates: [],
    selectedCandidateId: null,
    playback: {
      currentTimeSeconds: 0,
      speed: 1,
      isPaused: false
    },
    cameraMode: "overview",
    fidelity: null,
    warnings: []
  };
  const listeners = new Set<Listener>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() {
      return state;
    },

    setBodies(bodies: BodyOption[]) {
      state = { ...state, bodies };
      emit();
    },

    setBodySamples(
      bodySamples: Record<string, { timestamp: number; positionKm: number[] }[]>
    ) {
      state = { ...state, bodySamples };
      emit();
    },

    setFidelity(fidelity: MissionStoreState["fidelity"]) {
      state = { ...state, fidelity };
      emit();
    },

    setWarnings(warnings: string[]) {
      state = { ...state, warnings };
      emit();
    },

    setCandidates(candidates: MissionCandidate[]) {
      state = {
        ...state,
        candidates,
        selectedCandidateId: getRecommendedCandidateId(candidates),
        playback: { ...state.playback, currentTimeSeconds: 0 },
        cameraMode: "overview"
      };
      emit();
    },

    selectCandidate(candidateId: string) {
      state = {
        ...state,
        selectedCandidateId: candidateId,
        playback: { ...state.playback, currentTimeSeconds: 0 },
        cameraMode: "overview"
      };
      emit();
    },

    setCameraMode(cameraMode: CameraMode) {
      state = { ...state, cameraMode };
      emit();
    },

    setPlaybackSpeed(speed: number) {
      state = { ...state, playback: { ...state.playback, speed } };
      emit();
    },

    togglePaused() {
      state = {
        ...state,
        playback: { ...state.playback, isPaused: !state.playback.isPaused }
      };
      emit();
    },

    tick(deltaSeconds: number) {
      if (state.playback.isPaused) {
        return;
      }
      state = {
        ...state,
        playback: {
          ...state.playback,
          currentTimeSeconds:
            state.playback.currentTimeSeconds + deltaSeconds * state.playback.speed
        }
      };
      emit();
    }
  };
}

export type { CameraMode, MissionStoreState };
