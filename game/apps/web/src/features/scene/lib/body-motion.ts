import type { BodyState } from "../../mission/types";

export function interpolateBodyStates(
  current: BodyState[],
  target: BodyState[],
  alpha: number,
): BodyState[] {
  const t = clampAlpha(alpha);
  const currentById = new Map(current.map((body) => [body.bodyId, body]));

  return target.map((targetBody) => {
    const currentBody = currentById.get(targetBody.bodyId);
    if (!currentBody) {
      return targetBody;
    }

    return {
      ...targetBody,
      positionKm: [
        lerp(currentBody.positionKm[0], targetBody.positionKm[0], t),
        lerp(currentBody.positionKm[1], targetBody.positionKm[1], t),
        lerp(currentBody.positionKm[2], targetBody.positionKm[2], t),
      ],
      velocityKmPerSec: [
        lerp(currentBody.velocityKmPerSec[0], targetBody.velocityKmPerSec[0], t),
        lerp(currentBody.velocityKmPerSec[1], targetBody.velocityKmPerSec[1], t),
        lerp(currentBody.velocityKmPerSec[2], targetBody.velocityKmPerSec[2], t),
      ],
    };
  });
}

export function areBodyStatesClose(current: BodyState[], target: BodyState[]) {
  if (current.length !== target.length) {
    return false;
  }

  const currentById = new Map(current.map((body) => [body.bodyId, body]));
  return target.every((targetBody) => {
    const currentBody = currentById.get(targetBody.bodyId);
    if (!currentBody) {
      return false;
    }

    return (
      isCloseVec3(currentBody.positionKm, targetBody.positionKm) &&
      isCloseVec3(currentBody.velocityKmPerSec, targetBody.velocityKmPerSec)
    );
  });
}

function lerp(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

function clampAlpha(alpha: number) {
  return Math.min(Math.max(alpha, 0), 1);
}

function isCloseVec3(
  left: [number, number, number],
  right: [number, number, number],
) {
  return (
    Math.abs(left[0] - right[0]) < 0.001 &&
    Math.abs(left[1] - right[1]) < 0.001 &&
    Math.abs(left[2] - right[2]) < 0.001
  );
}
