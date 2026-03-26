import { t, type Language } from "../../../lib/i18n";

type RecoveryPlaybackControlsProps = {
  language: Language;
  isPlaying: boolean;
  progress: number;
  onTogglePlayback: () => void;
  onReset: () => void;
  onProgressChange: (progress: number) => void;
};

export default function RecoveryPlaybackControls({
  language,
  isPlaying,
  progress,
  onTogglePlayback,
  onReset,
  onProgressChange,
}: RecoveryPlaybackControlsProps) {
  const copy = t(language);

  return (
    <section className="scene-shell__footer" aria-label={copy.recoveryPlaybackLabel}>
      <div className="scene-shell__footer-main">
        <p className="eyebrow">{copy.recoveryTimelineLabel}</p>
        <div className="scene-shell__footer-controls">
          <div className="scene-playback-actions">
            <button type="button" className="scene-action-button" onClick={onTogglePlayback}>
              {isPlaying ? copy.pause : copy.start}
            </button>
            <button
              type="button"
              className="scene-action-button scene-action-button--ghost"
              onClick={onReset}
            >
              {copy.reset}
            </button>
          </div>

          <label className="scene-slider">
            <span className="scene-slider__label">{copy.playbackStep}</span>
            <input
              aria-label={copy.playbackStep}
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={(event) => onProgressChange(Number(event.target.value))}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
