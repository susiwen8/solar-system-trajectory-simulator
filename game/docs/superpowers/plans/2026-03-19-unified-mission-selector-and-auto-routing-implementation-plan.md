# Unified Mission Selector And Auto Routing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible single-target/tour task split with one planet-selection workflow that automatically routes one selected body to direct propagation and multiple selected bodies to auto-ordered tour planning.

**Architecture:** Keep the existing backend endpoints and request schemas, but collapse the frontend mission form into one unified state model centered on `selectedBodies`. Submit-time branching will map unified form state to either `MissionRequest` or `MissionTourRequest`, and the existing result page will continue to consume one active mission result, defaulting to the best tour candidate when multiple planets are selected.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, FastAPI request contracts, existing app-level fetch helpers

---

## Planned File Structure

### Frontend Core

- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/styles.css`

### Frontend Tests

- Modify: `apps/web/src/App.test.tsx`
- Create or Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`

### Optional Cleanup

- Modify: `apps/web/src/lib/api.ts` only if a small helper extraction improves submit-branch readability

## Chunk 1: Unified Selection State In The Mission Form

### Task 1: Add failing form tests for the new unified visit selector

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Write failing tests for the new selector behavior**

Add tests that assert:

```tsx
it("renders a unified visit selector instead of a mission-type dropdown", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.queryByLabelText("任务类型")).not.toBeInTheDocument();
  expect(screen.getByText("拜访星球")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "火星" })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "地球" })).not.toBeInTheDocument();
});

it("starts with mars selected by default", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByRole("checkbox", { name: "火星" })).toBeChecked();
});
```

- [ ] **Step 2: Run the focused form test to verify it fails**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL because the current form still renders the mission-type dropdown and split form paths.

- [ ] **Step 3: Refactor the form state around `selectedBodies`**

Update `apps/web/src/features/mission/components/MissionForm.tsx` to:

- remove `missionType`
- remove the visible single-target/tour form branching as the top-level interaction
- introduce a unified selection state such as `selectedBodies: Exclude<BodyId, "earth">[]`
- keep Mars selected by default
- render a compact multi-select control listing all visitable planets except Earth

Keep the first implementation focused on selection state and rendering. Do not implement submit branching yet.

- [ ] **Step 4: Re-run the focused form test**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx
git commit -m "feat: add unified planet visit selector"
```

### Task 2: Add unified form copy and compact visit-selector styling

**Files:**
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Add failing copy/style assertions**

Add checks such as:

```tsx
expect(screen.getByText("拜访星球")).toBeInTheDocument();
expect(screen.getByText("系统将自动优化访问顺序")).toBeInTheDocument();
```

If the test file already covers visible copy, extend that test rather than creating a new one.

- [ ] **Step 2: Run the focused form test to verify it fails**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL because the new unified copy and helper text do not exist yet.

- [ ] **Step 3: Implement compact unified selector copy and layout**

Update:

- `apps/web/src/lib/i18n.ts`
- `apps/web/src/styles.css`
- `apps/web/src/features/mission/components/MissionForm.tsx`

Add:

- a new label for the visit selector
- a short helper line indicating that order is system-optimized
- checkbox-chip or pill-toggle styling that fits the current form design

Do not reintroduce a mission-type control.

- [ ] **Step 4: Re-run the focused form test**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/i18n.ts apps/web/src/styles.css apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx
git commit -m "feat: add unified mission selector copy and layout"
```

## Chunk 2: Submit-Time Request Branching

### Task 3: Add failing tests for one-body vs multi-body submit routing

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Modify: `apps/web/src/features/mission/types.ts`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Write failing tests for submit branching**

Add tests like:

