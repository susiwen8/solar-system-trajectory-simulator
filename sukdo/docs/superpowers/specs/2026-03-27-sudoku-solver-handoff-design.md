# Sudoku Solver Handoff Design

## Goal

Let the user jump from the active game page to the solver page while carrying over the original puzzle only, so the solver page can preload that puzzle without auto-solving it.

## Assumptions

- The user wants to carry the starting puzzle, not the current in-progress board state.
- The solver page should preload the puzzle and wait for the user to click solve.
- The navigation should replace the current page instead of opening a new tab.

## Approaches Considered

### 1. Encode the puzzle in the solver URL

Serialize the original puzzle into an 81-character string and navigate to `solver.html?puzzle=...`.

Pros:
- Explicit and easy to debug.
- No hidden cross-page temporary state.
- The link itself fully describes the preloaded puzzle.

Cons:
- Adds a query parameter to the URL.

### 2. Use temporary storage for cross-page handoff

Write the puzzle into `sessionStorage` or `localStorage`, then let the solver page read and clear it.

Pros:
- Cleaner URL.

Cons:
- Adds lifecycle and cleanup complexity.
- Harder to reason about if multiple handoffs happen.

### 3. Read the current game session directly from the solver page

Let the solver page inspect the saved game session and extract the puzzle on load.

Pros:
- Small initial code change.

Cons:
- Couples the solver page to game-session storage.
- Makes standalone solver visits behave inconsistently.

## Chosen Approach

Use URL-based handoff. The game page will serialize `state.puzzle` only and navigate to the solver page with a `puzzle` query parameter. The solver page will read that parameter during boot and preload the board without triggering solve automatically.

## Architecture

### Game page handoff

`src/main.js` will expose a small helper that converts the current puzzle into a compact URL-safe string and updates the solver link target before navigation.

### Solver page preload

`src/solver-main.js` will parse the `puzzle` query parameter during startup. If it is valid, it will initialize the solver board and textarea from that puzzle. If it is invalid, it will keep the empty board and show a clear message.

### Shared validation

The existing Sudoku parsing helper in `src/sudoku.js` should remain the single source of truth for validating imported puzzle strings so URL preloads and manual imports behave consistently.

## Data Flow

1. The user plays on the game page.
2. They click the solver handoff action.
3. The game page serializes `state.puzzle` only.
4. The browser navigates to `solver.html?puzzle=<81-cell-string>`.
5. The solver page reads the query parameter during initialization.
6. If parsing succeeds, it preloads the input board and textarea.
7. The page stays idle until the user clicks solve.

## Error Handling

- Invalid or malformed `puzzle` query values should not break page load.
- On invalid query input, the solver page should fall back to an empty board and show a concise preload failure message.
- Notes, tentative fills, elapsed time, and other game-only state must not be transferred.

## Testing Strategy

Add coverage for:

- serializing the original puzzle for solver navigation
- solver-page preload from a valid query parameter
- no auto-solve on preload
- graceful fallback on invalid query parameters
