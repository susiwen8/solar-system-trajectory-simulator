# Unified Mission Selector And Auto Routing Design

## Summary

The current mission form exposes two separate task types:

- single-target trajectory propagation
- multi-planet tour planning

This split reflects backend capabilities, but it creates an unnecessary decision for users. From the user's perspective, the real question is simpler: "Which planets do I want to visit?"

The agreed direction is to merge mission setup into a single entry flow:

- users select one or more planets from a unified visit list
- if exactly one planet is selected, the app behaves like the current single-target simulator
- if multiple planets are selected, the app behaves like the current tour planner
- users do not manually define visit order; the system automatically optimizes the sequence

This keeps the simulator easier to understand while preserving the strengths of the existing backend APIs.

## Goals

- Remove the visible task-type split from the mission form.
- Let users pick visit targets directly from a complete planet list.
- Preserve the current single-target propagation experience for one selected destination.
- Preserve the current multi-planet planning capability for multiple selected destinations.
- Make the system automatically determine visit order for multi-planet missions.
- Keep the main result view visually consistent regardless of whether the request resolved to single-target propagation or multi-planet planning.

## Non-Goals

- Merging `/missions/propagate` and `/missions/plan-tour` into one backend endpoint in this increment.
- Letting users manually reorder selected planets in this increment.
- Exposing a full route-optimization control surface beyond the existing planner defaults.
- Reworking the 3D scene architecture or playback model as part of this form unification.
- Supporting moon targets or non-planet destinations in this increment.

## Recommended Approach

Use a unified frontend selector with submit-time request branching.

The form should collect a single set of mission inputs and a single planet-selection list. On submit:

- one selected planet becomes a `MissionRequest`
- two or more selected planets become a `MissionTourRequest`

This is the best balance of clarity and risk.

It removes a confusing UI split without forcing a deeper backend merge. It also preserves the existing high-quality single-target propagation flow for the common case where the user only wants one destination.

## Alternatives Considered

### 1. Unified Selector With Submit-Time Branching

Recommended.

Pros:

- Simplest user mental model.
- Keeps current backend contracts mostly intact.
- Preserves current single-target realism and 3D behavior.
- Allows incremental implementation with low integration risk.

Cons:

- Frontend submit logic must explicitly branch by selection count.
- Some result copy must be generalized so the task-type split is no longer visible.

### 2. Unified Selector But Always Use Tour Planning

Pros:

- One dominant request path in the frontend.
- Consistent request shape for all missions.

Cons:

- Single-target missions lose the current direct propagation behavior.
- Makes the most common case feel like route planning rather than simulation.
- Risks weaker 3D continuity and higher conceptual overhead.

### 3. Keep Two Underlying Flows And Hide The Split In UI

Pros:

- Minimal backend disruption.
- Could be implemented quickly.

Cons:

- Easy to leave hidden UX inconsistencies.
- Form state can become tangled because two mental models still exist internally.
- More likely to accumulate special-case rendering and copy over time.

## User Experience Design

### Unified Task Setup

The mission form should no longer ask the user to choose a task type.

Instead, the first mission decision becomes the visit list:

- display all visitable planets in one selector
- let the user choose any number of planets except the fixed departure body
- default to a single selected example destination so first use is not empty

For this increment, Earth remains the departure body and should not appear as a selectable destination in the visit list.

### Visit Selection Behavior

The selector should show all supported planets:

- mercury
- venus
- mars
- jupiter
- saturn
- uranus
- neptune

Earth is excluded from the selectable visit list because it is already the departure body.

The UI should make multi-selection explicit. Suitable presentations include:

- checkbox chips
- a multi-select grid
- pill-style toggles

The exact visual treatment should follow existing form patterns and keep the page compact.

### Single Selection Behavior

If the user selects exactly one planet:

- the app should behave as a single-target mission
- the selected body becomes `targetBody`
- the simulator should continue to show the existing propagation, closest approach, arrival capture, and first-person scene behavior

This preserves the current high-fidelity path for the common "go to one planet" case.

### Multi Selection Behavior

If the user selects two or more planets:

- the app should behave as a multi-planet planning mission
- the selected bodies become the planner's visit set
- visit order is not user-authored
- the system automatically computes the route order

The form should communicate this clearly, for example with copy equivalent to:

- "Select planets to visit. The simulator will optimize visit order automatically."

### Validation Rules

The form should enforce:

- at least one selected planet before submit
- no duplicate selections
- no Earth in the visit list

The existing propulsion and launch controls should remain available.

## Result Presentation Design

### Unified Result Framing

The results area should stop emphasizing backend mode and instead present everything as a mission outcome.

Users should feel they are always doing the same thing:

- choose planets
- run the simulator
- inspect the proposed mission result

### Single-Target Results

When one planet is selected:

- keep the current summary and 3D scene behavior
- keep current arrival/capture handling
- keep current timeline, event, and playback semantics where already present

The copy should refer to:

- target
- visit destination
- mission result

and should avoid needing task-type labels.

### Multi-Planet Results

When multiple planets are selected:

