# Return To Earth Toggle Design

Date: 2026-03-26
Status: Draft approved in conversation, pending written review

## Summary

Add a user-controlled return-to-Earth toggle to the unified mission selector.

The simulator should continue to support the current one-way mission flows, but it should also let the user request a closed-loop mission that:

- departs from Earth
- visits the selected planet or optimized planet sequence
- returns to Earth at the end of the mission

The new control should be explicit, default to off, and affect real trajectory solving rather than only changing how the route is displayed.

## Goals

- Add a simple mission-form control for choosing whether the mission returns to Earth.
- Keep the default experience unchanged by leaving the control off by default.
- Ensure return-enabled missions solve a real final leg back to Earth.
- Reuse the existing tour-planning pipeline for both single-planet-return and multi-planet-return missions.
- Keep launch-window search, candidate ranking, summary cards, and 3D playback consistent with the selected return mode.

## Non-Goals

- Adding a separate return-only planner endpoint.
- Supporting manual state-vector closed-loop missions in this increment.
- Changing the current meaning of `requiredVisitBodies`.
- Reworking the scene renderer or playback architecture.

## Product Behavior

### Mission Form

The mission form should add a new boolean control:

- label: `返回地球` in Chinese and `Return to Earth` in English
- default value: `false`

Behavior:

- if the toggle is off, mission behavior stays exactly as it is today
- if the toggle is on, the mission must end with a solved final leg to Earth

### Submission Rules

- zero selected planets is still invalid
- one selected planet and `returnToDeparture = false` uses the current single-target trajectory flow
- one selected planet and `returnToDeparture = true` uses the tour-planning flow so the app can solve `Earth -> target -> Earth`
- two or more selected planets always use the tour-planning flow
- for multi-planet missions, `returnToDeparture` decides whether the planner stops at the final visit body or continues with a final return leg to Earth

### Result Semantics

- `visitOrder` continues to represent only the user-requested visit bodies in optimized order
- `requiredVisitBodies` continues to exclude Earth
- `fullSequenceBodies` represents the physically solved full route, including assist bodies and the optional final Earth return
- when return is enabled, the mission result should visually read as a closed loop

## Recommended Architecture

## 1. Request Model Changes

Add `returnToDeparture: bool = False` to:

- `MissionTourRequest`
- `LaunchWindowRequest` for `missionType = "tour"`

Add the same optional field to the frontend TypeScript equivalents so form state, launch-window requests, and tour planning requests stay aligned.

The single-target `MissionRequest` does not need this field because return-enabled single-destination missions will route through the tour planner instead.

## 2. Frontend Submission Mapping

The mission form should maintain one additional piece of unified state:

- `returnToDeparture`

Submit-time branching should become:

- single selected body plus return off -> `trajectory`
- every other valid case -> `tour`

That rule preserves the current one-way single-target experience while giving return-enabled missions one consistent planning path.

## 3. Tour Planner Extension

The tour planner should keep `requiredVisitBodies` unchanged and model the return separately.

Recommended behavior:

- build the ordinary optimized visit order from the selected non-Earth bodies
- if `returnToDeparture` is false, assemble the mission exactly as today
- if `returnToDeparture` is true, append one final planning target equal to `departure_body`

This final return target is a mission-completion objective, not a user-requested visit body.

That distinction is important because:

- schema validation should still forbid Earth inside `requiredVisitBodies`
- UI copy for `visitOrder` should remain focused on selected planets
- repeated-body heuristics should not reject the final Earth return as an illegal repeated visit

## 4. Launch-Window Search Alignment

`/missions/launch-window` must carry `returnToDeparture` into the tour-window estimator.

Without that change, the app could recommend a one-way-friendly launch epoch and then fail or degrade when asked to solve the full return mission.

The tour estimate path should therefore include the same return flag used by the full solver.

## Data Model Semantics

### `requiredVisitBodies`

