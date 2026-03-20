export const BODY_PHYSICAL_RADII_KM = {
  sun: 695_700,
  mercury: 2_439.7,
  venus: 6_051.8,
  earth: 6_371,
  mars: 3_389.5,
  jupiter: 69_911,
  saturn: 58_232,
  uranus: 25_362,
  neptune: 24_622,
} as const;

export const PROBE_PHYSICAL_BASELINE_METERS = {
  busDiameter: 2.8,
  spanWidth: 13.5,
} as const;

const BODY_SCENE_RADII: Record<number, number> = {
  [BODY_PHYSICAL_RADII_KM.sun]: 7.8,
  [BODY_PHYSICAL_RADII_KM.mercury]: 2.0,
  [BODY_PHYSICAL_RADII_KM.venus]: 2.6,
  [BODY_PHYSICAL_RADII_KM.earth]: 2.8,
  [BODY_PHYSICAL_RADII_KM.mars]: 2.4,
  [BODY_PHYSICAL_RADII_KM.jupiter]: 5.1,
  [BODY_PHYSICAL_RADII_KM.saturn]: 4.6,
  [BODY_PHYSICAL_RADII_KM.uranus]: 3.8,
  [BODY_PHYSICAL_RADII_KM.neptune]: 3.7,
};

export function sceneBodyRadiusFromPhysicalKm(radiusKm: number): number {
  return BODY_SCENE_RADII[radiusKm] ?? 3.6;
}

export function sceneProbeScaleFromMeters(spanMeters: number): number {
  return spanMeters > 0 ? 0.34 : 0.34;
}
