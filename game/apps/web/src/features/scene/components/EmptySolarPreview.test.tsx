import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { BodyState } from "../../mission/types";
import EmptySolarPreview, {
  resolvePreviewCameraFar,
  resolvePreviewFocusPoint,
  resolvePreviewOverviewDistance,
  resolvePreviewReferenceBodies,
} from "./EmptySolarPreview";

const bodies: BodyState[] = [
  {
    bodyId: "sun",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [0, 0, 0],
    velocityKmPerSec: [0, 0, 0],
    muKm3PerS2: 132712440018,
    sourceName: "keplerian-elements",
  },
  {
    bodyId: "earth",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [-24856124, 144936962, 0],
    velocityKmPerSec: [-29.837, -5.127, 0],
    muKm3PerS2: 398600.435436,
    sourceName: "jpl-horizons-file",
  },
];

const overviewBodies: BodyState[] = [
  ...bodies,
  {
    bodyId: "jupiter",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [-253274885.7, 0, 736954008.9],
    velocityKmPerSec: [0, 13.07, 0],
    muKm3PerS2: 126686534.9,
    sourceName: "jpl-horizons-file",
  },
  {
    bodyId: "neptune",
    epoch: "2026-01-01T00:00:00.000Z",
    positionKm: [4460000000, 0, 30000000],
    velocityKmPerSec: [0, 5.43, 0],
    muKm3PerS2: 6835099.5,
    sourceName: "jpl-horizons-file",
  },
];

describe("EmptySolarPreview", () => {
  it("renders an empty-scene surface without instructional copy", () => {
    render(<EmptySolarPreview bodies={bodies} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Three.js 飞行画布")).toBeInTheDocument();
  });

  it("marks the refined preview surface for the enhanced orbit view", () => {
    render(<EmptySolarPreview bodies={bodies} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toHaveAttribute("data-orbit-guide-style", "refined");
  });

  it("renders a minimal fallback surface when body data is missing", () => {
    render(<EmptySolarPreview bodies={[]} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toBeInTheDocument();
  });

  it("centers the empty preview on the sun for a full-system overview", () => {
    const focusPoint = resolvePreviewFocusPoint(overviewBodies);

    expect(focusPoint.equals(new THREE.Vector3(0, 0, 0))).toBe(true);
  });

  it("uses all planetary bodies to size the overview framing", () => {
    const referenceBodies = resolvePreviewReferenceBodies(overviewBodies, new THREE.Vector3(0, 0, 0));

    expect(referenceBodies).toHaveLength(3);
    expect(referenceBodies.map((body) => body.bodyId)).toEqual(["earth", "jupiter", "neptune"]);
  });

  it("caps the overview distance before the most extreme outer outliers flatten the scene", () => {
    const overviewDistance = resolvePreviewOverviewDistance(overviewBodies, new THREE.Vector3(0, 0, 0));

    expect(overviewDistance).toBeGreaterThan(100);
    expect(overviewDistance).toBeLessThan(300);
  });

  it("keeps the bird's-eye camera far plane beyond the overview distance", () => {
    const overviewDistance = resolvePreviewOverviewDistance(overviewBodies, new THREE.Vector3(0, 0, 0));
    const farPlane = resolvePreviewCameraFar(overviewDistance);

    expect(farPlane).toBeGreaterThan(overviewDistance * 4);
    expect(farPlane).toBeGreaterThan(1000);
  });
});
