# Sudoku Game Design

## Goal

Build a polished, single-page Sudoku game in this empty workspace that runs locally with no external dependencies and feels complete on desktop and mobile.

## Assumptions

- The user asked for a finished product without back-and-forth, so design approval is treated as implicit.
- The game should be easy to run in a local browser and easy to verify in CI-like terminal commands.
- Since the workspace is empty, the implementation should avoid unnecessary framework setup and keep the project self-contained.

## Approaches Considered

### 1. Vanilla HTML, CSS, and ES modules

Use a small static app with focused modules for game logic, UI state, rendering, and styling.

Pros:
- Zero install required to run the game.
- Fastest path from empty directory to a working product.
- Easy to test Sudoku logic with Node's built-in test runner.

Cons:
- Requires manual structure instead of framework conventions.

### 2. Vite + React + TypeScript

Create a modern component-based app with a richer dev workflow.

Pros:
- Strong component model and tooling.
- Easy future expansion.

Cons:
- Adds dependency installation and more scaffolding to an empty project.
- Slower delivery for a self-contained game.

### 3. Canvas-based game

Render the board in canvas with custom drawing and hit testing.

Pros:
- Very flexible visuals.
- Good fit for animation-heavy games.

Cons:
- More complex accessibility and input handling.
- Overkill for a number-grid game.

## Chosen Approach

Use vanilla HTML, CSS, and ES modules. This keeps the delivery fast, readable, and dependency-light while still allowing a polished interface and solid test coverage for the puzzle engine.

## Product Shape

The finished game will include:

- A responsive 9x9 Sudoku board with clear 3x3 subgrid separation.
- Difficulty presets: easy, medium, hard.
- Puzzle generation with a valid solution and a unique playable board.
- Selection with mouse and keyboard navigation.
- Number entry, erase, notes mode, and conflict highlighting.
- Timer, completion detection, and celebratory end state.
- Hint action and quick controls for new game and reset.
- Local persistence for the active session and best times per difficulty.

## Architecture

### Core engine

`src/sudoku.js` will own puzzle generation, solving, candidate validation, and immutable board helpers. This module will be browser- and test-friendly.

### Game state

`src/game-state.js` will manage the current puzzle, notes, elapsed time, difficulty, mistake state, persistence payload, and action reducers for user input.

### UI layer

`src/main.js` will bind state to the DOM, handle events, render the board and controls, and drive celebratory transitions. `index.html` will provide semantic structure and `styles.css` will define the visual system.

## Data Flow

1. App bootstraps from saved session or creates a new puzzle.
2. User actions dispatch to state helpers.
3. State updates trigger a full rerender of the small UI surface.
4. Completed boards stop the timer, update best times, and show success messaging.

## Error Handling

- Generator retries if uniqueness or difficulty shaping fails.
- Saved-session parsing falls back to a clean new game if persisted data is invalid.
- Illegal moves are prevented at the state layer so the UI stays consistent.

## Testing Strategy

- Engine tests: solver correctness, generated puzzle validity, uniqueness, coordinate helpers.
- State tests: note toggling, move application, completion detection, reset behavior.
- Manual browser verification: keyboard controls, responsive layout, timer, persistence, and finish flow.
