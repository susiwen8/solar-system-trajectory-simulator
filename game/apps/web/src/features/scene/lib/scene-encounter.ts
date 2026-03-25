const ARRIVAL_SEGMENT_TYPES = new Set([
  "arrivalHyperbolicApproach",
  "orbitInsertionBurn",
  "parkingOrbit",
  "arrivalCapture",
  "scienceOrbit",
]);

export function shouldUseEncounterDisplayAdjustment(segmentType: string | null | undefined) {
  if (!segmentType) {
    return false;
  }

  return ARRIVAL_SEGMENT_TYPES.has(segmentType);
}
