import type { TrajectoryResult } from "../types";
import { localizeWarning, planetLabel, t, type Language } from "../../../lib/i18n";

type MissionSummaryProps = {
  result: TrajectoryResult;
  language: Language;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatFlightTimeDays(seconds: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(seconds / 86400);
}

export default function MissionSummary({ result, language }: MissionSummaryProps) {
  const copy = t(language);
  return (
    <section className="summary-card" aria-label={copy.missionSummary}>
      <p className="summary-card__eyebrow">{copy.telemetrySnapshot}</p>
      <h2>{copy.closestApproach}</h2>

      <div className="summary-metrics">
        <article className="summary-metric">
          <span className="summary-metric__label">{copy.target}</span>
          <strong>{planetLabel(language, result.closestApproach.bodyId)}</strong>
        </article>
        <article className="summary-metric">
          <span className="summary-metric__label">{copy.distance}</span>
          <strong>{formatNumber(result.closestApproach.distanceKm)} km</strong>
        </article>
        <article className="summary-metric">
          <span className="summary-metric__label">{copy.flightTime}</span>
          <strong>{formatFlightTimeDays(result.flightTimeSeconds)} {copy.dayUnit}</strong>
        </article>
        <article className="summary-metric">
          <span className="summary-metric__label">{copy.ephemeris}</span>
          <strong>{result.ephemerisSource}</strong>
        </article>
      </div>

      {result.warnings.length > 0 ? (
        <ul className="summary-warning-list">
          {result.warnings.map((warning) => (
            <li key={warning}>{localizeWarning(language, warning)}</li>
          ))}
        </ul>
      ) : (
        <p className="summary-ok">{copy.noWarnings}</p>
      )}
    </section>
  );
}
