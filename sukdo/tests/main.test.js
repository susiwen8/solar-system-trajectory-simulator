import test from 'node:test';
import assert from 'node:assert/strict';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) {
        this.values.delete(name);
      } else {
        this.values.add(name);
      }

      return this.values.has(name);
    }

    if (force) {
      this.values.add(name);
      return true;
    }

    this.values.delete(name);
    return false;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.innerHTML = '';
    this.textContent = '';
    this.href = '';
    this.listeners = {};
    this.classList = new FakeClassList();
  }

  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }

  querySelectorAll() {
    return [];
  }
}

function getButtonClassNames(boardMarkup, label) {
  const buttons = boardMarkup.match(/<button[\s\S]*?<\/button>/g) ?? [];
  const target = buttons.find((button) => button.includes(`aria-label="${label}"`));
  const match = target?.match(/class="([^"]+)"/);

  return match?.[1] ?? '';
}

function createSessionSnapshot(overrides = {}) {
  const solution = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];

  return {
    difficulty: 'medium',
    puzzle: Array.from({ length: 9 }, () => Array(9).fill(0)),
    solution,
    board: Array.from({ length: 9 }, () => Array(9).fill(0)),
    notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [])),
    notesMode: false,
    completed: false,
    elapsedSeconds: 0,
    hintsUsed: 0,
    selectedCell: { row: 0, col: 0 },
    ...overrides
  };
}

function createHarness(options = {}) {
  const selectors = {};
  const difficultyButtons = ['easy', 'medium', 'hard'].map(
    (difficulty) => new FakeElement({ difficulty })
  );

  selectors['#board'] = new FakeElement();
  selectors['#keypad'] = new FakeElement();
  selectors['#timer'] = new FakeElement();
  selectors['#best-time'] = new FakeElement();
  selectors['#hint-count'] = new FakeElement();
  selectors['#difficulty-label'] = new FakeElement();
  selectors['#status-pill'] = new FakeElement();
  selectors['#message'] = new FakeElement();
  selectors['#solver-link'] = new FakeElement();
  selectors['#notes-toggle'] = new FakeElement();
  selectors['#prefill-toggle'] = new FakeElement();
  selectors['#locate-prefill'] = new FakeElement();
  selectors['#hint-button'] = new FakeElement();
  selectors['#clear-button'] = new FakeElement();
  selectors['#reset-button'] = new FakeElement();
  selectors['#difficulty-buttons'] = new FakeElement();
  selectors['#difficulty-buttons'].querySelectorAll = () => difficultyButtons;

  const windowListeners = {};

  global.document = {
    querySelector(selector) {
      return selectors[selector] ?? null;
    }
  };

  const store = new Map();
  if (options.session) {
    store.set('sukdo.session', JSON.stringify(options.session));
  }

  global.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    }
  };

  global.window = {
    addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
    setInterval() {
      return 1;
    }
  };

  return {
    selectors,
    store,
    windowListeners
  };
}

