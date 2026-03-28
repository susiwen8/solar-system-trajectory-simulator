import {
  applyHint,
  clearCell,
  createGameState,
  createSnapshot,
  enterDigit,
  locateFirstWrongPrefill,
  moveSelection,
  resetGame,
  restoreGameState,
  selectCell,
  tickClock,
  togglePrefillMode,
  toggleNotesMode
} from './game-state.js';

const STORAGE_KEY = 'sukdo.session';
const BEST_TIMES_KEY = 'sukdo.best-times';
const DIFFICULTY_LABELS = {
  easy: '简单',
  medium: '中等',
  hard: '困难'
};

const elements = {
  board: document.querySelector('#board'),
  keypad: document.querySelector('#keypad'),
  timer: document.querySelector('#timer'),
  bestTime: document.querySelector('#best-time'),
  hintCount: document.querySelector('#hint-count'),
  difficultyLabel: document.querySelector('#difficulty-label'),
  statusPill: document.querySelector('#status-pill'),
  message: document.querySelector('#message'),
  solverLink: document.querySelector('#solver-link'),
  difficultyButtons: document.querySelector('#difficulty-buttons'),
  notesToggle: document.querySelector('#notes-toggle'),
  prefillToggle: document.querySelector('#prefill-toggle'),
  locatePrefill: document.querySelector('#locate-prefill'),
  hintButton: document.querySelector('#hint-button'),
  clearButton: document.querySelector('#clear-button'),
  resetButton: document.querySelector('#reset-button')
};

let bestTimes = loadBestTimes();
let state = loadInitialState();
let completionHandled = false;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadBestTimes() {
  const raw = safeParse(localStorage.getItem(BEST_TIMES_KEY) ?? 'null');

  return {
    easy: Number.isInteger(raw?.easy) ? raw.easy : null,
    medium: Number.isInteger(raw?.medium) ? raw.medium : null,
    hard: Number.isInteger(raw?.hard) ? raw.hard : null
  };
}

function loadInitialState() {
  const storedSession = safeParse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  const restored = restoreGameState(storedSession);

  return restored ?? createGameState({ difficulty: 'medium' });
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createSnapshot(state)));
}

function saveBestTimes() {
  localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(bestTimes));
}

function buildNotesMarkup(notes) {
  const cells = [];

  for (let value = 1; value <= 9; value += 1) {
    cells.push(`<span>${notes.includes(value) ? value : ''}</span>`);
  }

  return cells.join('');
}

function serializePuzzleForSolver(board) {
  return board.flat().map((value) => (value === 0 ? '.' : String(value))).join('');
}

function isPeerCell(first, second) {
  if (!first || !second) {
    return false;
  }

  if (first.row === second.row || first.col === second.col) {
    return true;
  }

  return (
    Math.floor(first.row / 3) === Math.floor(second.row / 3) &&
    Math.floor(first.col / 3) === Math.floor(second.col / 3)
  );
}

function renderBoard() {
  const selectedValue = state.board[state.selectedCell.row][state.selectedCell.col];
  const markup = [];

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const value = state.board[row][col];
      const notes = state.notes[row][col];
      const fixed = state.puzzle[row][col] !== 0;
      const playerEntry = value !== 0 && !fixed;
      const prefillEntry = state.prefills[row][col] > 0;
      const selected = state.selectedCell.row === row && state.selectedCell.col === col;
      const related = !selected && isPeerCell(state.selectedCell, { row, col });
      const sameValue = selectedValue !== 0 && !selected && value === selectedValue;
      const traceOrigin =
        state.traceCell?.row === row && state.traceCell?.col === col;
      const classes = ['cell'];

      if (fixed) classes.push('fixed');
      if (playerEntry) classes.push('player-entry');
      if (prefillEntry) classes.push('prefill-entry');
      if (selected) classes.push('selected');
      if (related) classes.push('related');
      if (sameValue) classes.push('same-value');
      if (traceOrigin) classes.push('trace-origin');
      if (state.completed) classes.push('completed');
      if ((col + 1) % 3 === 0 && col !== 8) classes.push('box-right');
      if ((row + 1) % 3 === 0 && row !== 8) classes.push('box-bottom');

      const content =
        value !== 0
          ? `<div class="cell-content">${value}</div>`
          : `<div class="notes-grid">${buildNotesMarkup(notes)}</div>`;

      markup.push(
        `<button
          class="${classes.join(' ')}"
          data-row="${row}"
          data-col="${col}"
          aria-label="第 ${row + 1} 行第 ${col + 1} 列"
        >${content}</button>`
      );
    }
  }

  elements.board.innerHTML = markup.join('');
}

function renderKeypad() {
  const buttons = [];

  for (let value = 1; value <= 9; value += 1) {
    buttons.push(
      `<button class="keypad-button digit" data-digit="${value}" aria-label="填入 ${value}">${value}</button>`
    );
  }

  buttons.push(
    '<button class="keypad-button primary" data-action="clear">清空</button>',
    '<button class="keypad-button secondary" data-action="notes">笔记</button>',
    '<button class="keypad-button primary" data-action="hint">提示</button>'
  );

  elements.keypad.innerHTML = buttons.join('');
}

function updateBestTimeIfNeeded() {
  if (!state.completed || completionHandled) {
    return;
  }

  const currentBest = bestTimes[state.difficulty];

  if (currentBest === null || state.elapsedSeconds < currentBest) {
    bestTimes = {
      ...bestTimes,
      [state.difficulty]: state.elapsedSeconds
    };
    saveBestTimes();
  }

  completionHandled = true;
}