```tsx
it("submits a trajectory request when exactly one body is selected", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="zh" loading={false} />);

  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(onSubmit).toHaveBeenCalledWith({
    kind: "trajectory",
    request: expect.objectContaining({ targetBody: "mars" }),
  });
});

it("submits a tour request when multiple bodies are selected", async () => {
  const onSubmit = vi.fn();
  render(<MissionForm onSubmit={onSubmit} language="zh" loading={false} />);

  await userEvent.click(screen.getByRole("checkbox", { name: "金星" }));
  await userEvent.click(screen.getByRole("button", { name: "计算轨迹" }));

  expect(onSubmit).toHaveBeenCalledWith({
    kind: "tour",
    request: expect.objectContaining({ requiredVisitBodies: expect.arrayContaining(["mars", "venus"]) }),
  });
});
```

- [ ] **Step 2: Run the focused form test to verify it fails**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL because the form still uses separate request states and cannot derive request kind from selection count.

- [ ] **Step 3: Introduce a unified submission mapping**

Update `apps/web/src/features/mission/components/MissionForm.tsx` and `apps/web/src/features/mission/types.ts` to:

- keep `MissionSubmission` as the output contract
- derive `MissionRequest` when exactly one body is selected
- derive `MissionTourRequest` when two or more bodies are selected
- prevent submit when no destination body is selected

The single-target request should continue to use the existing `trajectoryMode` and state-vector/auto-transfer fields.
The multi-target request should use selected bodies as `requiredVisitBodies` and existing planner defaults for the rest.

- [ ] **Step 4: Re-run the focused form test**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx apps/web/src/features/mission/types.ts
git commit -m "feat: branch mission requests from unified selection count"
```

### Task 4: Hide or disable controls that only make sense for multi-planet planning

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Add failing UI tests for conditional controls**

Add assertions like:

```tsx
it("shows direct-propagation controls for one selected destination", () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  expect(screen.getByLabelText("轨迹模式")).toBeInTheDocument();
});

