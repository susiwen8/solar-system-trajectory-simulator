import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BodyState } from "../../mission/types";
import EmptySolarPreview from "./EmptySolarPreview";

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

describe("EmptySolarPreview", () => {
  it("renders an empty-scene surface without instructional copy", () => {
    render(<EmptySolarPreview bodies={bodies} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Three.js 飞行画布")).toBeInTheDocument();
  });

  it("renders a minimal fallback surface when body data is missing", () => {
    render(<EmptySolarPreview bodies={[]} language="zh" />);

    expect(screen.getByTestId("empty-orbit-preview")).toBeInTheDocument();
  });
});
