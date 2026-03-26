import { t, type Language } from "../../../lib/i18n";
import type { RecoveryDemoSnapshot } from "../lib/recovery-sequence";

type RecoveryPhaseCardProps = {
  language: Language;
  snapshot: RecoveryDemoSnapshot;
};

export default function RecoveryPhaseCard({ language, snapshot }: RecoveryPhaseCardProps) {
  const copy = t(language);
  const [phaseSummary, ...phaseHighlights] = snapshot.phaseHighlights;

  return (
    <section className="recovery-phase-card" aria-label={copy.recoveryPhaseLabel}>
      <p className="eyebrow">{copy.recoveryPhaseLabel}</p>
      <h2>{snapshot.activePhase.label}</h2>
      <p>{phaseSummary ?? copy.recoveryPhaseBody}</p>
      <ul>
        {phaseHighlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
    </section>
  );
}
