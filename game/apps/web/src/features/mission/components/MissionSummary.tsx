import type { TrajectoryResult } from "../types";
import { localizeMissionSegment, localizeWarning, planetLabel, t, type Language } from "../../../lib/i18n";
import { formatFlightDuration } from "../../../lib/duration";

type MissionSummaryProps = {
  result: TrajectoryResult;
  language: Language;
};

type RouteDescriptor = Pick<TrajectoryResult, "sequenceBodies" | "fullSequenceBodies" | "visitOrder" | "closestApproach">;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatSegmentDuration(startEpoch: string, endEpoch: string): string {
  const durationHours = Math.max((Date.parse(endEpoch) - Date.parse(startEpoch)) / 3_600_000, 0);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: durationHours >= 10 ? 0 : 1,
    minimumFractionDigits: 0,
  }).format(durationHours);
}

function resolveVisitSequenceBodies(route: RouteDescriptor): string[] {
  if (route.visitOrder?.length) {
    return ["earth", ...route.visitOrder];
  }

  if (route.sequenceBodies?.length) {
    return route.sequenceBodies;
  }

  if (route.fullSequenceBodies?.length) {
    return route.fullSequenceBodies;
  }

  return ["earth", route.closestApproach.bodyId];
}

function resolveFullSequenceBodies(route: RouteDescriptor): string[] {
  if (route.fullSequenceBodies?.length) {
    return route.fullSequenceBodies;
  }

  return route.sequenceBodies?.length ? route.sequenceBodies : [];
}

function formatBodySequence(language: Language, bodyIds: string[]): string {
  return bodyIds.map((bodyId) => planetLabel(language, bodyId)).join(" -> ");
}

function formatSegmentDetails(result: TrajectoryResult, language: Language): Array<{ key: string; text: string }> {
  const copy = t(language);
  const details: Array<{ key: string; text: string }> = [];

  for (const segment of result.segments ?? []) {
    if (segment.segmentType === "heliocentricCruise") {
      const maneuverCount = segment.metadata?.maneuverCount;
      const deltaVTotal = segment.metadata?.deltaVTotalKmPerS;
      if (maneuverCount != null) {
        details.push({
          key: `${segment.segmentType}-maneuvers`,
          text: `${copy.maneuversLabel}: ${maneuverCount}`,
        });
      }
      if (deltaVTotal != null) {
        details.push({
          key: `${segment.segmentType}-delta-v`,
          text: `${copy.deltaVLabel}: ${deltaVTotal} km/s`,
        });
      }
      if (segment.massSummary?.propellantUsedKg != null) {
        details.push({
          key: `${segment.segmentType}-propellant`,
          text: `${copy.propellantUsed}: ${formatNumber(segment.massSummary.propellantUsedKg)} kg`,
        });
      }
    }

    if (segment.segmentType === "gravityAssistFlyby" || segment.segmentType === "flybyEncounter") {
      if (segment.metadata?.turnAngleDeg != null) {
        details.push({
          key: `${segment.segmentType}-turn-angle`,
          text: `${copy.turnAngle}: ${segment.metadata.turnAngleDeg} deg`,
        });
      }
      if (segment.metadata?.periapsisAltitudeKm != null) {
        details.push({
          key: `${segment.segmentType}-periapsis`,
          text: `${copy.periapsisAltitude}: ${formatNumber(segment.metadata.periapsisAltitudeKm)} km`,
        });
      }
      if (segment.metadata?.bodyId) {
        details.push({
          key: `${segment.segmentType}-body`,
          text: `${localizeMissionSegment(language, segment.segmentType)}: ${planetLabel(language, segment.metadata.bodyId)}`,
        });
      }
    }
  }

  return details;
}

export default function MissionSummary({ result, language }: MissionSummaryProps) {
  const copy = t(language);
  const segments = result.segments ?? [];
  const segmentDetails = formatSegmentDetails(result, language);
  const visitSequence = resolveVisitSequenceBodies(result);
  const fullSequence = resolveFullSequenceBodies(result);
  const showFullSequence = fullSequence.length > 0 && fullSequence.join("|") !== visitSequence.join("|");
  const navigationTelemetry = result.navigationTelemetry;

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
          <strong>{formatFlightDuration(result.flightTimeSeconds, language)}</strong>
        </article>
        <article className="summary-metric">
          <span className="summary-metric__label">{copy.ephemeris}</span>
          <strong>{result.ephemerisSource}</strong>
        </article>
        <article className="summary-metric summary-metric--wide">
          <span className="summary-metric__label">{copy.sequenceLabel}</span>
          <strong>{`: ${formatBodySequence(language, visitSequence)}`}</strong>
        </article>
        {showFullSequence ? (
          <article className="summary-metric summary-metric--wide">
            <span className="summary-metric__label">{copy.fullSequenceLabel}</span>
            <strong>{`: ${formatBodySequence(language, fullSequence)}`}</strong>
          </article>
        ) : null}
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

      {navigationTelemetry?.enabled ? (
        <div className="summary-segments" aria-label={copy.navigationSummary}>
          <p className="summary-card__eyebrow">{copy.navigationSummary}</p>
          <div className="summary-metrics">
            <article className="summary-metric">
              <span className="summary-metric__label">{copy.maneuverCount}</span>
              <strong>{navigationTelemetry.tcmCount}</strong>
            </article>
            <article className="summary-metric">
              <span className="summary-metric__label">{copy.cumulativeCorrectionDeltaV}</span>
              <strong>{navigationTelemetry.cumulativeCorrectionDeltaVKmPerS.toFixed(3)} km/s</strong>
            </article>
            <article className="summary-metric">
              <span className="summary-metric__label">{copy.maxPredictedMiss}</span>
              <strong>{formatNumber(navigationTelemetry.maxPredictedMissKm)} km</strong>
            </article>
            <article className="summary-metric">
              <span className="summary-metric__label">{copy.maxPositionDeviation}</span>
              <strong>{formatNumber(navigationTelemetry.maxPositionDeviationKm)} km</strong>
            </article>
            <article className="summary-metric">
              <span className="summary-metric__label">{copy.maxVelocityDeviation}</span>
              <strong>{navigationTelemetry.maxVelocityDeviationKmPerS.toFixed(3)} km/s</strong>
            </article>
            <article className="summary-metric">
              <span className="summary-metric__label">{copy.finalPredictedMiss}</span>
              <strong>
                {navigationTelemetry.finalPredictedMissKm != null
                  ? `${formatNumber(navigationTelemetry.finalPredictedMissKm)} km`
                  : "—"}
              </strong>
            </article>
          </div>
        </div>
      ) : null}

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
          {segmentDetails.length > 0 ? (
            <ul className="summary-warning-list">
              {segmentDetails.map((detail) => (
                <li key={detail.key}>{detail.text}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
