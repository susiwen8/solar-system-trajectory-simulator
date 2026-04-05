import { analyzeBoard, cloneBoard, parseBoardInput, validateBoard } from './sudoku.js';
import {
  buildGuideTimeline,
  buildSolverBoardCells,
  buildSolverStepItems,
  getSolverMessage
} from './solver-view.js';

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

function loadBoardFromQuery() {
  const params = new URLSearchParams(window.location?.search ?? '');
  const puzzle = params.get('puzzle');

  if (!puzzle) {
    return {
      board: null,
      error: ''
    };
  }

  try {
    return {
      board: parseBoardInput(puzzle),
      error: ''
    };
  } catch {
    return {
      board: null,
      error: '带入题目失败，请重新刷新或手动填写。'
    };
  }
}

const elements = {
  board: document.querySelector('#solver-board'),
  solveButton: document.querySelector('#solver-solve'),
  clearButton: document.querySelector('#solver-clear'),
  sampleButton: document.querySelector('#solver-sample'),
  guidePrevButton: document.querySelector('#solver-guide-prev'),
  guideNextButton: document.querySelector('#solver-guide-next'),
  message: document.querySelector('#solver-message'),
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
    parseError: preload.error,
    guideTimeline: [],
    guideStepIndex: -1
  };

  function updateValidation() {
    state.validation = validateBoard(state.board);
  }

  function setBoard(nextBoard) {
    state.board = cloneBoard(nextBoard);
    state.analysis = null;
    state.parseError = '';
    state.guideTimeline = [];
    state.guideStepIndex = -1;
    updateValidation();

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

  function getActiveGuideStep() {
    if (
      state.analysis?.status !== 'solved' ||
      !state.guideTimeline.length ||
      state.guideStepIndex < 0 ||
      state.guideStepIndex >= state.guideTimeline.length
    ) {
      return null;
    }

    return state.guideTimeline[state.guideStepIndex];
  }

  function renderBoard() {
    const solved = state.analysis?.status === 'solved';
    const activeGuideStep = getActiveGuideStep();
    const displayedBoard = activeGuideStep?.board ?? (solved ? state.analysis.solution : state.board);
    const highlightedValue = displayedBoard[state.selectedCell.row]?.[state.selectedCell.col] ?? 0;
    const markup = buildSolverBoardCells(state.board, {
      conflicts: solved ? [] : state.validation.conflicts,
      selectedCell: state.selectedCell,
      displayBoard: displayedBoard,
      guideStep: activeGuideStep
    }).map((cell) => {
      const classes = ['cell', 'solver-cell'];
      const sameValue =
        highlightedValue !== 0 && !cell.selected && cell.value !== 0 && cell.value === highlightedValue;

      if (cell.fixed) classes.push('fixed');
      if (!cell.fixed && cell.playerEntry && solved) {
        classes.push('result-cell');
      } else if (!cell.fixed && cell.playerEntry) {
        classes.push('player-entry');
      }
      if (cell.conflict) classes.push('conflict');
      if (cell.selected) classes.push('selected');
      if (cell.guideFocus) classes.push('guide-focus');
      if (sameValue) classes.push('same-value');
      if (cell.boxRight) classes.push('box-right');
      if (cell.boxBottom) classes.push('box-bottom');

      return `<button
        class="${classes.join(' ')}"
        data-row="${cell.row}"
        data-col="${cell.col}"
        aria-label="输入第 ${cell.row + 1} 行第 ${cell.col + 1} 列"
      ><div class="cell-content">${cell.value === 0 ? '' : cell.value}</div></button>`;
    });

    elements.board.innerHTML = markup.join('');
  }

  function renderSteps() {
    if (state.analysis?.status !== 'solved') {
      elements.steps.innerHTML = '';
      elements.stepCount.textContent = '0';
      return;
    }

    elements.steps.innerHTML = buildSolverStepItems(state.guideTimeline, state.guideStepIndex)
      .map(
        (step) => `<li
          id="${step.key}"
          class="solver-step${step.active ? ' active' : ''}${step.done ? ' done' : ''}"
          data-step-index="${step.index}"
          title="${step.title}"
        >${step.text}</li>`
      )
      .join('');
    elements.stepCount.textContent = String(state.analysis.steps.length);
  }

  function renderGuideControls() {
    const hasGuide = state.analysis?.status === 'solved' && state.guideTimeline.length > 0;

    elements.guidePrevButton.disabled = !hasGuide || state.guideStepIndex <= 0;
    elements.guideNextButton.disabled =
      !hasGuide || state.guideStepIndex >= state.guideTimeline.length - 1;
  }

  function scrollActiveGuideStepIntoView() {
    if (typeof elements.steps.querySelector !== 'function') {
      return;
    }

    const activeStep = elements.steps.querySelector('.solver-step.active');

    if (!activeStep || typeof activeStep.scrollIntoView !== 'function') {
      return;
    }

    activeStep.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }

  function render() {
    renderBoard();
    renderSteps();
    renderGuideControls();
    setMessage();
    scrollActiveGuideStepIntoView();
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

    if (tagName === 'INPUT') {
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

  function solveCurrentBoard() {
    state.analysis = analyzeBoard(state.board);

    if (state.analysis?.status === 'solved') {
      state.guideTimeline = buildGuideTimeline(state.board, state.analysis.steps);
      state.guideStepIndex = state.guideTimeline.length ? state.guideTimeline.length - 1 : -1;

      const activeGuideStep = getActiveGuideStep();
      if (activeGuideStep) {
        state.selectedCell = { row: activeGuideStep.row, col: activeGuideStep.col };
      }
    } else {
      state.guideTimeline = [];
      state.guideStepIndex = -1;
    }

    render();
  }

  function jumpToGuideStep(index) {
    if (state.analysis?.status !== 'solved' || !state.guideTimeline.length) {
      return;
    }

    const nextIndex = Number(index);

    if (!Number.isFinite(nextIndex)) {
      return;
    }

    state.guideStepIndex = Math.max(0, Math.min(Math.trunc(nextIndex), state.guideTimeline.length - 1));
    const activeGuideStep = getActiveGuideStep();

    if (activeGuideStep) {
      state.selectedCell = { row: activeGuideStep.row, col: activeGuideStep.col };
    }

    render();
  }

  function moveGuideStep(offset) {
    if (state.analysis?.status !== 'solved' || !state.guideTimeline.length) {
      return;
    }

    jumpToGuideStep(state.guideStepIndex + offset);
  }

  elements.board.addEventListener('click', handleBoardClick);
  elements.steps.addEventListener('click', (event) => {
    const item = event.target?.closest ? event.target.closest('[data-step-index]') : null;

    if (!item) {
      return;
    }

    jumpToGuideStep(item.dataset.stepIndex);
  });
  elements.solveButton.addEventListener('click', solveCurrentBoard);
  elements.clearButton.addEventListener('click', () => {
    setBoard(createEmptyBoard());
  });
  elements.sampleButton.addEventListener('click', () => {
    setBoard(SAMPLE_PUZZLE);
  });
  elements.guidePrevButton.addEventListener('click', () => {
    moveGuideStep(-1);
  });
  elements.guideNextButton.addEventListener('click', () => {
    moveGuideStep(1);
  });
  window.addEventListener('keydown', handleKeydown);

  updateValidation();
  render();
}
