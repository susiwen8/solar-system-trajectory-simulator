export type EmptyPreviewOrbitGuide = {
  radiusX: number;
  radiusY: number;
  eccentricity: number;
  opacity: number;
  lineWidthScale: number;
};

const INNER_BODY_IDS = new Set(["mercury", "venus", "earth", "mars"]);

export function buildEmptyPreviewOrbitGuide(
  bodyId: string,
  orbitalRadius: number,
): EmptyPreviewOrbitGuide {
  const isInnerBody = INNER_BODY_IDS.has(bodyId);
  const eccentricity = isInnerBody ? 0.08 : 0.14;
  const radiusX = Math.max(orbitalRadius, 1);
  const radiusY = radiusX * (1 - eccentricity);

  return {
    radiusX,
    radiusY,
    eccentricity,
    opacity: isInnerBody ? 0.28 : 0.16,
    lineWidthScale: isInnerBody ? 1 : 1.45,
  };
}
