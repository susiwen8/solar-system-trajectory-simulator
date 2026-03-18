import type { TrajectoryResult } from "../../mission/types";
import { toScenePoints } from "../lib/trajectory";

type SolarSystemSceneProps = {
  result: TrajectoryResult;
};

export default function SolarSystemScene({ result }: SolarSystemSceneProps) {
  const points = toScenePoints(result.samples);

  return (
    <section aria-label="Solar System Scene">
      <h2>Trajectory Scene</h2>
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
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "1.1rem",
            height: "1.1rem",
            marginLeft: "-0.55rem",
            marginTop: "-0.55rem",
            borderRadius: "999px",
            background: "#f4b400",
            boxShadow: "0 0 22px rgba(255, 200, 0, 0.8)"
          }}
          title="Sun"
        />

        {points.map((point, index) => (
          <div
            key={`${point.x}-${point.y}-${point.z}-${index}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: index === points.length - 1 ? "0.65rem" : "0.32rem",
              height: index === points.length - 1 ? "0.65rem" : "0.32rem",
              marginLeft: index === points.length - 1 ? "-0.325rem" : "-0.16rem",
              marginTop: index === points.length - 1 ? "-0.325rem" : "-0.16rem",
              borderRadius: "999px",
              background: index === points.length - 1 ? "#8fe3ff" : "rgba(143, 227, 255, 0.55)",
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