it("hides direct-propagation-only controls when multiple destinations are selected", async () => {
  render(<MissionForm onSubmit={vi.fn()} language="zh" loading={false} />);

  await userEvent.click(screen.getByRole("checkbox", { name: "金星" }));

  expect(screen.queryByLabelText("轨迹模式")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused form test to verify it fails**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL because the current unified form does not yet conditionally simplify controls by selection count.

- [ ] **Step 3: Implement selection-count-dependent form sections**

Update `MissionForm.tsx` so that:

- one selected destination keeps single-target controls such as trajectory mode and state-vector-specific inputs
- multiple selected destinations hide direct-propagation-only controls and rely on planner defaults
- shared controls such as launch epoch and propulsion remain available

Keep the render logic compact and avoid reintroducing top-level mission-type branches.

- [ ] **Step 4: Re-run the focused form test**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx
git commit -m "feat: adapt mission controls to selection count"
```

## Chunk 3: Unified App-Level Result Handling

### Task 5: Add failing app tests for unified form submission and best-plan activation

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing app tests for API branching**

Add tests that verify:

- one selected body causes a call to `/missions/propagate`
- multiple selected bodies cause a call to `/missions/plan-tour`
- the best returned tour result is surfaced as the active result without requiring a visible mission-type distinction

Example direction:

```tsx
expect(fetchSpy).toHaveBeenCalledWith("/missions/propagate", expect.anything());
expect(fetchSpy).toHaveBeenCalledWith("/missions/plan-tour", expect.anything());
expect(await screen.findByText("地球 -> 金星 -> 火星")).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused app tests to verify they fail**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: FAIL because the current app still depends on the explicit `kind` split coming from the old form model and may not yet expose unified route copy.

- [ ] **Step 3: Update app-level submit handling and active-result framing**

Modify `apps/web/src/App.tsx` to:

- continue to honor `MissionSubmission.kind`
- keep current endpoint calls but assume the form is now responsible for producing the correct kind
- preserve the best-candidate-as-active-result behavior for multi-body planning
- update any visible framing copy that still implies separate mission modes if the file owns it

Keep this task focused on app orchestration, not form rendering.

- [ ] **Step 4: Re-run the focused app tests**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat: unify mission result handling across route sizes"
```

### Task 6: Surface resolved visit sequence consistently in summaries and candidate cards

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/mission/components/MissionSummary.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add failing result-copy tests**

Add assertions such as:

```tsx
expect(await screen.findByText("地球 -> 火星")).toBeInTheDocument();
expect(await screen.findByText("地球 -> 金星 -> 火星 -> 土星")).toBeInTheDocument();
```

If the current summary component owns the route display, target the exact copy there instead.

- [ ] **Step 2: Run the focused app tests to verify they fail**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: FAIL because the resolved sequence is not yet surfaced consistently across single- and multi-body results.

- [ ] **Step 3: Implement unified route-sequence presentation**

Update `App.tsx` and/or `MissionSummary.tsx` to:

- show `Earth -> targetBody` for single-target results
- show `Earth -> optimized visit order` for multi-target results
- keep candidate cards aligned with that presentation so users understand automatic ordering happened

Avoid introducing new mode labels such as "single target" or "tour".

- [ ] **Step 4: Re-run the focused app tests**

Run: `cd apps/web && npm test -- --run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/features/mission/components/MissionSummary.tsx apps/web/src/App.test.tsx
git commit -m "feat: show unified visit sequence across mission results"
```

## Chunk 4: Cleanup And Full Regression

### Task 7: Remove legacy split-form code paths and dead copy

**Files:**
- Modify: `apps/web/src/features/mission/components/MissionForm.tsx`
- Modify: `apps/web/src/features/mission/types.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`

- [ ] **Step 1: Add a cleanup guard test if needed**

If the test file does not already cover it, add a simple regression assertion:

```tsx
expect(screen.queryByText("单目标任务")).not.toBeInTheDocument();
expect(screen.queryByText("多星球巡游")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused form test to verify it fails or is at risk**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: FAIL or expose remaining legacy UI strings/branches.

- [ ] **Step 3: Remove dead split-form state and unused copy**

Clean up:

- old mission-type state
- duplicated tour/trajectory top-level request state if still present
- unused mission-type labels from `i18n`
- obsolete helper functions for the removed add/remove visit builder UI

Do not remove any backend request types.

- [ ] **Step 4: Re-run the focused form test**

Run: `cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/types.ts apps/web/src/lib/i18n.ts apps/web/src/features/mission/components/MissionForm.test.tsx
git commit -m "refactor: remove legacy split mission form paths"
```

### Task 8: Run full frontend regression for the unified mission flow

**Files:**
- Test: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/features/mission/components/MissionForm.test.tsx`
- Test: additional focused scene tests if touched during implementation

- [ ] **Step 1: Run the unified form and app test suites**

Run:

```bash
cd apps/web && npm test -- --run src/features/mission/components/MissionForm.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run any additional focused regression tests for touched scene/result files**

Run, if relevant:

```bash
cd apps/web && npm test -- --run src/features/scene/lib/arrival-capture.test.ts src/features/scene/lib/focus-visuals.test.ts
```

Expected: PASS.

- [ ] **Step 3: Manually verify both request paths in the browser**

Run:

```bash
cd apps/api && uv run uvicorn app.main:app --reload
cd apps/web && npm run dev
```

Manual checks:

- select exactly one destination and confirm direct propagation still works
- select multiple destinations and confirm the planner returns an optimized route
- confirm the form never asks for task type
- confirm the result page shows a resolved route sequence in both cases

- [ ] **Step 4: Commit the final integrated change**

```bash
git add apps/web/src/features/mission/components/MissionForm.tsx apps/web/src/features/mission/components/MissionForm.test.tsx apps/web/src/features/mission/types.ts apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/features/mission/components/MissionSummary.tsx apps/web/src/lib/i18n.ts apps/web/src/styles.css
git commit -m "feat: unify mission selection and auto-route multi-planet visits"
```

## Notes For Execution

- Keep backend endpoints unchanged in this increment.
- Prefer small commits after each task so regressions are easy to isolate.
- Do not reintroduce a visible mission-type toggle during refactors.
- Preserve current single-target capture-orbit and first-person-scene behavior when exactly one body is selected.
