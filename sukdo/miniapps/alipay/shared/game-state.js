const { cloneBoard, generatePuzzle } = require('./sudoku.js');
const { BOARD_SIZE } = require('./constants.js');

function createEmptyNotes() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => [])
  );
}

function createEmptyPrefills() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function findFirstEditableCell(puzzle) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (puzzle[row][col] === 0) {
        return { row, col };
      }
    }
  }

  return { row: 0, col: 0 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isEditableCell(state, row, col) {
  return state.puzzle[row][col] === 0;
}

function getActiveDigit(value) {
  return Number.isInteger(value) && value >= 1 && value <= 9 ? value : null;
}

function isSolved(board, solution) {
  return board.every((row, rowIndex) =>
    row.every((value, colIndex) => value === solution[rowIndex][colIndex])
  );
}

function updateCompletion(state, board = state.board) {
  return {
    ...state,
    board,
    completed: isSolved(board, state.solution)
  };
}

function cloneNotes(notes) {
  return notes.map((noteRow) => noteRow.map((cell) => [...cell]));
}

function clonePrefills(prefills) {
  return prefills.map((row) => [...row]);
}

function isBoardShape(board) {
  return (
    Array.isArray(board) &&
    board.length === BOARD_SIZE &&
    board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_SIZE &&
        row.every((value) => Number.isInteger(value) && value >= 0 && value <= 9)
    )
  );
}

function isNotesShape(notes) {
  return (
    Array.isArray(notes) &&
    notes.length === BOARD_SIZE &&
    notes.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_SIZE &&
        row.every(
          (cell) =>
            Array.isArray(cell) &&
            cell.every((value) => Number.isInteger(value) && value >= 1 && value <= 9)
        )
    )
  );
}

function isPrefillsShape(prefills) {
  return (
    Array.isArray(prefills) &&
    prefills.length === BOARD_SIZE &&
    prefills.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_SIZE &&
        row.every((value) => Number.isInteger(value) && value >= 0)
    )
  );
}

function createGameState(options = {}) {
  const difficulty = options.difficulty ?? 'medium';
  const generatedGame =
    options.puzzle && options.solution
      ? {
          difficulty,
          puzzle: options.puzzle,
          solution: options.solution
        }
      : generatePuzzle(difficulty);

  const selectedCell = findFirstEditableCell(generatedGame.puzzle);

  return {
    difficulty: generatedGame.difficulty ?? difficulty,
    puzzle: cloneBoard(generatedGame.puzzle),
    solution: cloneBoard(generatedGame.solution),
    board: cloneBoard(generatedGame.puzzle),
    notes: createEmptyNotes(),
    notesMode: false,
    prefillMode: false,
    prefills: createEmptyPrefills(),
    nextPrefillOrder: 1,
    completed: false,
    elapsedSeconds: options.elapsedSeconds ?? 0,
    hintsUsed: options.hintsUsed ?? 0,
    traceCell: null,
    selectedCell,
    activeDigit: getActiveDigit(generatedGame.puzzle[selectedCell.row][selectedCell.col])
  };
}

function selectCell(state, row, col) {
  return {
    ...state,
    traceCell: null,
    selectedCell: { row, col },
    activeDigit: getActiveDigit(state.board[row][col])
  };
}

function toggleNotesMode(state) {
  return {
    ...state,
    notesMode: !state.notesMode,
    prefillMode: false,
    traceCell: null
  };
}

function togglePrefillMode(state) {
  return {
    ...state,
    notesMode: false,
    prefillMode: !state.prefillMode,
    traceCell: null
  };
}

