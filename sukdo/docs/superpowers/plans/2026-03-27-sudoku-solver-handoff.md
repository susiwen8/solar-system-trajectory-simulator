# Sudoku Solver Handoff Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the active game page open the solver page with the original puzzle preloaded, without transferring in-progress entries or auto-starting solve.

**Architecture:** Add a small URL-based handoff from the game page by serializing `state.puzzle` into a `puzzle` query parameter. Extend the solver page bootstrap to read and validate that parameter, preload the board and textarea when valid, and fall back cleanly when invalid. Keep shared parsing in the Sudoku engine so manual imports and URL preload use the same validation path.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in test runner, URLSearchParams

---

## Chunk 1: Handoff Behavior Tests

### Task 1: Define the game-to-solver handoff and solver preload expectations

**Files:**
- Modify: `tests/main.test.js`
- Modify: `tests/solver-main.test.js`

- [ ] **Step 1: Write the failing tests**

Cover:
- the game page updates the solver link with the serialized original puzzle
- the solver page preloads a valid `puzzle` query value without solving automatically
- the solver page falls back safely on an invalid `puzzle` query value

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `node --test tests/main.test.js tests/solver-main.test.js`
Expected: FAIL because the game page does not yet serialize a handoff URL and the solver page does not yet read query parameters.

- [ ] **Step 3: Implement the minimal code to satisfy the new tests**

Touch only the code needed to:
- serialize `state.puzzle`
- update the solver link target before navigation
- parse solver preload parameters during bootstrap

- [ ] **Step 4: Re-run the targeted tests**

Run: `node --test tests/main.test.js tests/solver-main.test.js`
Expected: PASS

- [ ] **Step 5: Commit the handoff behavior**

```bash
git add tests/main.test.js tests/solver-main.test.js index.html src/main.js src/solver-main.js
git commit -m "feat: preload solver from active puzzle"
```

## Chunk 2: Full Verification

### Task 2: Verify the integrated experience

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the full automated suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 2: Update docs only if discoverability changed materially**

If needed, note that the game page can hand off the current puzzle to the solver page.

- [ ] **Step 3: Commit any final polish**

```bash
git add README.md
git commit -m "docs: note solver handoff flow"
```
