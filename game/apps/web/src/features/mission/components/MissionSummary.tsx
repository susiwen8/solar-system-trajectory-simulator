import type { TrajectoryResult } from "../types";

type MissionSummaryProps = {
  result: TrajectoryResult;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

export default function MissionSummary({ result }: MissionSummaryProps) {
  return (
    <section aria-label="Mission Summary">
      <h2>Closest Approach</h2>
      <p>Target: {result.closestApproach.bodyId}</p>
      <p>Distance: {formatNumber(result.closestApproach.distanceKm)} km</p>
      <p>Flight Time: {formatNumber(result.flightTimeSeconds)} s</p>
      {result.warnings.length > 0 ? (
        <ul>
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p>No warnings</p>
      )}
    </section>
  );
}
