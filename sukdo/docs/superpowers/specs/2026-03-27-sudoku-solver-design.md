# Sudoku Solver Page Design

## Goal

Add a dedicated page to this local Sudoku project where a user can input an unfinished puzzle and have the app solve it automatically, while also supporting an expandable, machine-readable solving process.

## Assumptions

- The user explicitly asked to continue with the recommended design without more approval checkpoints, so later design sections are treated as approved.
- The project should stay zero-dependency and run as a static local web app.
- The solver page should feel consistent with the current visual language instead of introducing a different framework or design system.

## Approaches Considered

### 1. Add solver mode inside the current single page

Extend the existing game page with a game/solver mode switch and reuse most of the current DOM.

Pros:
- One URL and one shell.
- Some layout pieces can be reused directly.

Cons:
- Expands the responsibility of `src/main.js`.
- Mixes game state, timer flows, and solver flows into one UI controller.

### 2. Add a separate solver page with duplicated logic

Create a new page and keep its parsing, validation, and solving logic local to that page.

Pros:
- Fast to build initially.
- Clear isolation between the game and the solver.

Cons:
- Logic drifts from the existing Sudoku engine.
- Higher maintenance cost and duplicated validation rules.

### 3. Add a separate solver page that shares the core engine

Create a new page entry point and UI module while extending the existing Sudoku engine for validation, solving status, and step recording.

Pros:
- Keeps UI concerns isolated without forking the puzzle logic.
- Fits the current static-module project structure.
- Lowest long-term maintenance risk.

Cons:
- Requires careful engine API expansion to avoid making the core module messy.

## Chosen Approach

Use a separate solver page backed by shared engine logic. The game page remains intact, while the solver page gets its own entry HTML and UI controller. Shared parsing, validation, solution counting, and step-aware solving stay in the engine layer so both pages remain consistent.

## Product Shape

The finished solver experience will include:

- A dedicated solver page linked from the existing game page.
- A 9x9 editable board for manual entry.
- A paste/import area that accepts 81-character puzzle text and tolerates spaces, newlines, separators, `0`, and `.` for blanks.
- Immediate visual conflict feedback while entering or importing a puzzle.
- A primary solve action that fills and displays the full solved board.
- A secondary expandable view that shows the solving process as ordered steps.
- Clear failure states for invalid puzzles, unsolvable puzzles, and puzzles with multiple solutions.
- Utilities for clearing the board and loading a sample puzzle.

## Architecture

### Solver page shell

`solver.html` will define the dedicated solver layout, including page navigation, board region, import area, action buttons, result summary, and step list container.

### Solver UI controller

`src/solver-main.js` will own DOM event binding and solver-page rendering. It will handle manual board edits, text import, inline validation messaging, solve/reset/sample actions, and result/step rendering.

### Shared Sudoku engine

`src/sudoku.js` will continue to be the shared engine module. It will be extended to provide:

- whole-board validation
- import-friendly board parsing helpers
- solution counting for uniqueness checks
- a step-aware solving API that returns both the solved board and a step log

If step formatting starts to blur the engine boundary, a focused helper such as `src/solver-steps.js` may be introduced to keep the solver UI output separate from the low-level search logic.

## Data Flow

1. The solver page boots with an empty 9x9 board.
2. The user either types into the board or pastes puzzle text and imports it.
3. The page normalizes input into a 9x9 numeric board.
4. Validation runs immediately and marks conflicts in the current grid state.
5. When the user clicks solve, the app re-validates the board.
6. The engine determines whether the puzzle is invalid, unsolvable, non-unique, or uniquely solvable.
7. If uniquely solvable, the UI renders the solved board as the primary result and exposes the recorded steps beneath it.

## Solving Strategy

The solver should support both quick completion and explainable output.

### Deterministic pass first

Before backtracking, the engine will repeatedly apply straightforward forced moves such as single-candidate fills. These steps become the first part of the visible explanation.

### Backtracking with traceable decisions

If forced moves are exhausted, the engine will continue with the existing search-based approach. The recorded step stream will include attempts and backtracks so the user can still inspect how the solver reached the answer.

This gives the page a practical balance:

- fast completion for the main happy path
- a readable step list for simple deductions
- honest machine-trace output for harder puzzles

## Validation and Error Handling

Validation happens at both entry time and solve time.

### Input parsing

- Reject malformed import text when it cannot be normalized into exactly 81 cells.
- Accept separators and blank markers without forcing the user to pre-clean the input.

### Grid validation

- Detect duplicate digits in the same row, column, or 3x3 box.
- Mark conflicting cells directly in the board UI.
- Show concise status text describing why the current input cannot be solved yet.

### Solve outcomes

- Invalid puzzle: refuse to solve and show the validation error.
- No solution: show that the puzzle cannot be solved.
- Multiple solutions: show that the puzzle is ambiguous and avoid presenting one arbitrary answer as definitive.
- Unique solution: render the solved board and expose the step list.

## Testing Strategy

Automated tests should stay focused on pure logic and remain runnable with `node --test`.

### Engine tests

Extend engine coverage for:

- text-to-board parsing
- whole-board validation
- unique / multiple / zero-solution detection
- step-aware solving return shape and representative step events

### Solver utility tests

If import normalization or display mapping helpers are extracted into pure functions, add direct tests for them instead of relying on manual DOM inspection.

### Manual verification

Verify in the browser:

- manual entry and keyboard clearing
- paste import with formatted text
- inline conflict highlighting
- unique-solution solve flow
- unsolvable and multi-solution messages
- step expansion
- responsive layout on narrow screens