test('main.js bootstraps the app and wires primary controls', async () => {
  const { selectors } = createHarness();

  await import(`../src/main.js?test=${Date.now()}`);

  assert.match(selectors['#board'].innerHTML, /data-row="0"/);
  assert.equal((selectors['#board'].innerHTML.match(/data-row="/g) ?? []).length, 81);
  assert.match(selectors['#keypad'].innerHTML, /data-digit="9"/);
  assert.equal(selectors['#difficulty-label'].textContent.length > 0, true);

  selectors['#notes-toggle'].listeners.click[0]();

  assert.equal(selectors['#status-pill'].textContent, '笔记模式');
  assert.equal(selectors['#notes-toggle'].classList.contains('primary'), true);

  selectors['#prefill-toggle'].listeners.click[0]();

  assert.equal(selectors['#status-pill'].textContent, '试填模式');
  assert.equal(selectors['#prefill-toggle'].classList.contains('primary'), true);
});

test('main.js does not mark a legal-but-wrong guess as a conflict', async () => {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  board[0][0] = 4;

  const { selectors } = createHarness({
    session: createSessionSnapshot({
      board
    })
  });

  await import(`../src/main.js?test=${Date.now()}-no-answer-leak`);

  assert.doesNotMatch(selectors['#board'].innerHTML, /conflict/);
});

test('main.js also avoids conflict hints for duplicate guesses during play', async () => {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  board[0][0] = 4;
  board[0][1] = 4;

  const { selectors } = createHarness({
    session: createSessionSnapshot({
      board
    })
  });

  await import(`../src/main.js?test=${Date.now()}-real-conflict`);

  assert.doesNotMatch(selectors['#board'].innerHTML, /conflict/);
});

test('main.js distinguishes player-entered digits and highlights matching values from the selected digit', async () => {
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  puzzle[0][0] = 5;
  board[0][0] = 5;
  board[2][2] = 5;

  const { selectors } = createHarness({
    session: createSessionSnapshot({
      puzzle,
      board,
      selectedCell: { row: 0, col: 0 }
    })
  });

  await import(`../src/main.js?test=${Date.now()}-digit-visuals`);

  assert.match(getButtonClassNames(selectors['#board'].innerHTML, '第 1 行第 1 列'), /\bfixed\b/);
  assert.match(
    getButtonClassNames(selectors['#board'].innerHTML, '第 3 行第 3 列'),
    /\bplayer-entry\b/
  );
  assert.match(
    getButtonClassNames(selectors['#board'].innerHTML, '第 3 行第 3 列'),
    /\bsame-value\b/
  );
  assert.match(selectors['#keypad'].innerHTML, /class="keypad-button digit active"[^>]*data-digit="5"/);
});

test('main.js highlights matching values after keypad input even when notes mode keeps the cell empty', async () => {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  board[2][2] = 5;

  const { selectors } = createHarness({
    session: createSessionSnapshot({
      board,
      notesMode: true,
      selectedCell: { row: 0, col: 0 }
    })
  });

  await import(`../src/main.js?test=${Date.now()}-keypad-highlight`);

  selectors['#keypad'].listeners.click[0]({
    target: {
      closest() {
        return { dataset: { digit: '5' } };
      }
    }
  });

  assert.match(
    getButtonClassNames(selectors['#board'].innerHTML, '第 3 行第 3 列'),
    /\bsame-value\b/
  );
  assert.match(selectors['#keypad'].innerHTML, /class="keypad-button digit active"[^>]*data-digit="5"/);
});

test('main.js renders tentative fills and traced origin markers', async () => {
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  const prefills = Array.from({ length: 9 }, () => Array(9).fill(0));
  board[0][0] = 6;
  prefills[0][0] = 1;

  const { selectors } = createHarness({
    session: createSessionSnapshot({
      puzzle,
      board,
      prefills,
      prefillMode: true,
      traceCell: { row: 0, col: 0 },
      selectedCell: { row: 1, col: 1 }
    })
  });

  await import(`../src/main.js?test=${Date.now()}-prefill-visuals`);

  assert.match(
    getButtonClassNames(selectors['#board'].innerHTML, '第 1 行第 1 列'),
    /\bprefill-entry\b/
  );
  assert.match(
    getButtonClassNames(selectors['#board'].innerHTML, '第 1 行第 1 列'),
    /\btrace-origin\b/
  );
});

test('main.js points the solver link at the original puzzle instead of the live board state', async () => {
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  puzzle[0][0] = 5;
  puzzle[0][1] = 3;
  board[0][0] = 5;
  board[0][1] = 3;
  board[0][2] = 4;

  const { selectors } = createHarness({
    session: createSessionSnapshot({
      puzzle,
      board
    })
  });

  await import(`../src/main.js?test=${Date.now()}-solver-link`);

  assert.match(selectors['#solver-link'].href, /solver\.html\?puzzle=53\.+/);
  assert.doesNotMatch(selectors['#solver-link'].href, /534/);
});
