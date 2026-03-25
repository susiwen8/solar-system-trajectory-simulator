type TimeControlsProps = {
  isPaused: boolean;
  speed: number;
  onTogglePaused: () => void;
  onSetSpeed: (speed: number) => void;
};

const SPEEDS = [1, 10, 100, 1000];

export function TimeControls({
  isPaused,
  speed,
  onTogglePaused,
  onSetSpeed
}: TimeControlsProps) {
  return (
    <div className="time-controls panel-card">
      <button type="button" onClick={onTogglePaused}>
        {isPaused ? "Resume" : "Pause"}
      </button>
      {SPEEDS.map((value) => (
        <button
          key={value}
          className={value === speed ? "speed-pill speed-pill-active" : "speed-pill"}
          type="button"
          onClick={() => onSetSpeed(value)}
        >
          {value}x
        </button>
      ))}
    </div>
  );
}

