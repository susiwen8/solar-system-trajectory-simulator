import type { CameraMode } from "../state/missionStore";

type TelemetryHudProps = {
  cameraMode: CameraMode;
  fidelity: {
    ephemeris: string;
    transfer: string;
    flyby: string;
  } | null;
  warnings: string[];
};

export function TelemetryHud({ cameraMode, fidelity, warnings }: TelemetryHudProps) {
  return (
    <div className="telemetry panel-card">
      <div className="badge-row">
        <span className="badge">Camera: {cameraMode}</span>
        {fidelity ? <span className="badge">Ephemeris: {fidelity.ephemeris}</span> : null}
        {fidelity ? <span className="badge">Transfer: {fidelity.transfer}</span> : null}
        {fidelity ? <span className="badge">Flyby: {fidelity.flyby}</span> : null}
      </div>
      <div className="warning-stack">
        {warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </div>
    </div>
  );
}

