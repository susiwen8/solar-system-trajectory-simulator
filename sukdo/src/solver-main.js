import { analyzeBoard, cloneBoard, parseBoardInput, validateBoard } from './sudoku.js';
import { buildSolverCells, formatSolverStep, getSolverMessage } from './solver-view.js';

const SAMPLE_PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

function createEmptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function serializeBoard(board) {
  return board.flat().map((value) => (value === 0 ? '.' : String(value))).join('');
}

function loadBoardFromQuery() {
  const params = new URLSearchParams(window.location?.search ?? '');
  const puzzle = params.get('puzzle');

  if (!puzzle) {
    return {
      board: null,
      input: '',
      error: ''
    };
  }

  try {
    return {
      board: parseBoardInput(puzzle),
      input: puzzle,
      error: ''
    };
  } catch {
    return {
      board: null,
      input: '',
      error: '带入题目失败，请重新导入或手动填写。'
    };
  }
}

const elements = {
  board: document.querySelector('#solver-board'),
  input: document.querySelector('#solver-input'),
  importButton: document.querySelector('#solver-import'),
  solveButton: document.querySelector('#solver-solve'),
  clearButton: document.querySelector('#solver-clear'),
  sampleButton: document.querySelector('#solver-sample'),
  message: document.querySelector('#solver-message'),
  resultBoard: document.querySelector('#solver-result-board'),
  steps: document.querySelector('#solver-steps'),
  stepCount: document.querySelector('#solver-step-count')
};

