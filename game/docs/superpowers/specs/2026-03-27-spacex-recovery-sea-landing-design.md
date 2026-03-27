# SpaceX Recovery Sea-Landing Update Design

Date: 2026-03-27
Status: Approved in conversation

## Summary

Update the existing `/spacex-recovery` exhibit so the first stage no longer returns to the launch site. Instead, it should land on an offshore drone ship, making the start point and recovery point visibly different.

## Goals

- Change the recovery story from launch-site return to offshore drone-ship recovery.
- Keep the current route, playback controls, and phase structure intact.
- Make the changed recovery destination obvious in both the timeline model and the 3D scene.
- Update copy so the page describes sea recovery instead of a same-site landing zone.

## Non-Goals

- Rebuilding the full recovery feature from scratch.
- Turning the model into a mission-accurate Falcon 9 flight simulator.
- Adding new controls, routes, or data sources.

## Product Behavior

### Recovery Model

- The launch still starts from the coastal pad near the scene origin.
- After separation, the first stage should keep a distinct downrange landing destination instead of returning to the pad.
- The first-stage terminal position should remain visibly offset from launch at the end of the demo.
- The second stage should continue outbound as it does today.

### Recovery Scene

- Replace the land recovery target with an offshore drone ship.
- Keep the launch mount near shore so the launch and landing destinations are clearly separated.
- Add sea context so the drone ship reads as an ocean recovery target instead of another pad.
- Keep the scene stylized and legible rather than hyper-realistic.

### Copy

- Update the page and phase copy to describe offshore recovery or drone-ship landing where relevant.
- Keep the existing bilingual structure and preserve the current page layout.

## Implementation Notes

- The smallest safe change is to update the authored first-stage keyframes and camera targets in `recovery-sequence.ts`, then update the Three.js scene to render a water plane plus drone ship.
- Tests should lock down the new behavior before implementation:
  - first-stage terminal position differs from launch origin
  - fallback or scene copy references offshore drone-ship recovery

