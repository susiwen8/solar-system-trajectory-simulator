import type { MissionPhase, MissionTimeline, MissionTimelineEvent, TrajectorySample } from "../../mission/types";

export type MissionTimelineSnapshot = {
  currentPhase: MissionPhase | null;
  nextEvent: MissionTimelineEvent | null;
  progress: number;
};

export type MissionTimelinePhaseMarker = {
  endEpoch: string;
  id: string;
  isActive: boolean;
  phaseType: string;
  progress: number;
  sampleIndex: number;
  startEpoch: string;
  title: string;
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
    timeline.phases.find((phase, index) => {
      const start = Date.parse(phase.startEpoch);
      const end = Date.parse(phase.endEpoch);
      const isLastPhase = index === timeline.phases.length - 1;
      return currentTime >= start && (currentTime < end || (isLastPhase && currentTime <= end));
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

export function buildMissionTimelinePhaseMarkers(
  timeline: MissionTimeline | null | undefined,
  samples: Pick<TrajectorySample, "epochSeconds">[],
  launchEpoch: string | null,
  currentEpoch: string | null,
  activePhaseIdOverride: string | null = null,
): MissionTimelinePhaseMarker[] {
  if (!timeline || !launchEpoch || !samples.length) {
    return [];
  }

  const launchTime = Date.parse(launchEpoch);
  if (Number.isNaN(launchTime)) {
    return [];
  }

  const currentPhaseId = activePhaseIdOverride ?? getMissionTimelineSnapshot(timeline, currentEpoch).currentPhase?.id ?? null;
  const sampleSpan = Math.max(samples.length - 1, 1);

  return [...timeline.phases]
    .sort((left, right) => Date.parse(left.startEpoch) - Date.parse(right.startEpoch))
    .map((phase) => {
      const sampleIndex = findClosestSampleIndex(samples, launchTime, phase.startEpoch);
      return {
        endEpoch: phase.endEpoch,
        id: phase.id,
        isActive: phase.id === currentPhaseId,
        phaseType: phase.type,
        progress: sampleIndex / sampleSpan,
        sampleIndex,
        startEpoch: phase.startEpoch,
        title: phase.title,
      };
    });
}

function findClosestSampleIndex(
  samples: Pick<TrajectorySample, "epochSeconds">[],
  launchTime: number,
  targetEpoch: string,
): number {
  const targetTime = Date.parse(targetEpoch);
  if (Number.isNaN(targetTime)) {
    return 0;
  }

  let closestIndex = 0;
  let closestDistanceMs = Number.POSITIVE_INFINITY;
  for (const [index, sample] of samples.entries()) {
    const sampleTime = launchTime + sample.epochSeconds * 1000;
    const distanceMs = Math.abs(sampleTime - targetTime);
    if (distanceMs < closestDistanceMs) {
      closestDistanceMs = distanceMs;
      closestIndex = index;
    }
  }

  return closestIndex;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
