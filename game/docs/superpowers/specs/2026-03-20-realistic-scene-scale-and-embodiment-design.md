# Realistic Scene Scale And Embodiment Design

> Status: proposed
> Date: 2026-03-20
> Branch: `codex/mission-dynamics-realism`

## Goal

Rebuild the 3D probe scene so it feels closer to real deep-space flight:

- planets use real radius data rather than hand-tuned display sizes
- the probe becomes much smaller relative to planets
- the main view feels like an embodied probe-adjacent first-person perspective instead of a persistent overview
- deep space remains visually empty most of the time
- current targets stay perceptible through light visual guidance rather than unrealistic enlargement

## User Decisions

- Use `near-field real scale + far-field compressed distance`, not fully literal solar-system scale.
- Keep a single probe model for now, using a realistic medium-class deep-space probe baseline.
- Favor `moderate target guidance`: preserve emptiness, but lightly enhance the current target so users can still orient themselves.

## Problem Summary

The current scene mixes a single linear distance scale with hand-authored body radii and a visually enlarged probe. That helps readability, but it breaks physical intuition:

- planets are too similar in size to the probe
- near-body encounters do not feel large or overwhelming enough
- cruise scenes still inherit some overview-style readability instead of deep-space emptiness
- body size and body distance are manipulated by the same scene scale, so realism and clarity cannot be tuned independently

## Non-Goals

This design does not include:

- multiple probe classes or mission-specific spacecraft meshes
- photoreal planetary surfaces or terrain
- physically accurate star brightness, exposure adaptation, or sensor bloom
- cockpit UI or VR mode
- changes to mission mechanics, propagation physics, or launch-window scoring

## Design Principles

1. `Size is real.` Physical body radius and probe dimensions should come from real-world data or a declared baseline.
2. `Distance is readable.` Long-range separation can be compressed if it preserves target awareness and deep-space emptiness.
3. `Near-field truth wins.` Once the probe is in approach, flyby, or capture range, relative scale should stay as physically faithful as possible.
4. `Enhancement should guide, not lie.` Focus halos, atmospheres, and visual emphasis can support perception, but should not fake near-field body scale.
5. `The overview is secondary.` The main canvas should communicate embodiment; the inset trajectory view should communicate global context.

## Current Code Constraints

The current scene architecture has three relevant characteristics:

1. `apps/web/src/features/scene/lib/scale.ts` applies a single global linear distance conversion.
2. `apps/web/src/features/scene/components/SolarSystemScene.tsx` defines hand-tuned `bodyRadii` values directly in the scene component.
3. `apps/web/src/features/scene/lib/probe-model.ts` uses a fixed visual scale that keeps the probe much larger than a realistic body-relative proportion.

Those choices make the scene easy to tune quickly, but they prevent independent control of:

- physical size
- displayed distance
- cinematic readability

## Proposed Architecture

Introduce a scene-scaling model with separate responsibilities:

### 1. Physical Radius Registry

Create a dedicated radius source for all major bodies rendered in the 3D scene.

- Store physical equatorial or mean body radii in kilometers for the Sun and planets.
- Replace the inline `bodyRadii` display table in `SolarSystemScene.tsx`.
- Keep ring data as a separate visual profile layer so Saturn remains ringed without contaminating radius truth.

This registry becomes the single source of truth for:

- planet mesh radius
- near-field encounter framing
- probe-to-body apparent scale comparisons
- future safety-distance or visibility heuristics

### 2. Probe Physical Baseline

Replace the current enlarged probe display constant with a declared medium-class deep-space probe baseline.

Recommended baseline:

- bus diameter on the order of `2-4 m`
- solar-span style overall width on the order of `10-20 m`
- rendered silhouette tuned to remain recognizable without exceeding plausible dimensions

The important outcome is not one exact mission reference, but that the probe is unmistakably tiny next to planets.

### 3. Layered Distance Mapping

Replace the single `scaleDistanceKm(...)` mapping with a layered scene-distance model:

- `near-field zone`
  Use an approximately linear mapping around the active focus body and probe.
  This preserves believable local geometry during flyby, orbit insertion, and parking orbit.

- `transition zone`
  Smoothly bend from near-linear to compressed mapping.
  This avoids sudden spatial jumps when moving between cruise and encounter contexts.

- `far-field zone`
  Apply non-linear compression to large interplanetary distances.
  This keeps the target direction and system layout readable in the main scene without pretending that distant planets are nearby.

The compression applies to `distance from the current view focus`, not to physical radius.

### 4. Focus-Centered Rendering Frame

Anchor scene distance mapping to the current embodied context:

- during cruise, map distances relative to the probe and current mission target
- during flyby, map relative to the flyby body
- during arrival capture and parking orbit, map relative to the destination body

This preserves a stable and believable first-person experience while still allowing distant context bodies to remain lightly visible.

## Scene Behavior

### Cruise

Cruise should feel sparse and quiet.

- the target body may be visible, but usually small
- stars and empty space dominate the frame
- no artificial planet enlargement should make cruise look like a nearby encounter
- current target may receive subtle help through glow, halo, edge contrast, or framing bias

Desired feeling:

- “I am crossing a very large empty space”
- not “I am always close to a destination”

### Flyby

