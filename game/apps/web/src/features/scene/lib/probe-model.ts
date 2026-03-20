export const PROBE_MODEL_ALIGNMENT_YAW_RAD = Math.PI / 2;
export const PROBE_VISUAL_SCALE = 0.34;
export const PROBE_EFFECTS_SCALE = 0.44;

export function rotateProbeModelAxis([x, y, z]: [number, number, number]): [number, number, number] {
  const cos = Math.cos(PROBE_MODEL_ALIGNMENT_YAW_RAD);
  const sin = Math.sin(PROBE_MODEL_ALIGNMENT_YAW_RAD);

  return [
    normalizeZero(x * cos + z * sin),
    normalizeZero(y),
    normalizeZero(-x * sin + z * cos),
  ];
}

function normalizeZero(value: number) {
  return Math.abs(value) < 1e-9 ? 0 : value;
}
