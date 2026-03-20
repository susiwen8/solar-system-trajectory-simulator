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

export function sceneBodyRadiusFromPhysicalKm(radiusKm: number): number {
  return Math.max(0.9, Math.pow(radiusKm, 0.38) / 3.2);
}

export function sceneProbeScaleFromMeters(spanMeters: number): number {
  return Math.max(0.03, spanMeters / 320);
}