During `flybyEncounter` segments:

- preserve physical size contrast between probe and body
- allow the planet disk to grow dramatically as periapsis approaches
- keep the camera close to the probe and let the body dominate the frame naturally
- do not compensate by scaling the probe up

The body should feel huge because it is huge, not because the probe camera pulls far away.

### Arrival Capture And Orbit

During `arrivalHyperbolicApproach`, `orbitInsertionBurn`, and `parkingOrbit`:

- treat the destination body as the active near-field anchor
- preserve the real radius relationship between the planet and the parking-orbit geometry
- let orbital motion visually hug the body in a way that feels physically bound

This should make capture feel like entering the body’s environment rather than hovering around a decorative sphere.

## Camera Design

### Default View

Keep the existing probe-follow concept, but tighten it into a probe-adjacent embodied framing:

- camera remains close behind and slightly above the probe
- camera motion should prioritize the probe’s instantaneous forward direction
- the view should no longer read as an elevated bird’s-eye control camera

### Encounter Adaptation

Allow limited camera retreat only when required for usability:

- if the active body would fully overwhelm the frame or clip badly, the camera can ease backward
- this retreat must be constrained and state-aware
- the retreat changes viewpoint, not physical scale

### User-Controlled Rotation

Existing orbit/rotation controls should continue working, but around the embodied camera frame rather than around a distant overview anchor.

The user should be able to look around near the probe while still feeling attached to it.

## Visual Guidance Rules

Moderate target guidance should be implemented with soft cues, ordered from safest to most invasive:

1. directional framing bias
2. subtle emissive lift or atmospheric rim
3. focus-body halo tuned by context
4. optional low-strength edge or contrast enhancement

Avoid:

- scaling distant target bodies up
- adding oversized labels in the main 3D area
- forcing the target to remain centered at all times

## UI Impact

### Main Scene

The main scene becomes the primary experiential layer.

- keep the scene visually clean
- avoid reintroducing dense overlay cards
- preserve only lightweight context that does not compete with embodiment

### Inset Map

The right-top inset remains important, but only as a navigation aid.

Responsibilities:

- show the global route and body relationship
- help users understand overall mission progress
- compensate for the intentional ambiguity of a realistic first-person main view

The inset should not drive sizing rules for the main scene.

## Data And Constants

### New Data Sources

Add scene-side constants for:

- body physical radii in kilometers
- probe physical baseline dimensions
- near-field / transition / far-field compression thresholds
- per-context focus visibility tuning values

### Derived Runtime Values

Compute at runtime:

- displayed scene radius from physical radius
- displayed scene distance from compressed focus-relative mapping
- minimum visible thresholds for tiny but nearby geometry
- camera retreat bounds based on active body radius and current encounter mode

## Compatibility Strategy

This should remain compatible with current mission outputs.

- No backend response shape changes are required.
- Existing segment types continue to drive proximity, focus, and camera state.
- The scene consumes existing body positions and mission segment metadata, but interprets them through the new scaling model.

## Testing Strategy

### Unit Tests

Add or update tests for:

- real-radius registry correctness
- non-linear distance mapping behavior across near, transition, and far zones
- probe visual scale remaining much smaller than emphasized planets
- near-field rendering preserving believable body dominance during flyby/capture
- focus guidance remaining additive rather than scale-distorting

### Scene Regression Tests

Update scene tests to assert:

- Saturn remains ringed while non-ring planets remain ringless
- capture-path rendering still remains outside the body silhouette
- flyby framing and orbit framing use the new scale model without clipping

### Manual Verification

Manual review should confirm:

- cruise feels emptier than today
- Mars / Jupiter / Saturn encounters feel much larger and more physically imposing
- the probe no longer looks comparable in size to planets
- the inset still provides adequate navigational context

## Risks

### Risk: Too Realistic Means Too Empty

If far-field compression is too weak, users may feel the scene is visually blank.

Mitigation:

- keep moderate target guidance
- test multiple compression thresholds
- validate against both inner-planet and outer-planet encounters

### Risk: Near-Field Clipping Or Camera Jitter

Large real radii can destabilize camera framing if the camera tries to remain too close during encounters.

Mitigation:

- bound camera retreat logic
- smooth transitions between cruise and encounter framing
- test around periapsis and orbit insertion

### Risk: Mixed Scaling Feels Inconsistent

If the transition between near-linear and compressed distance is abrupt, users may feel the scene “warps.”

Mitigation:

- use smooth interpolation rather than hard threshold switching
- anchor compression to the active focus context

## Success Criteria

This work is successful when:

1. the probe is visibly tiny relative to planets in encounter scenes
2. planetary size ordering looks physically plausible at a glance
3. cruise scenes feel mostly empty, not like disguised overview scenes
4. near-body encounters feel dramatic because of body scale, not UI exaggeration
5. users can still maintain orientation through subtle guidance and the inset route view

## Recommended Implementation Order

1. Extract radius and probe-scale constants into dedicated scene libraries.
2. Replace the current single distance scale with a focus-relative compression utility.
3. Update body mesh creation to use real radii and keep Saturn-only rings.
4. Re-tune probe visual scale and camera retreat behavior.
5. Update scene tests and manual verification scenarios for cruise, flyby, and capture.
