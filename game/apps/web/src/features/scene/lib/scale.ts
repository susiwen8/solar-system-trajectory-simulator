const DISTANCE_SCALE_DIVISOR_KM = 2_500_000;
const NEAR_FIELD_LIMIT_KM = 2_000_000;
const TRANSITION_LIMIT_KM = 25_000_000;

export function scaleDistanceKm(distanceKm: number): number {
  return distanceKm / DISTANCE_SCALE_DIVISOR_KM;
}

export function scaleOverviewDistanceKm(distanceKm: number): number {
  return scaleDistanceKm(distanceKm);
}

export function compressSceneDistanceKm(distanceKm: number): number {
  const absoluteDistanceKm = Math.abs(distanceKm);
  const compressedAtTransition =
    scaleDistanceKm(NEAR_FIELD_LIMIT_KM) +
    Math.log1p(TRANSITION_LIMIT_KM - NEAR_FIELD_LIMIT_KM) / 6;

  if (absoluteDistanceKm <= NEAR_FIELD_LIMIT_KM) {
    return scaleDistanceKm(distanceKm);
  }

  if (absoluteDistanceKm <= TRANSITION_LIMIT_KM) {
    const transitionProgress =
      (absoluteDistanceKm - NEAR_FIELD_LIMIT_KM) /
      (TRANSITION_LIMIT_KM - NEAR_FIELD_LIMIT_KM);
    const linearDistance = scaleDistanceKm(absoluteDistanceKm);
    const compressedDistance =
      scaleDistanceKm(NEAR_FIELD_LIMIT_KM) +
      Math.log1p(absoluteDistanceKm - NEAR_FIELD_LIMIT_KM) / 6;

    return Math.sign(distanceKm) * (linearDistance * (1 - transitionProgress) + compressedDistance * transitionProgress);
  }

  const compressedDistance =
    compressedAtTransition +
    Math.log1p(absoluteDistanceKm - TRANSITION_LIMIT_KM) / 8;
  return Math.sign(distanceKm) * compressedDistance;
}
