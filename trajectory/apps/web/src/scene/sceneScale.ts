const KM_PER_WORLD_UNIT = 20_000_000;

export function kmToWorldUnits(km: number) {
  return km / KM_PER_WORLD_UNIT;
}

export function haloRadiusForBody(bodyRadiusWorldUnits: number) {
  return Math.max(bodyRadiusWorldUnits * 1.8, 0.08);
}

