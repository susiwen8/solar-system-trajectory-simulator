import { t, type Language } from "../../../lib/i18n";
import type { RecoveryDemoSnapshot } from "../lib/recovery-sequence";

type RecoveryPhaseCardProps = {
  language: Language;
  snapshot: RecoveryDemoSnapshot;
};

export default function RecoveryPhaseCard({ language, snapshot }: RecoveryPhaseCardProps) {
  const copy = t(language);

  return (
    <section className="recovery-phase-card" aria-label={copy.recoveryPhaseLabel}>
      <p className="eyebrow">{copy.recoveryPhaseLabel}</p>
      <h2>{snapshot.activePhase.label}</h2>
      <p>{copy.recoveryPhaseBody}</p>
      <ul>
        {snapshot.phaseHighlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
    </section>
  );
}
