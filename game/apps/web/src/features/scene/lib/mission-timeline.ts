import type { MissionPhase, MissionTimeline, MissionTimelineEvent } from "../../mission/types";

export type MissionTimelineSnapshot = {
  currentPhase: MissionPhase | null;
  nextEvent: MissionTimelineEvent | null;
  progress: number;
};

export function getMissionTimelineSnapshot(
  timeline: MissionTimeline | null | undefined,
  currentEpoch: string | null,
): MissionTimelineSnapshot {
  if (!timeline || !currentEpoch) {
    return {
      currentPhase: null,
      nextEvent: null,
      progress: 0,
    };
  }

  const currentTime = Date.parse(currentEpoch);
  if (Number.isNaN(currentTime)) {
    return {
      currentPhase: null,
      nextEvent: null,
      progress: 0,
    };
  }

  const currentPhase =
    timeline.phases.find((phase) => {
      const start = Date.parse(phase.startEpoch);
      const end = Date.parse(phase.endEpoch);
      return currentTime >= start && currentTime <= end;
    }) ?? null;

  const nextEvent =
    timeline.events
      .filter((event) => Date.parse(event.epoch) > currentTime)
      .sort((left, right) => Date.parse(left.epoch) - Date.parse(right.epoch))[0] ?? null;

  const missionStart = Date.parse(timeline.missionStartEpoch);
  const missionEnd = Date.parse(timeline.missionEndEpoch);
  const span = Math.max(missionEnd - missionStart, 1);
  const progress = clamp((currentTime - missionStart) / span, 0, 1);

  return {
    currentPhase,
    nextEvent,
    progress,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
