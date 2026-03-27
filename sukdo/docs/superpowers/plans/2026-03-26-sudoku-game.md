# Sudoku Game Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished local Sudoku web game in this empty workspace with zero runtime dependencies, tested puzzle logic, and a responsive UI.

**Architecture:** Use a static single-page app with HTML, CSS, and ES modules. Keep puzzle logic, game-state transitions, and DOM rendering in separate focused files so the Sudoku engine can be tested independently with Node's built-in test runner.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in test runner, localStorage, optional local static server for manual verification

---

## Chunk 1: Project Scaffold

### Task 1: Create the lightweight project shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `src/main.js`
- Create: `src/sudoku.js`
- Create: `src/game-state.js`
- Create: `tests/sudoku.test.js`
- Create: `tests/game-state.test.js`
- Create: `README.md`

- [ ] **Step 1: Write the first failing engine test**

Add a test that expects the solver helper to fill a nearly-complete valid grid.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sudoku.test.js`
Expected: FAIL because `src/sudoku.js` does not yet provide the requested function.

- [ ] **Step 3: Write minimal engine implementation**

Create the smallest solver support needed for the first test to pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sudoku.test.js`
Expected: PASS for the first solver behavior.

## Chunk 2: Sudoku Engine

### Task 2: Expand the engine to full puzzle generation

**Files:**
- Modify: `src/sudoku.js`
- Modify: `tests/sudoku.test.js`

- [ ] **Step 1: Write failing tests for core engine behaviors**

Cover:
- `isValidPlacement`
- `solveBoard`
- `countSolutions`
- `generatePuzzle` returning a valid puzzle/solution pair

- [ ] **Step 2: Run test to verify the new cases fail**

Run: `node --test tests/sudoku.test.js`
Expected: FAIL for missing behaviors or incorrect generation output.

- [ ] **Step 3: Implement minimal generation and validation code**

Add backtracking solve/generate helpers, uniqueness checking, and puzzle carving.

- [ ] **Step 4: Run test to verify the engine passes**

Run: `node --test tests/sudoku.test.js`
Expected: PASS across all engine cases.

## Chunk 3: Game State

### Task 3: Model player interactions in state helpers

**Files:**
- Modify: `src/game-state.js`
- Modify: `tests/game-state.test.js`
- Modify: `src/sudoku.js`

- [ ] **Step 1: Write failing tests for state transitions**

Cover:
- new game creation
- selecting cells
- entering values
- toggling notes
- clearing cells
- completion detection
- reset to original puzzle

- [ ] **Step 2: Run test to verify the state tests fail**

Run: `node --test tests/game-state.test.js`
Expected: FAIL because the state helpers are incomplete.

- [ ] **Step 3: Implement minimal state transitions**

Create pure helpers that return updated state objects and compute derived UI flags.

- [ ] **Step 4: Run all tests to verify state + engine pass**

Run: `node --test`
Expected: PASS for both test files.

## Chunk 4: UI and Styling

### Task 4: Build the playable interface

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/game-state.js`

- [ ] **Step 1: Write failing state-level tests for any UI-driven logic additions**

Add tests first for keyboard movement, hint application, or persistence behavior if these require new logic.

- [ ] **Step 2: Run the targeted tests and watch them fail**

Run: `node --test`
Expected: FAIL for each newly added behavior before implementation.

- [ ] **Step 3: Implement the UI**

Build:
- responsive layout and visual identity
- 9x9 board rendering
- control panel
- keypad
- notes mode
- timer
- difficulty switching
- saved session and best times
- finish banner

- [ ] **Step 4: Re-run tests**

Run: `node --test`
Expected: PASS with the new behaviors in place.

## Chunk 5: Verification and Wrap-up

### Task 5: Verify the shipped experience

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the automated checks**

Run: `node --test`
Expected: PASS

- [ ] **Step 2: Open the app in a browser and exercise the main flows**

Verify:
- new game
- number entry
- notes mode
- hint
- reset
- completion state
- mobile-friendly layout

- [ ] **Step 3: Document how to run and test**

Add concise usage instructions to `README.md`.