function enterDigit(state, digit) {
  const { row, col } = state.selectedCell;
  const activeDigit = getActiveDigit(digit);

  if (activeDigit === null) {
    return state;
  }

  if (!isEditableCell(state, row, col)) {
    return {
      ...state,
      traceCell: null,
      activeDigit
    };
  }

  if (state.notesMode && state.board[row][col] === 0) {
    const notes = cloneNotes(state.notes);
    const existingNotes = notes[row][col];
    const nextNotes = existingNotes.includes(digit)
      ? existingNotes.filter((value) => value !== digit)
      : [...existingNotes, digit].sort((left, right) => left - right);

    notes[row][col] = nextNotes;

    return {
      ...state,
      traceCell: null,
      notes,
      activeDigit
    };
  }

  if (state.prefillMode) {
    const board = cloneBoard(state.board);
    const prefills = clonePrefills(state.prefills);
    board[row][col] = digit;

    if (prefills[row][col] === 0) {
      prefills[row][col] = state.nextPrefillOrder;
    }

    return updateCompletion(
      {
        ...state,
        board,
        prefills,
        nextPrefillOrder:
          prefills[row][col] === state.nextPrefillOrder
            ? state.nextPrefillOrder + 1
            : state.nextPrefillOrder,
        traceCell: null,
        activeDigit
      },
      board
    );
  }

  const board = cloneBoard(state.board);
  const notes = cloneNotes(state.notes);
  const prefills = clonePrefills(state.prefills);
  board[row][col] = digit;
  notes[row][col] = [];
  prefills[row][col] = 0;

  return updateCompletion(
    {
      ...state,
      notes,
      prefills,
      traceCell: null,
      activeDigit
    },
    board
  );
}

function clearCell(state) {
  const { row, col } = state.selectedCell;

  if (!isEditableCell(state, row, col)) {
    return state;
  }

  const board = cloneBoard(state.board);
  const notes = cloneNotes(state.notes);
  const prefills = clonePrefills(state.prefills);
  board[row][col] = 0;

  if (prefills[row][col] === 0) {
    notes[row][col] = [];
  }

  prefills[row][col] = 0;

  return {
    ...state,
    board,
    notes,
    prefills,
    traceCell: null,
    completed: false,
    activeDigit: null
  };
}

function resetGame(state) {
  return {
    ...state,
    board: cloneBoard(state.puzzle),
    notes: createEmptyNotes(),
    notesMode: false,
    prefillMode: false,
    prefills: createEmptyPrefills(),
    nextPrefillOrder: 1,
    elapsedSeconds: 0,
    hintsUsed: 0,
    traceCell: null,
    completed: false,
    activeDigit: null
  };
}

function moveSelection(state, rowOffset, colOffset) {
  const selectedCell = {
    row: clamp(state.selectedCell.row + rowOffset, 0, BOARD_SIZE - 1),
    col: clamp(state.selectedCell.col + colOffset, 0, BOARD_SIZE - 1)
  };

  return {
    ...state,
    traceCell: null,
    selectedCell,
    activeDigit: getActiveDigit(state.board[selectedCell.row][selectedCell.col])
  };
}

function applyHint(state) {
  const { row, col } = state.selectedCell;
  const targetCell =
    isEditableCell(state, row, col) && state.board[row][col] === 0
      ? { row, col }
      : findFirstEditableCell(
          state.board.map((boardRow, boardRowIndex) =>
            boardRow.map((value, colIndex) =>
              value === 0 && isEditableCell(state, boardRowIndex, colIndex) ? 0 : 1
            )
          )
        );

  if (!targetCell || state.board[targetCell.row][targetCell.col] !== 0) {
    return state;
  }

  const board = cloneBoard(state.board);
  const notes = cloneNotes(state.notes);
  const prefills = clonePrefills(state.prefills);
  board[targetCell.row][targetCell.col] = state.solution[targetCell.row][targetCell.col];
  notes[targetCell.row][targetCell.col] = [];
  prefills[targetCell.row][targetCell.col] = 0;

  return updateCompletion(
    {
      ...state,
      board,
      notes,
      prefills,
      hintsUsed: state.hintsUsed + 1,
      traceCell: null,
      selectedCell: targetCell,
      activeDigit: getActiveDigit(board[targetCell.row][targetCell.col])
    },
    board
  );
}

