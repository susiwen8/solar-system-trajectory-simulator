import { t, type Language } from "../../../lib/i18n";

type RecoveryPhaseCardProps = {
  language: Language;
  title: string;
  summary: string;
  highlights: string[];
};

export default function RecoveryPhaseCard({
  language,
  title,
  summary,
  highlights,
}: RecoveryPhaseCardProps) {
  const copy = t(language);

  return (
    <section className="recovery-phase-card" aria-label={copy.recoveryPhaseLabel}>
      <p className="eyebrow">{copy.recoveryPhaseLabel}</p>
      <h2>{title}</h2>
      <p>{summary}</p>
      <ul>
        {highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
    </section>
  );
}