- unordered set of non-Earth user-selected formal visit planets
- never contains Earth

### `visitOrder`

- optimized order of the required visit planets
- never includes the final Earth return

### `fullSequenceBodies`

- full solved trajectory sequence
- begins with Earth
- may include assist bodies
- ends with Earth when `returnToDeparture = true`

### `visitEvents`

When return is enabled, the planner should include a final arrival event for Earth so the timeline and playback remain end-to-end complete.

This does not change the meaning of `visitOrder`; it only makes the physical mission completion visible in mission events.

### `closestApproach`

- when return is off, this remains the closest approach to the final selected visit body
- when return is on, the mission's final target becomes Earth, so `closestApproach.bodyId` should become `earth`

## Planner and Scoring Behavior

The return-enabled mission should gain one extra leg:

- `lastVisitedBody -> Earth`

This leg should affect:

- total flight time
- total delta-v
- candidate score
- launch-window ranking
- mission samples
- mission timeline

If no feasible final return leg can be found for a candidate sequence, that candidate should be discarded.

If all candidate sequences fail under the selected launch conditions, the endpoint should return no viable candidates and the UI should surface a clear planning failure message.

## Repeated-Body Handling

The existing `allowRepeatedFlybys` and repeated-body penalties should continue to apply to assist bodies and intermediate mission structure.

However, the final Earth return should not be rejected just because Earth was also the departure body.

Recommended rule:

- departure-body reuse for the explicit final return leg is allowed even when repeated flybys are otherwise disallowed

## Frontend Presentation

### Mission Form

Add the new toggle near the visit-selection controls so the route intent is configured alongside the planet choices.

### Mission Summary

Summary routing copy should make the optional loop obvious:

- one-way single target: `Earth -> Mars`
- return-enabled single target: `Earth -> Mars -> Earth`
- return-enabled multi-target: `Earth -> optimized route -> Earth`

The summary should prefer the physically solved sequence for display when return is enabled so the user can immediately tell whether the mission is open or closed.

### Candidate Cards

Candidate route cards should also reflect the return mode:

- `visitOrder` remains the optimized selected-body order
- `fullSequenceBodies` should show the complete route, including the final Earth return when enabled

### Scene Playback

No special scene architecture change is required.

Once the planner returns samples that include the final return leg, the existing playback controls and 3D scene should naturally continue until Earth arrival.

## Constraints

Return-enabled missions should use automatic planning.

This increment should not attempt to combine:

- user-authored heliocentric state vectors
- manual duration selection
- closed-loop return optimization

That combination would create a separate manual-mission-design workflow that is outside this change.

## Testing Strategy

### Backend

Add or update tests for:

- request schema acceptance and defaulting of `returnToDeparture`
- route planning unchanged when `returnToDeparture = false`
- return-enabled candidate generation includes a final leg back to Earth
- return-enabled `fullSequenceBodies` ends in `earth`
- return-enabled `closestApproach.bodyId` becomes `earth`
- launch-window search estimates reflect the return flag
- repeated-flyby restrictions do not falsely reject the explicit final Earth return

### Frontend

Add or update tests for:

- mission-form toggle renders and defaults to off
- single selected body plus return on submits a `tour` request
- single selected body plus return off still submits a `trajectory` request
- launch-window requests include `returnToDeparture` for tour-mode submissions
- summary and candidate route labels display the closed loop when return is enabled

### Regression Coverage

Verify that:

- existing one-way single-target missions still behave as before
- existing one-way multi-planet tours still behave as before
- return-enabled missions play through the full return to Earth

## Implementation Notes

The smallest safe path is:

1. add the new request fields and frontend toggle
2. thread the flag through launch-window and tour-planning APIs
3. extend the tour planner to optionally append the final Earth-return leg
4. update route display logic and tests

This preserves the current architecture while making return-to-Earth a real mission-planning feature instead of a display-only shortcut.