function locateFirstWrongPrefill(state) {
  const orderedPrefills = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const order = state.prefills[row][col];

      if (order > 0) {
        orderedPrefills.push({ row, col, order });
      }
    }
  }

  orderedPrefills.sort((left, right) => left.order - right.order);

  const wrongPrefill = orderedPrefills.find(
    ({ row, col }) => state.board[row][col] !== state.solution[row][col]
  );

  if (!wrongPrefill) {
    return {
      ...state,
      traceCell: null
    };
  }

  return {
    ...state,
    selectedCell: { row: wrongPrefill.row, col: wrongPrefill.col },
    traceCell: { row: wrongPrefill.row, col: wrongPrefill.col },
    activeDigit: getActiveDigit(state.board[wrongPrefill.row][wrongPrefill.col])
  };
}

function tickClock(state, seconds = 1) {
  if (state.completed) {
    return state;
  }

  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + seconds
  };
}

function createSnapshot(state) {
  return {
    difficulty: state.difficulty,
    puzzle: cloneBoard(state.puzzle),
    solution: cloneBoard(state.solution),
    board: cloneBoard(state.board),
    notes: cloneNotes(state.notes),
    notesMode: state.notesMode,
    prefillMode: state.prefillMode,
    prefills: clonePrefills(state.prefills),
    nextPrefillOrder: state.nextPrefillOrder,
    completed: state.completed,
    elapsedSeconds: state.elapsedSeconds,
    hintsUsed: state.hintsUsed,
    traceCell: state.traceCell ? { ...state.traceCell } : null,
    selectedCell: { ...state.selectedCell },
    activeDigit: state.activeDigit
  };
}

function restoreGameState(snapshot) {
  if (
    !snapshot ||
    !isBoardShape(snapshot.puzzle) ||
    !isBoardShape(snapshot.solution) ||
    !isBoardShape(snapshot.board) ||
    !isNotesShape(snapshot.notes) ||
    !isPrefillsShape(snapshot.prefills ?? createEmptyPrefills())
  ) {
    return null;
  }

  const selectedCell =
    snapshot.selectedCell &&
    Number.isInteger(snapshot.selectedCell.row) &&
    Number.isInteger(snapshot.selectedCell.col)
      ? {
          row: clamp(snapshot.selectedCell.row, 0, BOARD_SIZE - 1),
          col: clamp(snapshot.selectedCell.col, 0, BOARD_SIZE - 1)
        }
      : findFirstEditableCell(snapshot.puzzle);
  const board = cloneBoard(snapshot.board);

  return {
    difficulty: snapshot.difficulty ?? 'medium',
    puzzle: cloneBoard(snapshot.puzzle),
    solution: cloneBoard(snapshot.solution),
    board,
    notes: cloneNotes(snapshot.notes),
    notesMode: Boolean(snapshot.notesMode),
    prefillMode: Boolean(snapshot.prefillMode),
    prefills: clonePrefills(snapshot.prefills ?? createEmptyPrefills()),
    nextPrefillOrder:
      Number.isInteger(snapshot.nextPrefillOrder) && snapshot.nextPrefillOrder > 0
        ? snapshot.nextPrefillOrder
        : 1,
    completed: Boolean(snapshot.completed),
    elapsedSeconds: Number.isInteger(snapshot.elapsedSeconds) ? snapshot.elapsedSeconds : 0,
    hintsUsed: Number.isInteger(snapshot.hintsUsed) ? snapshot.hintsUsed : 0,
    traceCell:
      snapshot.traceCell &&
      Number.isInteger(snapshot.traceCell.row) &&
      Number.isInteger(snapshot.traceCell.col)
        ? {
            row: clamp(snapshot.traceCell.row, 0, BOARD_SIZE - 1),
            col: clamp(snapshot.traceCell.col, 0, BOARD_SIZE - 1)
          }
        : null,
    selectedCell,
    activeDigit:
      getActiveDigit(snapshot.activeDigit) ??
      getActiveDigit(board[selectedCell.row][selectedCell.col])
  };
}

module.exports = {
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
  toggleNotesMode,
  togglePrefillMode
};
