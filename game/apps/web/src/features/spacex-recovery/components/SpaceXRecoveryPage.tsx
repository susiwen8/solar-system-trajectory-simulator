import { t, type Language } from "../../../lib/i18n";

type SpaceXRecoveryPageProps = {
  language: Language;
};

export default function SpaceXRecoveryPage({ language }: SpaceXRecoveryPageProps) {
  const copy = t(language);

  return (
    <section className="recovery-page" aria-label={copy.spacexRecoveryTitle}>
      <header className="recovery-page__header">
        <p className="eyebrow">{copy.recoveryNavLabel}</p>
        <h1>{copy.spacexRecoveryTitle}</h1>
        <p>{copy.spacexRecoverySubtitle}</p>
      </header>
    </section>
  );
}