if (Object.values(elements).every(Boolean)) {
  const preload = loadBoardFromQuery();
  const state = {
    board: preload.board ? cloneBoard(preload.board) : createEmptyBoard(),
    selectedCell: { row: 0, col: 0 },
    validation: {
      valid: true,
      conflicts: []
    },
    analysis: null,
    parseError: preload.error
  };

  function updateValidation() {
    state.validation = validateBoard(state.board);
  }

  function setBoard(nextBoard, options = {}) {
    state.board = cloneBoard(nextBoard);
    state.analysis = null;
    state.parseError = '';
    updateValidation();

    if (options.syncInput !== false) {
      elements.input.value = serializeBoard(state.board);
    }

    render();
  }

  function setMessage() {
    if (state.parseError) {
      elements.message.textContent = state.parseError;
      return;
    }

    if (!state.validation.valid) {
      elements.message.textContent = getSolverMessage({ status: 'invalid' });
      return;
    }

    elements.message.textContent = getSolverMessage(state.analysis);
  }

  function renderInputBoard() {
    const markup = buildSolverCells(state.board, state.validation.conflicts).map((cell) => {
      const classes = ['cell', 'solver-cell'];

      if (cell.value !== 0) classes.push('player-entry');
      if (cell.conflict) classes.push('conflict');
      if (cell.row === state.selectedCell.row && cell.col === state.selectedCell.col) {
        classes.push('selected');
      }
      if ((cell.col + 1) % 3 === 0 && cell.col !== 8) classes.push('box-right');
      if ((cell.row + 1) % 3 === 0 && cell.row !== 8) classes.push('box-bottom');

      return `<button
        class="${classes.join(' ')}"
        data-row="${cell.row}"
        data-col="${cell.col}"
        aria-label="输入第 ${cell.row + 1} 行第 ${cell.col + 1} 列"
      ><div class="cell-content">${cell.value === 0 ? '' : cell.value}</div></button>`;
    });

    elements.board.innerHTML = markup.join('');
  }

  function renderResultBoard() {
    if (state.analysis?.status !== 'solved') {
      elements.resultBoard.innerHTML =
        '<div class="solver-result-empty">求解后会在这里显示完整答案。</div>';
      elements.steps.innerHTML = '';
      elements.stepCount.textContent = '0';
      return;
    }

    const markup = [];

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const value = state.analysis.solution[row][col];
        const classes = ['cell', 'solver-cell', 'result-cell'];

        if (state.board[row][col] !== 0) {
          classes.push('fixed');
        } else {
          classes.push('player-entry');
        }

        if ((col + 1) % 3 === 0 && col !== 8) classes.push('box-right');
        if ((row + 1) % 3 === 0 && row !== 8) classes.push('box-bottom');

        markup.push(`<button
          class="${classes.join(' ')}"
          data-row="${row}"
          data-col="${col}"
          aria-label="结果第 ${row + 1} 行第 ${col + 1} 列"
        ><div class="cell-content">${value}</div></button>`);
      }
    }

    elements.resultBoard.innerHTML = markup.join('');
    elements.steps.innerHTML = state.analysis.steps
      .map((step, index) => `<li>${formatSolverStep(step, index)}</li>`)
      .join('');
    elements.stepCount.textContent = String(state.analysis.steps.length);
  }

  function render() {
    renderInputBoard();
    renderResultBoard();
    setMessage();
  }

  function updateCell(row, col, value) {
    const nextBoard = cloneBoard(state.board);
    nextBoard[row][col] = value;
    state.selectedCell = { row, col };
    state.analysis = null;
    state.parseError = '';
    state.board = nextBoard;
    updateValidation();
    render();
  }

  function handleBoardClick(event) {
    const target = event.target?.closest
      ? event.target.closest('[data-row][data-col]')
      : event.target;

    const row = Number(target?.dataset?.row);
    const col = Number(target?.dataset?.col);

    if (Number.isNaN(row) || Number.isNaN(col)) {
      return;
    }

    state.selectedCell = { row, col };
    render();
  }

  function handleKeydown(event) {
    const tagName = event.target?.tagName?.toUpperCase?.() ?? '';

    if (tagName === 'TEXTAREA' || tagName === 'INPUT') {
      return;
    }

    const key = event.key;

    if (key >= '1' && key <= '9') {
      updateCell(state.selectedCell.row, state.selectedCell.col, Number(key));
      return;
    }

    if (key === '0' || key === 'Delete' || key === 'Backspace') {
      updateCell(state.selectedCell.row, state.selectedCell.col, 0);
      return;
    }

    if (key === 'ArrowUp') {
      state.selectedCell = {
        row: Math.max(0, state.selectedCell.row - 1),
        col: state.selectedCell.col
      };
      render();
      return;
    }

    if (key === 'ArrowDown') {
      state.selectedCell = {
        row: Math.min(8, state.selectedCell.row + 1),
        col: state.selectedCell.col
      };
      render();
      return;
    }

    if (key === 'ArrowLeft') {
      state.selectedCell = {
        row: state.selectedCell.row,
        col: Math.max(0, state.selectedCell.col - 1)
      };
      render();
      return;
    }

    if (key === 'ArrowRight') {
      state.selectedCell = {
        row: state.selectedCell.row,
        col: Math.min(8, state.selectedCell.col + 1)
      };
      render();
    }
  }

  function importFromTextarea() {
    try {
      const parsed = parseBoardInput(elements.input.value);
      setBoard(parsed, { syncInput: false });
    } catch (error) {
      state.analysis = null;
      state.parseError = error instanceof Error ? error.message : '题目解析失败。';
      render();
    }
  }

  function solveCurrentBoard() {
    state.analysis = analyzeBoard(state.board);
    render();
  }

  elements.board.addEventListener('click', handleBoardClick);
  elements.importButton.addEventListener('click', importFromTextarea);
  elements.solveButton.addEventListener('click', solveCurrentBoard);
  elements.clearButton.addEventListener('click', () => {
    elements.input.value = '';
    setBoard(createEmptyBoard(), { syncInput: false });
  });
  elements.sampleButton.addEventListener('click', () => {
    elements.input.value = serializeBoard(SAMPLE_PUZZLE);
    setBoard(SAMPLE_PUZZLE, { syncInput: false });
  });
  window.addEventListener('keydown', handleKeydown);

  updateValidation();
  if (preload.input) {
    elements.input.value = preload.input;
  }
  render();
}
