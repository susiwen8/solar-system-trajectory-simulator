const { analyzeBoard, cloneBoard, parseBoardInput, serializeBoard, validateBoard } = require('./sudoku.js');
const { buildSolverPageData } = require('./solver-view.js');

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

const SAMPLE_PUZZLE_STRING = serializeBoard(SAMPLE_PUZZLE);

function createEmptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function createSolverController(options = {}) {
  const state = {
    board: createEmptyBoard(),
    selectedCell: { row: 0, col: 0 },
    validation: {
      valid: true,
      conflicts: []
    },
    analysis: null,
    parseError: '',
    inputText: '',
    guideStepIndex: -1
  };

  function updateValidation() {
    state.validation = validateBoard(state.board);
  }

  function data() {
    return buildSolverPageData(state);
  }

  function setBoard(nextBoard, { syncInput = true, inputText = null, resetSelection = false } = {}) {
    state.board = cloneBoard(nextBoard);
    state.analysis = null;
    state.parseError = '';
    state.guideStepIndex = -1;

    if (resetSelection) {
      state.selectedCell = { row: 0, col: 0 };
    }

    if (inputText !== null) {
      state.inputText = inputText;
    } else if (syncInput) {
      state.inputText = serializeBoard(state.board);
    }

    updateValidation();
    return data();
  }

  return {
    init() {
      if (!options.queryPuzzle) {
        updateValidation();
        return data();
      }

      try {
        const board = parseBoardInput(options.queryPuzzle);
        return setBoard(board, {
          syncInput: false,
          inputText: options.queryPuzzle,
          resetSelection: true
        });
      } catch {
        state.board = createEmptyBoard();
        state.analysis = null;
        state.parseError = '带入题目失败，请重新导入或手动填写。';
        state.inputText = '';
        state.selectedCell = { row: 0, col: 0 };
        updateValidation();
        return data();
      }
    },
    getState() {
      return state;
    },
    getData() {
      return data();
    },
    selectCell(row, col) {
      state.selectedCell = { row, col };
      return data();
    },
    enterDigit(value) {
      const nextBoard = cloneBoard(state.board);
      nextBoard[state.selectedCell.row][state.selectedCell.col] = value;
      return setBoard(nextBoard);
    },
    clearCell() {
      return this.enterDigit(0);
    },
    importText(text) {
      state.inputText = text;

      try {
        const board = parseBoardInput(text);
        return setBoard(board, {
          syncInput: false,
          inputText: text,
          resetSelection: true
        });
      } catch (error) {
        state.analysis = null;
        state.parseError = error instanceof Error ? error.message : '题目解析失败。';
        return data();
      }
    },
    importRecognizedBoard(board) {
      return this.importText(serializeBoard(board));
    },
    solve() {
      state.analysis = analyzeBoard(state.board);
      state.guideStepIndex =
        state.analysis?.status === 'solved' && state.analysis.steps.length
          ? state.analysis.steps.length - 1
          : -1;
      return data();
    },
    startGuide() {
      if (state.analysis?.status === 'solved' && state.analysis.steps.length) {
        state.guideStepIndex = 0;
      }

      return data();
    },
    prevGuideStep() {
      if (state.analysis?.status === 'solved' && state.analysis.steps.length) {
        state.guideStepIndex = Math.max(state.guideStepIndex - 1, 0);
      }

      return data();
    },
    nextGuideStep() {
      if (state.analysis?.status === 'solved' && state.analysis.steps.length) {
        state.guideStepIndex = Math.min(
          state.guideStepIndex + 1,
          state.analysis.steps.length - 1
        );
      }

      return data();
    },
    jumpToGuideStep(index) {
      if (state.analysis?.status === 'solved' && state.analysis.steps.length) {
        const nextIndex = Number(index);

        if (Number.isFinite(nextIndex)) {
          state.guideStepIndex = Math.max(
            0,
            Math.min(Math.trunc(nextIndex), state.analysis.steps.length - 1)
          );
        }
      }

      return data();
    },
    showGuideSolution() {
      if (state.analysis?.status === 'solved' && state.analysis.steps.length) {
        state.guideStepIndex = state.analysis.steps.length - 1;
      }

      return data();
    },
    clear() {
      return setBoard(createEmptyBoard(), {
        syncInput: false,
        inputText: '',
        resetSelection: true
      });
    },
    loadSample() {
      return setBoard(SAMPLE_PUZZLE, {
        syncInput: false,
        inputText: SAMPLE_PUZZLE_STRING,
        resetSelection: true
      });
    }
  };
}

module.exports = {
  SAMPLE_PUZZLE,
  SAMPLE_PUZZLE_STRING,
  createSolverController
};
