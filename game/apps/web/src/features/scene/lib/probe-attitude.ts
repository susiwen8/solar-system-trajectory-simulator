import type { ManeuverEvent, TrajectorySample } from "../../mission/types";

export function resolveProbeAttitudeDirection(
  sample: TrajectorySample,
  thrustDirection: ManeuverEvent["thrustDirection"] | null,
): [number, number, number] {
  const velocityForward = normalize(sample.velocityKmPerSec);

  if (!thrustDirection || thrustDirection === "prograde") {
    return velocityForward;
  }

  if (thrustDirection === "retrograde") {
    return invert(velocityForward);
  }

  if (thrustDirection === "radial-out") {
    return normalize(sample.positionKm);
  }

  if (thrustDirection === "radial-in") {
    const radial = normalize(sample.positionKm);
    return invert(radial);
  }

  if (thrustDirection === "normal" || thrustDirection === "antinormal") {
    const orbitalNormal = normalize(cross(sample.positionKm, sample.velocityKmPerSec));
    return thrustDirection === "normal"
      ? orbitalNormal
      : invert(orbitalNormal);
  }

  if (thrustDirection === "target-correction") {
    const correctionAxis = normalize(cross(velocityForward, [0, 0, 1]));
    return normalize([
      velocityForward[0] * 0.82 + correctionAxis[0] * 0.58,
      velocityForward[1] * 0.82 + correctionAxis[1] * 0.58,
      velocityForward[2] * 0.82 + correctionAxis[2] * 0.58,
    ]);
  }

  return velocityForward;
}

function cross(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
}

function normalize([x, y, z]: [number, number, number]): [number, number, number] {
  const magnitude = Math.hypot(x, y, z);
  if (magnitude <= 0) {
    return [1, 0, 0];
  }

  return [
    normalizeZero(x / magnitude),
    normalizeZero(y / magnitude),
    normalizeZero(z / magnitude),
  ];
}

function invert([x, y, z]: [number, number, number]): [number, number, number] {
  return [normalizeZero(-x), normalizeZero(-y), normalizeZero(-z)];
}

function normalizeZero(value: number) {
  return Math.abs(value) < 1e-9 ? 0 : value;
}
