import { useEffect, useState, type ComponentType } from "react";

import { t, type Language } from "../../../lib/i18n";
import {
  RECOVERY_DEMO_DURATION_SECONDS,
  getRecoveryDemoSnapshot,
  type RecoveryPhaseId,
} from "../lib/recovery-sequence";
import RecoveryPhaseCard from "./RecoveryPhaseCard";
import RecoveryPlaybackControls from "./RecoveryPlaybackControls";
import SpaceXRecoveryScene, { type SpaceXRecoverySceneProps } from "./SpaceXRecoveryScene";

type SpaceXRecoveryPageProps = {
  language: Language;
  SceneComponent?: ComponentType<SpaceXRecoverySceneProps>;
};

type LocalizedRecoveryPhaseContent = {
  highlights: string[];
  summary: string;
  title: string;
};

const RECOVERY_PHASE_CONTENT: Record<Language, Record<RecoveryPhaseId, LocalizedRecoveryPhaseContent>> = {
  en: {
    liftoff: {
      title: "Liftoff",
      summary: "Both stages rise together as the stack clears the pad.",
      highlights: ["The launch frame stays tight to emphasize thrust and scale."],
    },
    "pitch-and-ascent": {
      title: "Pitch and Ascent",
      summary: "The rocket tips over to trade vertical climb for horizontal speed.",
      highlights: ["The camera still tracks the vehicle from the launch-side viewpoint."],
    },
    "stage-separation": {
      title: "Stage Separation",
      summary: "The booster and upper stage begin to peel apart in the same flight beat.",
      highlights: ["The side-follow camera keeps both vehicles readable during the split."],
    },
    "first-stage-boostback": {
      title: "First-Stage Boostback",
      summary: "The booster bends back toward the recovery corridor while the upper stage keeps leaving.",
      highlights: ["This phase makes the return arc visible instead of treating it as a static pause."],
    },
    "first-stage-atmospheric-return": {
      title: "First-Stage Atmospheric Return",
      summary: "The booster falls back through thicker air while the second stage stays outbound.",
      highlights: ["Both trajectories stay visible so the diverging mission roles remain obvious."],
    },
    "landing-burn-and-touchdown": {
      title: "Landing Burn and Touchdown",
      summary: "The returning booster slows for the final descent and settles onto the landing zone.",
      highlights: ["The overview framing keeps the booster landing and upper-stage path connected."],
    },
    "second-stage-orbital-continuation": {
      title: "Second-Stage Orbital Continuation",
      summary: "The booster story ends, but the upper stage keeps building orbital energy.",
      highlights: ["The final beat shifts narrative emphasis to the mission continuing overhead."],
    },
  },
  zh: {
    liftoff: {
      title: "一级起飞",
      summary: "一级与二级作为整套箭体一起离开发射台。",
      highlights: ["镜头保持近距离仰视，突出推力和尺度感。"],
    },
    "pitch-and-ascent": {
      title: "俯仰爬升",
      summary: "火箭开始俯仰转弯，把垂直爬升逐步转换成水平速度。",
      highlights: ["这一段仍保持贴近发射场的观察视角。"],
    },
    "stage-separation": {
      title: "一级二级分离",
      summary: "助推器与上面级在同一飞行阶段内开始分开，各自进入不同轨迹。",
      highlights: ["侧向跟拍镜头让分离动作更容易看清。"],
    },
    "first-stage-boostback": {
      title: "一级返向点火",
      summary: "一级助推器开始朝回收走廊折返，而二级继续向前增速。",
      highlights: ["这一段会明确展示一级开始“往回拐”的轨迹变化。"],
    },
    "first-stage-atmospheric-return": {
      title: "一级大气层返回",
      summary: "一级重新进入更稠密的大气层，同时二级仍在继续远离。",
      highlights: ["两条轨迹会同时保留，方便对照各自任务。"],
    },
    "landing-burn-and-touchdown": {
      title: "着陆点火与落地",
      summary: "一级在最后阶段减速，对准回收平台或着陆区完成落地。",
      highlights: ["拉远镜头会同时保留回收动作和二级远去的关系。"],
    },
    "second-stage-orbital-continuation": {
      title: "二级继续入轨",
      summary: "一级回收过程结束后，叙事重点转向继续建立轨道能量的二级。",
      highlights: ["最后一个阶段强调任务并未随着一级落地而结束。"],
    },
  },
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export default function SpaceXRecoveryPage({
  language,
  SceneComponent = SpaceXRecoveryScene,
}: SpaceXRecoveryPageProps) {
  const copy = t(language);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const snapshot = getRecoveryDemoSnapshot(progress);
  const phaseContent = RECOVERY_PHASE_CONTENT[language][snapshot.activePhase.id];

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const step = 1 / RECOVERY_DEMO_DURATION_SECONDS;
    const interval = window.setInterval(() => {
      setProgress((currentProgress) => Math.min(currentProgress + step, 1));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (progress >= 1 && isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying, progress]);

  const handleReset = () => {
    setProgress(0);
  };

  return (
    <main className="recovery-page" aria-label={copy.spacexRecoveryTitle}>
      <header className="recovery-page__header">
        <p className="eyebrow">{copy.recoveryNavLabel}</p>
        <h1>{copy.spacexRecoveryTitle}</h1>
        <p>{copy.spacexRecoverySubtitle}</p>
        <p>{copy.recoveryPageBody}</p>
      </header>

      <section className="recovery-page__grid">
        <div className="recovery-page__scene-column">
          <SceneComponent language={language} snapshot={snapshot} />
        </div>

        <div className="recovery-page__control-column">
          <RecoveryPhaseCard
            language={language}
            title={phaseContent.title}
            summary={phaseContent.summary}
            highlights={phaseContent.highlights}
          />
          <RecoveryPlaybackControls
            language={language}
            isPlaying={isPlaying}
            progress={progress}
            onTogglePlayback={() => {
              setIsPlaying((current) => !current);
            }}
            onReset={handleReset}
            onProgressChange={(nextProgress) => {
              setProgress(nextProgress);
            }}
          />
        </div>
      </section>
    </main>
  );
}
