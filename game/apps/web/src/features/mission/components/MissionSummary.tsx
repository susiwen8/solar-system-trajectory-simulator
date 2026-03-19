import type { TrajectoryResult } from "../types";
import { localizeMissionSegment, localizeWarning, planetLabel, t, type Language } from "../../../lib/i18n";

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

function formatSegmentDuration(startEpoch: string, endEpoch: string): string {
  const durationHours = Math.max((Date.parse(endEpoch) - Date.parse(startEpoch)) / 3_600_000, 0);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: durationHours >= 10 ? 0 : 1,
    minimumFractionDigits: 0,
  }).format(durationHours);
}

export default function MissionSummary({ result, language }: MissionSummaryProps) {
  const copy = t(language);
  const segments = result.segments ?? [];
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
        {result.totalPropellantUsedKg != null ? (
          <article className="summary-metric">
            <span className="summary-metric__label">{copy.propellantUsed}</span>
            <strong>{formatNumber(result.totalPropellantUsedKg)} kg</strong>
          </article>
        ) : null}
        {result.finalMassKg != null ? (
          <article className="summary-metric">
            <span className="summary-metric__label">{copy.finalMass}</span>
            <strong>{formatNumber(result.finalMassKg)} kg</strong>
          </article>
        ) : null}
        {result.maneuverEvents?.length ? (
          <article className="summary-metric">
            <span className="summary-metric__label">{copy.maneuverCount}</span>
            <strong>{result.maneuverEvents.length}</strong>
          </article>
        ) : null}
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

      {segments.length > 0 ? (
        <div className="summary-segments" aria-label={copy.missionSegments}>
          <p className="summary-card__eyebrow">{copy.missionSegments}</p>
          <ul className="summary-warning-list">
            {segments.map((segment) => (
              <li key={`${segment.segmentType}-${segment.startEpoch}`}>
                <strong>{localizeMissionSegment(language, segment.segmentType)}</strong>
                {` · ${formatSegmentDuration(segment.startEpoch, segment.endEpoch)} h`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
