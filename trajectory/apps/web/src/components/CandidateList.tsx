import type { MissionCandidate } from "../api/client";

type CandidateListProps = {
  candidates: MissionCandidate[];
  selectedCandidateId: string | null;
  onSelect: (candidateId: string) => void;
};

export function CandidateList({
  candidates,
  selectedCandidateId,
  onSelect
}: CandidateListProps) {
  return (
    <section className="panel-card candidate-list">
      <h2>Trajectory Candidates</h2>
      <div className="candidate-stack">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            className={
              candidate.id === selectedCandidateId
                ? "candidate-card candidate-card-selected"
                : "candidate-card"
            }
            onClick={() => onSelect(candidate.id)}
            type="button"
          >
            <strong>{candidate.summary.label}</strong>
            <span>{Math.round(candidate.summary.totalDurationDays)} days</span>
            <span>{candidate.summary.totalDeltaV.toFixed(1)} km/s</span>
          </button>
        ))}
      </div>
    </section>
  );
}

