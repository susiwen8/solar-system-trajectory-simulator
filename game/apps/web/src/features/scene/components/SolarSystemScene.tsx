import type { BodyState, TrajectoryResult } from "../../mission/types";
import { scaleDistanceKm } from "../lib/scale";
import { toScenePoints } from "../lib/trajectory";

type SolarSystemSceneProps = {
  result: TrajectoryResult;
  bodies: BodyState[];
  currentEpoch: string | null;
  selectedSampleIndex: number;
  onSampleIndexChange: (index: number) => void;
};

const bodyColors: Record<string, string> = {
  sun: "#f4b400",
  mercury: "#b8aea1",
  venus: "#d6b989",
  earth: "#6ab8ff",
  mars: "#e27c61",
  jupiter: "#d9b07b",
  saturn: "#d7ca9e",
  uranus: "#8fdce0",
  neptune: "#6f93ff"
};

export default function SolarSystemScene({
  result,
  bodies,
  currentEpoch,
  selectedSampleIndex,
  onSampleIndexChange
}: SolarSystemSceneProps) {
  const points = toScenePoints(result.samples);

  return (
    <section aria-label="Solar System Scene">
      <h2>Trajectory Scene</h2>
      <label style={{ display: "grid", gap: "0.35rem", maxWidth: "28rem", color: "#2d3340" }}>
        Playback Step
        <input
          aria-label="Playback Step"
          type="range"
          min={0}
          max={Math.max(result.samples.length - 1, 0)}
          step={1}
          value={selectedSampleIndex}
          onChange={(event) => onSampleIndexChange(Number(event.target.value))}
        />
      </label>
      <p>{currentEpoch ? `Current Epoch: ${currentEpoch}` : "Current Epoch: pending"}</p>
      <div
        style={{
          position: "relative",
          minHeight: "22rem",
          overflow: "hidden",
          borderRadius: "1.5rem",
          border: "1px solid #d6d2c4",
          background:
            "radial-gradient(circle at top, rgba(255, 220, 130, 0.28), transparent 28%), linear-gradient(180deg, #09111f 0%, #15243c 55%, #0c1322 100%)",
          perspective: "900px"
        }}
      >
        {bodies.map((body) => {
          const x = scaleDistanceKm(body.positionKm[0]);
          const y = scaleDistanceKm(body.positionKm[1]);
          const z = scaleDistanceKm(body.positionKm[2]);
          const color = bodyColors[body.bodyId] ?? "#f5f3ed";
          const size = body.bodyId === "sun" ? 1.1 : 0.7;

          return (
            <div
              key={body.bodyId}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate3d(${x}px, ${y}px, ${z}px)`
              }}
            >
              <div
                style={{
                  width: `${size}rem`,
                  height: `${size}rem`,
                  marginLeft: `${-size / 2}rem`,
                  marginTop: `${-size / 2}rem`,
                  borderRadius: "999px",
                  background: color,
                  boxShadow: body.bodyId === "sun" ? "0 0 22px rgba(255, 200, 0, 0.8)" : "0 0 14px rgba(255,255,255,0.18)"
                }}
                title={body.bodyId}
              />
              <div
                style={{
                  marginTop: "0.6rem",
                  color: "#f5f3ed",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                {`Body: ${body.bodyId}`}
              </div>
            </div>
          );
        })}

        {points.map((point, index) => (
          <div
            key={`${point.x}-${point.y}-${point.z}-${index}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: index === selectedSampleIndex ? "0.65rem" : "0.32rem",
              height: index === selectedSampleIndex ? "0.65rem" : "0.32rem",
              marginLeft: index === selectedSampleIndex ? "-0.325rem" : "-0.16rem",
              marginTop: index === selectedSampleIndex ? "-0.325rem" : "-0.16rem",
              borderRadius: "999px",
              background: index === selectedSampleIndex ? "#8fe3ff" : "rgba(143, 227, 255, 0.55)",
              transform: `translate3d(${point.x}px, ${point.y}px, ${point.z}px)`
            }}
          />
        ))}

        <div
          style={{
            position: "absolute",
            right: "1rem",
            bottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.9rem",
            background: "rgba(8, 17, 31, 0.68)",
            color: "#f5f3ed"
          }}
        >
          <strong>Target</strong>
          <div>{result.closestApproach.bodyId}</div>
        </div>
      </div>
    </section>
  );
}
