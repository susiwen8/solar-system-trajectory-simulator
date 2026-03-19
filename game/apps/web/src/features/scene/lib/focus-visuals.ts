import type { ProbeCameraView } from "./camera";

export type FocusBodyVisualProfile = {
  atmosphereColor: string | null;
  atmosphereOpacity: number;
  haloScale: number;
  haloOpacity: number;
  bandCount: number;
  bandOpacity: number;
};

export type PlanetaryRingProfile = {
  innerScale: number;
  outerScale: number;
  opacity: number;
  color: string;
  tiltRad: number;
};

export function computeFocusBodyVisualProfile(
  bodyId: string,
  mode: ProbeCameraView["mode"],
): FocusBodyVisualProfile {
  if (bodyId === "jupiter" || bodyId === "saturn") {
    return {
      atmosphereColor: bodyId === "jupiter" ? "#f2d2a2" : "#e6d6b1",
      atmosphereOpacity: mode === "flyby-emphasis" ? 0.28 : mode === "approach-emphasis" ? 0.2 : 0.12,
      haloScale: mode === "flyby-emphasis" ? 1.34 : mode === "approach-emphasis" ? 1.2 : 1.08,
      haloOpacity: mode === "flyby-emphasis" ? 0.3 : mode === "approach-emphasis" ? 0.2 : 0.1,
      bandCount: mode === "flyby-emphasis" ? 4 : mode === "approach-emphasis" ? 3 : 0,
      bandOpacity: mode === "flyby-emphasis" ? 0.22 : mode === "approach-emphasis" ? 0.16 : 0.06,
    };
  }

  return {
    atmosphereColor: bodyId === "mars" ? "#ffb18c" : bodyId === "venus" ? "#f5d3aa" : bodyId === "earth" ? "#93d8ff" : "#b8d6ff",
    atmosphereOpacity: mode === "flyby-emphasis" ? 0.22 : mode === "approach-emphasis" ? 0.2 : 0.08,
    haloScale: mode === "flyby-emphasis" ? 1.26 : mode === "approach-emphasis" ? 1.18 : 1.08,
    haloOpacity: mode === "flyby-emphasis" ? 0.24 : mode === "approach-emphasis" ? 0.2 : 0.08,
    bandCount: 0,
    bandOpacity: 0,
  };
}

export function getPlanetaryRingProfile(bodyId: string): PlanetaryRingProfile | null {
  if (bodyId !== "saturn") {
    return null;
  }

  return {
    innerScale: 1.35,
    outerScale: 2.2,
    opacity: 0.72,
    color: "#d8c69b",
    tiltRad: 0.48,
  };
}
