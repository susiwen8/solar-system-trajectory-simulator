import { planetLabel, t, type Language } from "../../../lib/i18n";
import type { InsetMapModel } from "../lib/inset-map";

type TrajectoryInsetMapProps = {
  model: InsetMapModel;
  language: Language;
};

export default function TrajectoryInsetMap({ model, language }: TrajectoryInsetMapProps) {
  const copy = t(language);
  const path = model.pathPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="scene-inset-map" data-testid="trajectory-inset-map" aria-label={copy.trajectoryOverview}>
      <div className="scene-inset-map__header">
        <span>{copy.trajectoryOverview}</span>
        <strong>{model.highlightBody ? planetLabel(language, model.highlightBody.bodyId) : planetLabel(language, model.targetBody?.bodyId ?? "sun")}</strong>
      </div>
      <svg viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`} role="img" aria-label={copy.trajectoryOverview}>
        {model.orbitPaths.map((orbit) => (
          <polyline
            key={orbit.bodyId}
            points={orbit.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={orbit.bodyId === model.targetBody?.bodyId ? "rgba(247, 191, 102, 0.5)" : "rgba(238, 244, 251, 0.22)"}
            strokeWidth={orbit.bodyId === model.targetBody?.bodyId ? "1.8" : "1.2"}
            strokeDasharray={orbit.bodyId === model.targetBody?.bodyId ? undefined : "4 6"}
          />
        ))}
        <circle cx={model.viewBox.width / 2} cy={model.viewBox.height / 2} r="5" fill="#f4b400" />
        <polyline
          points={path}
          fill="none"
          stroke="rgba(143, 227, 255, 0.95)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {model.visibleBodies.map((body) => (
          <g key={body.bodyId}>
            <circle cx={body.x} cy={body.y} r={body.bodyId === model.highlightBody?.bodyId ? 5 : 4} fill="#eef4fb" />
            <title>{planetLabel(language, body.bodyId)}</title>
          </g>
        ))}
        {model.targetBody ? (
          <circle cx={model.targetBody.x} cy={model.targetBody.y} r="7" fill="none" stroke="#f7bf66" strokeWidth="2" />
        ) : null}
        <circle cx={model.currentProbePoint.x} cy={model.currentProbePoint.y} r="4.5" fill="#6ab8ff" />
      </svg>
    </div>
  );
}