function getMessage() {
  if (state.completed) {
    return `完成啦，用时 ${formatTime(state.elapsedSeconds)}。点右侧难度按钮可以立刻开下一局。`;
  }

  if (state.traceCell) {
    return '已经定位到当前试填链路里最早出错的空位，你可以从这里回退或改写。';
  }

  if (state.prefillMode) {
    return '试填模式开启中：输入会作为暂时填写保留，旧笔记不会丢失，可用“定位试错”回到最早错误点。';
  }

  if (state.notesMode) {
    return '笔记模式开启中，再按一次 N 或点击按钮即可关闭。';
  }

  const selectedFixed = state.puzzle[state.selectedCell.row][state.selectedCell.col] !== 0;

  if (selectedFixed) {
    return '这是题目自带的数字，不能修改。请选择一个空格继续。';
  }

  return '方向键移动，1-9 填数，Delete 清空，N 记笔记，H 用提示。';
}

function renderMeta() {
  updateBestTimeIfNeeded();

  elements.timer.textContent = formatTime(state.elapsedSeconds);
  elements.bestTime.textContent =
    bestTimes[state.difficulty] === null ? '--:--' : formatTime(bestTimes[state.difficulty]);
  elements.hintCount.textContent = String(state.hintsUsed);
  elements.difficultyLabel.textContent = DIFFICULTY_LABELS[state.difficulty];
  elements.message.textContent = getMessage();
  elements.statusPill.textContent = state.completed
    ? '本局完成'
    : state.prefillMode
      ? '试填模式'
      : state.notesMode
        ? '笔记模式'
        : '继续挑战';
  elements.statusPill.classList.toggle('completed', state.completed);
  elements.notesToggle.classList.toggle('primary', state.notesMode);
  elements.prefillToggle.classList.toggle('primary', state.prefillMode);

  if (elements.solverLink) {
    const puzzle = serializePuzzleForSolver(state.puzzle);
    elements.solverLink.href = `./solver.html?puzzle=${encodeURIComponent(puzzle)}`;
  }

  for (const button of elements.difficultyButtons.querySelectorAll('[data-difficulty]')) {
    button.classList.toggle('active', button.dataset.difficulty === state.difficulty);
  }
}

function render() {
  renderBoard();
  renderKeypad();
  renderMeta();
}

function setState(nextState) {
  state = nextState;

  if (!state.completed) {
    completionHandled = false;
  }

  saveSession();
  render();
}

function startNewGame(difficulty) {
  completionHandled = false;
  setState(createGameState({ difficulty }));
}

function handleDigitInput(value) {
  setState(enterDigit(state, value));
}

function handleAction(action) {
  switch (action) {
    case 'clear':
      setState(clearCell(state));
      break;
    case 'notes':
      setState(toggleNotesMode(state));
      break;
    case 'prefill':
      setState(togglePrefillMode(state));
      break;
    case 'locate-prefill':
      setState(locateFirstWrongPrefill(state));
      break;
    case 'hint':
      setState(applyHint(state));
      break;
    default:
      break;
  }
}

elements.board.addEventListener('click', (event) => {
  const cell = event.target.closest('[data-row][data-col]');

  if (!cell) {
    return;
  }

  setState(selectCell(state, Number(cell.dataset.row), Number(cell.dataset.col)));
});

elements.keypad.addEventListener('click', (event) => {
  const button = event.target.closest('button');

  if (!button) {
    return;
  }

  if (button.dataset.digit) {
    handleDigitInput(Number(button.dataset.digit));
    return;
  }

  if (button.dataset.action) {
    handleAction(button.dataset.action);
  }
});

elements.difficultyButtons.addEventListener('click', (event) => {
  const button = event.target.closest('[data-difficulty]');

  if (!button) {
    return;
  }

  startNewGame(button.dataset.difficulty);
});

elements.notesToggle.addEventListener('click', () => {
  setState(toggleNotesMode(state));
});

elements.prefillToggle.addEventListener('click', () => {
  setState(togglePrefillMode(state));
});

elements.locatePrefill.addEventListener('click', () => {
  setState(locateFirstWrongPrefill(state));
});

elements.hintButton.addEventListener('click', () => {
  setState(applyHint(state));
});

elements.clearButton.addEventListener('click', () => {
  setState(clearCell(state));
});

elements.resetButton.addEventListener('click', () => {
  completionHandled = false;
  setState(resetGame(state));
});

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    handleDigitInput(Number(event.key));
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
    event.preventDefault();
    setState(clearCell(state));
    return;
  }

  if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    setState(toggleNotesMode(state));
    return;
  }

  if (event.key === 'h' || event.key === 'H') {
    event.preventDefault();
    setState(applyHint(state));
    return;
  }

  if (event.key === 'g' || event.key === 'G') {
    event.preventDefault();
    setState(togglePrefillMode(state));
    return;
  }

  if (event.key === 'l' || event.key === 'L') {
    event.preventDefault();
    setState(locateFirstWrongPrefill(state));
    return;
  }

  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    completionHandled = false;
    setState(resetGame(state));
    return;
  }

  const deltas = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  };

  if (deltas[event.key]) {
    event.preventDefault();
    const [rowOffset, colOffset] = deltas[event.key];
    setState(moveSelection(state, rowOffset, colOffset));
  }
});

window.setInterval(() => {
  if (!state.completed) {
    setState(tickClock(state, 1));
  }
}, 1000);

render();
