# Sudoku Mini App Port Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native WeChat and native Alipay mini-program implementations of the current Sudoku game and solver while preserving shared logic and full regression coverage.

**Architecture:** Build a shared CommonJS mini-app logic layer for Sudoku engine, game state, and controller/view-model helpers, then wrap it with two native page shells: one for WeChat and one for Alipay. Keep `miniapps/shared` as the source of truth, and sync runtime copies into each mini-program root because native DevTools only bundle modules inside the project root. Keep the existing web app untouched and validate behavior primarily through Node tests over the shared layer plus file-structure assertions for the native shells.

**Tech Stack:** Native WeChat mini program, native Alipay mini program, CommonJS shared modules under `miniapps/shared`, Node built-in test runner

---

## File Map

### Create

- `miniapps/shared/package.json`
- `miniapps/shared/constants.js`
- `miniapps/shared/sudoku.js`
- `miniapps/shared/game-state.js`
- `miniapps/shared/game-view.js`
- `miniapps/shared/game-controller.js`
- `miniapps/shared/solver-view.js`
- `miniapps/shared/solver-controller.js`
- `miniapps/shared/solver-image-import.js`
- `miniapps/shared/storage.js`
- `scripts/sync-miniapp-shared.mjs`
- `miniapps/wechat/app.js`
- `miniapps/wechat/app.json`
- `miniapps/wechat/app.wxss`
- `miniapps/wechat/shared/constants.js`
- `miniapps/wechat/shared/sudoku.js`
- `miniapps/wechat/shared/game-state.js`
- `miniapps/wechat/shared/game-view.js`
- `miniapps/wechat/shared/game-controller.js`
- `miniapps/wechat/shared/solver-view.js`
- `miniapps/wechat/shared/solver-controller.js`
- `miniapps/wechat/shared/solver-image-import.js`
- `miniapps/wechat/shared/storage.js`
- `miniapps/wechat/pages/game/index.js`
- `miniapps/wechat/pages/game/index.json`
- `miniapps/wechat/pages/game/index.wxml`
- `miniapps/wechat/pages/game/index.wxss`
- `miniapps/wechat/pages/solver/index.js`
- `miniapps/wechat/pages/solver/index.json`
- `miniapps/wechat/pages/solver/index.wxml`
- `miniapps/wechat/pages/solver/index.wxss`
- `miniapps/alipay/app.js`
- `miniapps/alipay/app.json`
- `miniapps/alipay/app.acss`
- `miniapps/alipay/shared/constants.js`
- `miniapps/alipay/shared/sudoku.js`
- `miniapps/alipay/shared/game-state.js`
- `miniapps/alipay/shared/game-view.js`
- `miniapps/alipay/shared/game-controller.js`
- `miniapps/alipay/shared/solver-view.js`
- `miniapps/alipay/shared/solver-controller.js`
- `miniapps/alipay/shared/solver-image-import.js`
- `miniapps/alipay/shared/storage.js`
- `miniapps/alipay/pages/game/index.js`
- `miniapps/alipay/pages/game/index.json`
- `miniapps/alipay/pages/game/index.axml`
- `miniapps/alipay/pages/game/index.acss`
- `miniapps/alipay/pages/solver/index.js`
- `miniapps/alipay/pages/solver/index.json`
- `miniapps/alipay/pages/solver/index.axml`
- `miniapps/alipay/pages/solver/index.acss`
- `tests/miniapps/shared-sudoku.test.js`
- `tests/miniapps/shared-game-state.test.js`
- `tests/miniapps/shared-game-controller.test.js`
- `tests/miniapps/shared-solver-controller.test.js`
- `tests/miniapps/shared-solver-image-import.test.js`
- `tests/miniapps/wechat-files.test.js`
- `tests/miniapps/alipay-files.test.js`

### Modify

- `package.json`
- `README.md`

## Chunk 1: Shared Engine Baseline

### Task 1: Create the shared mini-app package boundary

**Files:**
- Create: `miniapps/shared/package.json`
- Test: `tests/miniapps/shared-sudoku.test.js`

