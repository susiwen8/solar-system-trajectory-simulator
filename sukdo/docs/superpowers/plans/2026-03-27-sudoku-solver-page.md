# Sudoku Solver Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated solver page that accepts manual board input and pasted puzzle text, validates the puzzle, solves unique puzzles automatically, and exposes an expandable step log.

**Architecture:** Keep the existing game page intact and add a separate `solver.html` entry point with its own UI controller. Extend the shared Sudoku engine with parsing, validation, uniqueness, and step-aware solving APIs, and keep UI-only formatting in focused solver-page helpers so logic remains testable with Node's built-in runner.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in test runner, local static server

---

## Chunk 1: Shared Engine APIs

### Task 1: Add import parsing and board validation helpers

**Files:**
- Modify: `src/sudoku.js`
- Modify: `tests/sudoku.test.js`

- [ ] **Step 1: Write the failing engine tests**

Cover:
- parsing formatted puzzle text into a 9x9 board
- rejecting malformed import text
- reporting row, column, and box conflicts for an invalid board

- [ ] **Step 2: Run the engine tests to verify the new cases fail**

Run: `node --test tests/sudoku.test.js`
Expected: FAIL because the new parser and validator APIs do not exist yet.

- [ ] **Step 3: Write the minimal engine implementation**

Add focused helpers such as:
- `parseBoardInput(text)`
- `validateBoard(board)`
- any small internal helpers needed for conflict collection

- [ ] **Step 4: Re-run the engine tests**

Run: `node --test tests/sudoku.test.js`
Expected: PASS for the new parsing and validation cases.

- [ ] **Step 5: Commit the shared validation API**

```bash
git add tests/sudoku.test.js src/sudoku.js
git commit -m "feat: add sudoku solver validation helpers"
```

## Chunk 2: Step-Aware Solving

### Task 2: Extend the solver to return solve status and step traces

**Files:**
- Modify: `src/sudoku.js`
- Modify: `tests/sudoku.test.js`

- [ ] **Step 1: Write the failing tests for solve outcomes**

Cover:
- uniquely solvable puzzle returns solved board plus ordered steps
- unsolvable puzzle returns an explicit no-solution status
- ambiguous puzzle returns a multiple-solutions status
- deterministic single-candidate fills appear in the step list before search backtracking entries when available

- [ ] **Step 2: Run the engine tests to verify the new solve-output cases fail**

Run: `node --test tests/sudoku.test.js`
Expected: FAIL because the engine still only returns the solved board.

- [ ] **Step 3: Implement the minimal step-aware solving API**

Add a higher-level API such as `analyzeBoard(board)` or `solveBoardWithSteps(board)` that:
- validates the incoming board
- counts solutions
- solves unique boards
- records forced-fill, guess, and backtrack events in a stable structure

- [ ] **Step 4: Re-run the engine tests**

Run: `node --test tests/sudoku.test.js`
Expected: PASS for both the old engine behaviors and the new solve-status behaviors.

- [ ] **Step 5: Commit the step-aware solving API**

```bash
git add tests/sudoku.test.js src/sudoku.js
git commit -m "feat: add traced sudoku solver results"
```

## Chunk 3: Solver Page Logic

### Task 3: Add pure solver-page helpers for import and message mapping

**Files:**
- Create: `src/solver-view.js`
- Create: `tests/solver-view.test.js`
- Modify: `src/sudoku.js`

- [ ] **Step 1: Write the failing helper tests**

Cover:
- converting a board into board-cell view data with conflict flags
- mapping solve statuses into user-facing messages
- formatting step events into readable Chinese copy

- [ ] **Step 2: Run the targeted helper tests to verify they fail**

Run: `node --test tests/solver-view.test.js`
Expected: FAIL because the solver-page helper module does not exist yet.

- [ ] **Step 3: Implement the minimal helper module**

Create a small pure module that keeps display mapping separate from DOM code.

- [ ] **Step 4: Re-run the helper tests**

Run: `node --test tests/solver-view.test.js`
Expected: PASS

- [ ] **Step 5: Commit the solver-page helper module**

```bash
git add tests/solver-view.test.js src/solver-view.js
git commit -m "feat: add solver view helpers"
```

## Chunk 4: Solver Page UI

### Task 4: Build the new page, DOM controller, and navigation entry points

**Files:**
- Create: `solver.html`
- Create: `src/solver-main.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `README.md`

- [ ] **Step 1: Write any missing pure tests before DOM work**

If the UI needs additional extracted logic for keyboard editing or import normalization, add those tests first in `tests/solver-view.test.js`.

- [ ] **Step 2: Run the full automated suite before DOM edits**

Run: `node --test`
Expected: PASS so the new UI work starts from a clean baseline.

- [ ] **Step 3: Implement the solver page**

Build:
- a dedicated solver page shell and navigation
- editable 9x9 board input
- paste/import textarea
- solve, clear, and sample actions
- solved-board rendering
- expandable step list
- inline conflict highlighting
- responsive layout consistent with the existing visual system

- [ ] **Step 4: Re-run all automated tests**

Run: `node --test`
Expected: PASS with the new page and helper logic in place.

- [ ] **Step 5: Commit the solver page UI**

```bash
git add solver.html index.html styles.css src/solver-main.js src/solver-view.js tests/solver-view.test.js README.md
git commit -m "feat: add sudoku solver page"
```

## Chunk 5: Verification

### Task 5: Verify the shipped solver experience

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the automated checks**

Run: `node --test`
Expected: PASS

- [ ] **Step 2: Run the app locally and manually verify the solver flows**

Run: `npm start`
Verify:
- game page still loads
- solver page loads
- manual entry works
- pasted imports normalize correctly
- invalid boards show conflict feedback
- unique puzzles solve correctly
- unsolvable and ambiguous cases show distinct messages
- step expansion works on desktop and mobile widths

- [ ] **Step 3: Finalize the usage docs if needed**

Update `README.md` so both the game page and the solver page are discoverable.