- summarize the best computed route as the primary result
- present the optimized visit order prominently
- keep candidate switching if multiple routes are returned, but label them as mission plans or route options rather than surfacing planner-internal terminology first

The best route should be treated as the currently active mission result for the rest of the page.

### Unified Sequence Feedback

The UI should always make the resolved path visible:

- single-target: `Earth -> Mars`
- multi-target: `Earth -> optimized visit sequence`

This gives the user immediate confirmation that automatic ordering happened.

## Architecture

The implementation should separate concerns into three layers.

### 1. Unified Form State Layer

The form should maintain one user-facing mission configuration model rather than two top-level task branches.

Suggested fields:

- `selectedBodies`
- `launchEpoch`
- `trajectoryMode`
- `stateVector`
- `launchFromBody`
- `propulsionEnabled`
- `propulsionConfig`
- planner advanced defaults kept internally as needed

This keeps the UI simple and prevents mirrored state updates across two forms.

### 2. Submission Mapping Layer

A dedicated mapping step should translate unified form state into the correct backend request.

Rules:

- if `selectedBodies.length === 1`, produce `MissionRequest`
- if `selectedBodies.length >= 2`, produce `MissionTourRequest`

This branching should happen close to submit logic rather than being spread through render code.

### 3. Unified Result Consumption Layer

The page should continue to consume one "active result" object for scene rendering and summaries.

For multi-planet results:

- default the active plan to the best candidate
- use that candidate as the current scene/result context

This avoids making the main scene responsible for understanding two separate UI paradigms.

## Frontend Design Details

### Mission Form

The following visible changes are required:

- remove the mission-type dropdown
- replace the single-target planet dropdown and tour body-builder controls with one shared visit selector
- keep trajectory-mode controls for the single-target-capable branch of the unified form
- keep propulsion controls shared where possible

The multi-visit selector should be compact and scannable, since all planets will be visible at once.

### State Transitions

The form should react to selection count:

- `1 body`: show single-target-specific controls such as state-vector duration/output-step inputs where relevant
- `2+ bodies`: hide controls that only apply to direct single-target propagation and rely on planner defaults

This preserves clarity without reintroducing a mission-type toggle.

### Default Selection

The default selected body should remain Mars.

That keeps the initial experience aligned with the current app and avoids presenting an empty form as the default state.

## Backend Compatibility Strategy

The backend should remain stable in this increment.

### Preserve Existing Endpoints

Keep:

- `/missions/propagate`
- `/missions/plan-tour`

The form unification should be a frontend-layer change first.

### Preserve Existing Request Models

Keep:

- `MissionRequest`
- `MissionTourRequest`

The frontend mapper should adapt unified UI state into these existing models.

### Planner Defaults

For multi-planet requests, keep existing planner defaults unless a specific field already has a natural place in the unified form.

Examples:

- `maxAssistBodiesPerLeg`
- `maxReturnedCandidates`
- `allowAssistBodies`
- `allowRepeatedFlybys`

These can remain internal defaults for now rather than expanding the visible UI again.

## Data Flow

### Single Selection

1. User selects one planet.
2. Frontend builds `MissionRequest`.
3. Frontend calls `/missions/propagate`.
4. Response becomes the active mission result.
5. Existing scene, summary, and playback consume that result.

### Multiple Selection

1. User selects two or more planets.
2. Frontend builds `MissionTourRequest`.
3. Frontend calls `/missions/plan-tour`.
4. Frontend chooses the best returned plan as the active mission result.
5. Result summary and scene present that route as the current mission plan.

## Testing Strategy

### Form Tests

- verify the mission-type selector is removed
- verify all selectable planets are rendered in the unified visit list
- verify Earth is not selectable as a visit target
- verify single selection submits a `MissionRequest`
- verify multi selection submits a `MissionTourRequest`
- verify empty selection blocks submit

### Result Tests

- verify single-target results continue to render the current scene path
- verify multi-target results continue to render the selected best plan
- verify the resolved route sequence is visible in the summary for both single and multi selection

### Regression Tests

- preserve current single-target mission propagation behavior
- preserve current capture-orbit and first-person-scene behavior for one-body selection
- preserve candidate switching behavior for multi-planet routes if still surfaced

## Rollout Plan

### Stage 1

- introduce unified visit-selection UI
- remove mission-type selector
- implement submit-time branching by selection count

### Stage 2

- unify summary copy so task-type distinctions are less visible
- show resolved route sequence consistently across result modes

### Stage 3

- clean up legacy form state and tests tied to mission-type branching
- remove obsolete visit-builder code paths and duplicated request state

## Risks

- Hidden coupling between current single-target and tour form states may make refactoring noisier than expected.
- If too many planner-specific controls remain visible, the form can still feel like two systems stitched together.
- If multi-target results are not framed carefully, users may still perceive an unexplained jump from "simulate" to "planner output."

## Open Questions

None for this increment. The following product decisions are already resolved:

- visit order is system-optimized for multi-planet missions
- one selected planet should automatically behave like the current single-target experience