- [ ] **Step 1: Write the failing package-loading test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('miniapps shared modules load through CommonJS', () => {
  const shared = require('../../miniapps/shared/sudoku.js');
  assert.equal(typeof shared.solveBoard, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/miniapps/shared-sudoku.test.js`
Expected: FAIL because `miniapps/shared/sudoku.js` does not exist yet.

- [ ] **Step 3: Add the CommonJS package boundary**

```json
{
  "type": "commonjs"
}
```

- [ ] **Step 4: Run test to verify the failure is now only about missing implementation**

Run: `node --test tests/miniapps/shared-sudoku.test.js`
Expected: FAIL with module/file-not-found for shared Sudoku module.

### Task 2: Port Sudoku engine behavior into shared CommonJS

**Files:**
- Create: `miniapps/shared/constants.js`
- Create: `miniapps/shared/sudoku.js`
- Test: `tests/miniapps/shared-sudoku.test.js`

- [ ] **Step 1: Write failing engine regression tests copied from the web baseline**

Include tests for:

```js
test('shared solveBoard fills a nearly complete valid grid', () => {});
test('shared generatePuzzle creates a unique solvable puzzle with difficulty clue counts', () => {});
test('shared parseBoardInput accepts formatted text and rejects malformed text', () => {});
test('shared analyzeBoard reports invalid, unsolvable, multiple-solutions, and solved states', () => {});
```

- [ ] **Step 2: Run the focused engine tests and confirm red**

Run: `node --test tests/miniapps/shared-sudoku.test.js`
Expected: FAIL because shared engine exports do not exist yet.

- [ ] **Step 3: Implement the minimal shared engine**

Port the behavior from `src/sudoku.js` into `miniapps/shared/sudoku.js`, preserving:

- board validation rules
- difficulty givens (`40/32/28`)
- solution counting short-circuit limit
- deterministic singles before traced backtracking
- `.` serialization for blanks

- [ ] **Step 4: Re-run the focused engine tests and confirm green**

Run: `node --test tests/miniapps/shared-sudoku.test.js`
Expected: PASS

## Chunk 2: Shared Game State And View Model

### Task 3: Port reducer-style game state

**Files:**
- Create: `miniapps/shared/game-state.js`
- Test: `tests/miniapps/shared-game-state.test.js`

- [ ] **Step 1: Write failing state tests mirroring the web behavior**

Cover:

- `createGameState`
- `selectCell`
- `enterDigit`
- `toggleNotesMode`
- `togglePrefillMode`
- `clearCell`
- `resetGame`
- `moveSelection`
- `applyHint`
- `locateFirstWrongPrefill`
- `tickClock`
- `createSnapshot`
- `restoreGameState`

- [ ] **Step 2: Run the state tests and confirm red**

Run: `node --test tests/miniapps/shared-game-state.test.js`
Expected: FAIL because the module does not exist or exports are incomplete.

- [ ] **Step 3: Implement the minimal shared game state**

Port the behavior from `src/game-state.js`, preserving:

- note toggling semantics
- prefill ordering
- note restoration after clearing tentative fills
- “hint selected cell first, else first editable empty” logic
- completion detection against the solved board

- [ ] **Step 4: Re-run the state tests and confirm green**

Run: `node --test tests/miniapps/shared-game-state.test.js`
Expected: PASS

### Task 4: Add shared game view-model helpers

**Files:**
- Create: `miniapps/shared/game-view.js`
- Test: `tests/miniapps/shared-game-controller.test.js`

- [ ] **Step 1: Write failing view/controller expectations**

Cover:

- fixed vs player-entry vs prefill cell flags
- selected / related / same-value / trace-origin flags
- status pill text
- completion message
- solver handoff puzzle serialization uses the original puzzle

- [ ] **Step 2: Run the controller tests and confirm red**

Run: `node --test tests/miniapps/shared-game-controller.test.js`
Expected: FAIL because the view/controller helpers do not exist yet.

- [ ] **Step 3: Implement `game-view.js` minimally**

Expose helpers similar to:

```js
function buildGamePageData(state, bestTimes) {
  return {
    cells,
    keypadDigits,
    timerText,
    bestTimeText,
    hintCountText,
    message,
    statusPill,
    solverPuzzle
  };
}
```

- [ ] **Step 4: Re-run the controller tests and confirm the remaining failures are only missing controller behavior**

Run: `node --test tests/miniapps/shared-game-controller.test.js`
Expected: FAIL only on controller-specific assertions.

## Chunk 3: Shared Game Controller And Platform Adapters

### Task 5: Implement controller-driven game page behavior

**Files:**
- Create: `miniapps/shared/storage.js`
- Create: `miniapps/shared/game-controller.js`
- Test: `tests/miniapps/shared-game-controller.test.js`

- [ ] **Step 1: Write failing controller tests**

Cover:

- restores stored session before generating a new puzzle
- persists snapshots after state-changing actions
- updates best time when a puzzle completes
- produces the correct solver navigation URL payload from `state.puzzle`
- starts and stops timer via injected scheduler hooks

- [ ] **Step 2: Run the controller tests and confirm red**

Run: `node --test tests/miniapps/shared-game-controller.test.js`
Expected: FAIL

- [ ] **Step 3: Implement the minimal controller**

Recommended shape:

```js
function createGameController(platform, options = {}) {
  return {
    init(),
    selectCell(row, col),
    enterDigit(value),
    clearCell(),
    toggleNotesMode(),
    togglePrefillMode(),
    locateFirstWrongPrefill(),
    applyHint(),
    startNewGame(difficulty),
    resetGame(),
    openSolver()
  };
}
```

- [ ] **Step 4: Re-run the controller tests and confirm green**

Run: `node --test tests/miniapps/shared-game-controller.test.js`
Expected: PASS

## Chunk 4: Shared Solver View And Controller

### Task 6: Implement solver view-model helpers and controller

**Files:**
- Create: `miniapps/shared/solver-view.js`
- Create: `miniapps/shared/solver-controller.js`
- Create: `miniapps/shared/solver-image-import.js`
- Test: `tests/miniapps/shared-solver-controller.test.js`
- Test: `tests/miniapps/shared-solver-image-import.test.js`

- [ ] **Step 1: Write failing solver controller tests**

Cover:

- empty bootstrap state
- query puzzle preload without auto-solve
- invalid preload fallback
- recognized-board import success and malformed text parse failure
- immediate conflict highlighting after import/edit
- solve result handling for invalid, unsolvable, multiple-solutions, solved
- teaching guide replay from first step to final answer
- sample load and clear actions
- step formatting text
- image recognition success and non-sudoku failure

- [ ] **Step 2: Run the solver tests and confirm red**

Run: `node --test tests/miniapps/shared-solver-controller.test.js`
Expected: FAIL

- [ ] **Step 3: Implement the minimal shared solver layer**

Preserve web semantics for:

- message copy
- step count
- solved digits rendered directly in the input board
- import normalization and error copy
- image-to-board recognition for clear Sudoku uploads
- guided replay controls over the solve timeline
- solver first screen focused on board, steps, and only the necessary actions

- [ ] **Step 4: Re-run the solver tests and confirm green**

Run: `node --test tests/miniapps/shared-solver-controller.test.js`
Expected: PASS

## Chunk 5: WeChat Native Shell

### Task 7: Create the WeChat app scaffold

**Files:**
- Create: `miniapps/wechat/app.js`
- Create: `miniapps/wechat/app.json`
- Create: `miniapps/wechat/app.wxss`
- Create: `miniapps/wechat/pages/game/index.json`
- Create: `miniapps/wechat/pages/solver/index.json`
- Test: `tests/miniapps/wechat-files.test.js`

- [ ] **Step 1: Write failing WeChat file-structure tests**

Check for:

- app-level files
- pages registered in `app.json`
- game page and solver page configs present

- [ ] **Step 2: Run the WeChat file tests and confirm red**

Run: `node --test tests/miniapps/wechat-files.test.js`
Expected: FAIL

- [ ] **Step 3: Add the minimal WeChat scaffold**

Register:

- `pages/game/index`
- `pages/solver/index`

- [ ] **Step 4: Re-run the file tests and confirm the remaining failures are about page templates/scripts**

Run: `node --test tests/miniapps/wechat-files.test.js`
Expected: FAIL only on missing page implementation details.

### Task 8: Implement the WeChat game and solver pages

**Files:**
- Create: `miniapps/wechat/pages/game/index.js`
- Create: `miniapps/wechat/pages/game/index.wxml`
- Create: `miniapps/wechat/pages/game/index.wxss`
- Create: `miniapps/wechat/pages/solver/index.js`
- Create: `miniapps/wechat/pages/solver/index.wxml`
- Create: `miniapps/wechat/pages/solver/index.wxss`
- Test: `tests/miniapps/wechat-files.test.js`

- [ ] **Step 1: Extend the WeChat file tests with failing content assertions**

Check that the game page template includes:

- board cell repeater
- keypad repeater
- difficulty buttons
- notes/prefill/hint/clear/reset/locate actions
- solver jump action

Check that the solver page template includes:

- board display
- upload-image action
- hidden canvas
- solve / sample actions
- guide replay controls
- step repeater

- [ ] **Step 2: Run the WeChat file tests and confirm red**

Run: `node --test tests/miniapps/wechat-files.test.js`
Expected: FAIL

- [ ] **Step 3: Implement the minimal WeChat pages**

Use shared controllers and inject a WeChat adapter over:

- `wx.getStorageSync`
- `wx.setStorageSync`
- `wx.navigateTo`
- `setInterval`
- `clearInterval`

- [ ] **Step 4: Re-run the WeChat file tests and confirm green**

Run: `node --test tests/miniapps/wechat-files.test.js`
Expected: PASS

## Chunk 6: Alipay Native Shell

### Task 9: Create the Alipay scaffold and pages

**Files:**
- Create: `miniapps/alipay/app.js`
- Create: `miniapps/alipay/app.json`
- Create: `miniapps/alipay/app.acss`
- Create: `miniapps/alipay/pages/game/index.js`
- Create: `miniapps/alipay/pages/game/index.json`
- Create: `miniapps/alipay/pages/game/index.axml`
- Create: `miniapps/alipay/pages/game/index.acss`
- Create: `miniapps/alipay/pages/solver/index.js`
- Create: `miniapps/alipay/pages/solver/index.json`
- Create: `miniapps/alipay/pages/solver/index.axml`
- Create: `miniapps/alipay/pages/solver/index.acss`
- Test: `tests/miniapps/alipay-files.test.js`

- [ ] **Step 1: Write failing Alipay file-structure and content tests**

Mirror the WeChat file assertions, adapted for:

- `app.acss`
- `.axml`
- `my.navigateTo`
- Alipay page registration
- image-upload solver flow

- [ ] **Step 2: Run the Alipay file tests and confirm red**

Run: `node --test tests/miniapps/alipay-files.test.js`
Expected: FAIL

- [ ] **Step 3: Implement the minimal Alipay native pages**

Use shared controllers and inject an Alipay adapter over:

- `my.getStorageSync`
- `my.setStorageSync`
- `my.navigateTo`
- `setInterval`
- `clearInterval`

- [ ] **Step 4: Re-run the Alipay file tests and confirm green**

Run: `node --test tests/miniapps/alipay-files.test.js`
Expected: PASS

## Chunk 7: Project Wiring And Verification

### Task 10: Wire the new tests into the root workflow

**Files:**
- Modify: `package.json`
- Test: `tests/miniapps/shared-sudoku.test.js`
- Test: `tests/miniapps/shared-game-state.test.js`
- Test: `tests/miniapps/shared-game-controller.test.js`
- Test: `tests/miniapps/shared-solver-controller.test.js`
- Test: `tests/miniapps/shared-solver-image-import.test.js`
- Test: `tests/miniapps/wechat-files.test.js`
- Test: `tests/miniapps/alipay-files.test.js`

- [ ] **Step 1: Write the failing integration expectation**

Confirm root `npm test` includes the new mini-app tests.

- [ ] **Step 2: Run the full suite and confirm red before wiring is complete**

Run: `npm test`
Expected: FAIL because new tests are missing or failing.

- [ ] **Step 3: Update root scripts only as needed**

Keep `node --test` as the primary runner unless a narrower include is required.

- [ ] **Step 4: Re-run the full suite and confirm green**

Run: `npm test`
Expected: PASS with existing web tests plus all new mini-app tests.

### Task 11: Document the native app entry points

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing documentation expectation mentally**

README must explain:

- where the WeChat mini program lives
- where the Alipay mini program lives
- which shared modules they consume
- how the tests cover them

- [ ] **Step 2: Update README minimally**

Add a short “原生小程序实现” section with exact paths.

- [ ] **Step 3: Run the full suite again after docs-only changes**

Run: `npm test`
Expected: PASS remains green.

## Execution Notes

- Do not commit during execution; the user explicitly asked to avoid commits before the full task is complete.
- Keep the existing web app behavior untouched unless a shared bug is discovered and fixed with explicit regression coverage.
- Prefer adding pure helper functions that can be unit-tested over hiding logic inside page lifecycles.

## Final Verification Checklist

- [ ] `npm test`
- [ ] Shared mini-app engine behavior matches the web engine on representative puzzles
- [ ] WeChat files exist and register both pages
- [ ] Alipay files exist and register both pages
- [ ] Solver handoff serializes the original puzzle only
- [ ] Solver image import and OCR fallback are covered by automated tests
- [ ] Session restore, best-time persistence, notes, prefill, and solver flows are covered by automated tests
